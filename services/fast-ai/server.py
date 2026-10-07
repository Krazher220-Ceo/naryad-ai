# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# HTTP-сервер быстрого слоя на нашем Mac:
#   POST /classify {"description": "..."} -> категория, приоритет, специальность (Laya);
#   POST /transcribe (файл audio, поле lang) -> текст речи (Whisper large-v3-turbo через mlx-whisper).
# Формат ответа ждёт apps/web/lib/ai/classify.ts. Доступ по заголовку Authorization: Bearer <FAST_AI_SECRET>.
# Запуск: FAST_AI_SECRET=... .venv/bin/uvicorn server:app --port 8787
import hmac
import os
import threading
import time
from pathlib import Path

import tempfile

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from laya import Router
from pydantic import BaseModel

from questions import QUESTIONS

HERE = Path(__file__).resolve().parent
TUNED = HERE / "finetune" / "laya-naryad"
KEYS = ["category", "priority", "specialty"]

app = FastAPI(title="НарядAI fast-ai")
lock = threading.Lock()  # одна модель, запросы идут по очереди
state = {}


class Item(BaseModel):
    description: str


def run_model(text: str):
    with lock:
        if "agent" in state:
            return state["agent"].predict(text, QUESTIONS)["answers"]
        return state["router"].predict(text, QUESTIONS, model="multilingual")["answers"]


@app.on_event("startup")
def load_model():
    # Дообученный чекпойнт, если он есть, иначе базовая multilingual
    if TUNED.exists():
        from laya import Agent
        state["agent"] = Agent(str(TUNED))
        state["model"] = "laya-naryad"
    else:
        state["router"] = Router()
        state["model"] = "laya-multilingual"
    run_model("прогрев")  # первый вызов медленный, делаем его заранее


def check_auth(authorization: str = Header(default="")):
    secret = os.environ.get("FAST_AI_SECRET", "")
    if not secret or not hmac.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health():
    return {"ok": "model" in state, "model": state.get("model")}


@app.post("/classify", dependencies=[Depends(check_auth)])
def classify(item: Item):
    text = item.description.strip()
    if not text:
        raise HTTPException(status_code=422, detail="description is empty")
    t0 = time.perf_counter()
    answers = run_model(text)
    out = {k: {"choice": answers[k]["choice"], "probabilities": answers[k]["probabilities"]} for k in KEYS}
    out["ms"] = round((time.perf_counter() - t0) * 1000)
    return out


# ---------- Голос: Whisper large-v3-turbo (MIT) на Apple Silicon ----------
# mlx-whisper ставится отдельно (requirements-voice.txt): он работает только на Mac с чипом M.
# Модель скачивается при первом запросе (~1,6 ГБ) и дальше лежит в кэше Hugging Face.
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # примерно 5 минут речи в webm/opus
whisper_lock = threading.Lock()


@app.post("/transcribe", dependencies=[Depends(check_auth)])
async def transcribe(audio: UploadFile = File(...), lang: str = Form("ru")):
    try:
        import mlx_whisper  # импорт здесь: без него /classify тоже работает
    except ImportError:
        raise HTTPException(status_code=503, detail="mlx-whisper не установлен")

    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="audio is empty")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio is too long")

    language = "kk" if lang.startswith("kk") else "ru"
    t0 = time.perf_counter()
    # Whisper читает файл через ffmpeg, поэтому сохраняем во временный файл.
    with tempfile.NamedTemporaryFile(suffix=Path(audio.filename or "a.webm").suffix or ".webm") as tmp:
        tmp.write(data)
        tmp.flush()
        with whisper_lock:
            result = mlx_whisper.transcribe(tmp.name, path_or_hf_repo=WHISPER_MODEL, language=language)
    return {"text": str(result.get("text", "")).strip(), "lang": language, "ms": round((time.perf_counter() - t0) * 1000)}
