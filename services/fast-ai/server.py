# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# HTTP-сервер быстрого слоя на нашем сервере (Mac или Linux):
#   POST /classify {"description": "..."} -> категория, приоритет, специальность (Laya);
#   POST /transcribe (файл audio, поле lang) -> текст речи (Whisper large-v3-turbo: mlx-whisper или faster-whisper).
# Формат ответа ждёт apps/web/lib/ai/classify.ts. Доступ по заголовку Authorization: Bearer <FAST_AI_SECRET>.
# Параллельность ограничена семафорами; если очередь длинная, отвечаем 503 {"busy": true} —
# приложение тогда сразу идёт по запасному пути. Все переменные окружения — в README.md.
# Запуск: FAST_AI_SECRET=... .venv/bin/uvicorn server:app --port 8787
import hmac
import importlib.util
import os
import platform
import sys
import tempfile
import threading
import time
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from questions import QUESTIONS

HERE = Path(__file__).resolve().parent
TUNED = HERE / "finetune" / "laya-naryad"
KEYS = ["category", "priority", "specialty"]
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # примерно 5 минут речи в webm/opus

QUEUE_MAX = int(os.environ.get("QUEUE_MAX", "4"))  # сколько запросов может ждать в очереди к одной модели
QUEUE_WAIT_S = float(os.environ.get("QUEUE_WAIT_S", "5"))  # сколько ждать место для /classify
QUEUE_WAIT_VOICE_S = float(os.environ.get("QUEUE_WAIT_VOICE_S", "20"))  # то же для /transcribe

app = FastAPI(title="НарядAI fast-ai")
state = {}


class Busy(Exception):
    """Очередь к модели переполнена или место не освободилось вовремя."""


@app.exception_handler(Busy)
def busy_handler(request: Request, exc: Busy):
    return JSONResponse(status_code=503, content={"busy": True})


class Limiter:
    """Не больше `workers` запросов к модели одновременно и не больше QUEUE_MAX ожидающих."""

    def __init__(self, workers: int, wait_s: float):
        self.workers = workers
        self.wait_s = wait_s
        self.sem = threading.BoundedSemaphore(workers)
        self.waiting = 0
        self.guard = threading.Lock()  # защищает счётчик ожидающих

    def run(self, work):
        """Выполняет work() под семафором. Возвращает (результат, время ожидания в мс)."""
        t0 = time.perf_counter()
        with self.guard:
            if self.waiting >= QUEUE_MAX:
                raise Busy()
            self.waiting += 1
        got = self.sem.acquire(timeout=self.wait_s)
        with self.guard:
            self.waiting -= 1
        if not got:
            raise Busy()
        queue_ms = round((time.perf_counter() - t0) * 1000)
        try:
            return work(), queue_ms
        finally:
            self.sem.release()


# Для Laya по умолчанию 1: потокобезопасность объекта модели не проверена. Для Whisper лимитер создаётся ниже.
laya_limiter = Limiter(int(os.environ.get("LAYA_WORKERS", "1")), QUEUE_WAIT_S)


class Item(BaseModel):
    description: str


def resolve_model(name: str) -> str:
    """Локальная папка берётся как есть, иначе это id репозитория Hugging Face (например Krazher/laya-naryad)."""
    if Path(name).exists():
        return name
    from huggingface_hub import snapshot_download

    return snapshot_download(name)


def laya_source() -> str:
    """Откуда брать веса: LAYA_MODEL, затем локальная finetune/laya-naryad, затем LAYA_HF_REPO. Пусто — базовая модель."""
    return os.environ.get("LAYA_MODEL") or (str(TUNED) if TUNED.exists() else "") or os.environ.get("LAYA_HF_REPO", "")


def predict(text: str):
    if "agent" in state:
        return state["agent"].predict(text, QUESTIONS)["answers"]
    return state["router"].predict(text, QUESTIONS, model="multilingual")["answers"]


@app.on_event("startup")
def load_model():
    name = laya_source()
    if name:
        from laya import Agent

        state["agent"] = Agent(resolve_model(name))
        state["model"] = name
    else:
        from laya import Router

        state["router"] = Router()
        state["model"] = "laya-multilingual"
    predict("прогрев")  # первый вызов медленный, делаем его заранее


def check_auth(authorization: str = Header(default="")):
    secret = os.environ.get("FAST_AI_SECRET", "")
    if not secret or not hmac.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(status_code=401, detail="unauthorized")


# ---------- Голос: Whisper large-v3-turbo (MIT) ----------
# Два способа запуска, выбираются WHISPER_BACKEND=auto|mlx|faster:
#   mlx    — mlx-whisper, только Mac с чипом M (requirements-voice.txt);
#   faster — faster-whisper на CTranslate2, Linux/Windows, NVIDIA (cuda, float16) или процессор (cpu, int8)
#            (requirements-voice-linux.txt).
# auto: mlx, если это Mac с чипом M и mlx_whisper установлен, иначе faster.
# Модель грузится при первом запросе /transcribe и дальше остаётся в памяти.
def pick_backend() -> str:
    want = os.environ.get("WHISPER_BACKEND", "auto").lower()
    if want in ("mlx", "faster"):
        return want
    on_apple_silicon = sys.platform == "darwin" and platform.machine() == "arm64"
    return "mlx" if on_apple_silicon and importlib.util.find_spec("mlx_whisper") else "faster"


WHISPER_BACKEND = pick_backend()
WHISPER_MODEL = os.environ.get(
    "WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo" if WHISPER_BACKEND == "mlx" else "large-v3-turbo"
)
# mlx работает на одном GPU, поэтому по умолчанию один запрос; faster-whisper умеет несколько.
WHISPER_WORKERS = int(os.environ.get("WHISPER_WORKERS", "1" if WHISPER_BACKEND == "mlx" else "2"))
whisper_limiter = Limiter(WHISPER_WORKERS, QUEUE_WAIT_VOICE_S)
whisper_load_lock = threading.Lock()
whisper = {"device": "auto", "loaded": False}  # устройство уточнится после загрузки модели


def get_faster_model():
    with whisper_load_lock:
        if "model" not in whisper:
            import ctranslate2
            from faster_whisper import WhisperModel

            cuda = ctranslate2.get_cuda_device_count() > 0
            whisper["device"] = "cuda" if cuda else "cpu"
            whisper["model"] = WhisperModel(
                WHISPER_MODEL,
                device=whisper["device"],
                compute_type="float16" if cuda else "int8",
                num_workers=WHISPER_WORKERS,
            )
            whisper["loaded"] = True
        return whisper["model"]


def run_whisper(path: str, language: str) -> str:
    if WHISPER_BACKEND == "mlx":
        import mlx_whisper

        whisper.update(device="mlx", loaded=True)
        return str(mlx_whisper.transcribe(path, path_or_hf_repo=WHISPER_MODEL, language=language).get("text", ""))
    segments, _ = get_faster_model().transcribe(path, language=language)
    return " ".join(s.text.strip() for s in segments)  # генератор: распознавание идёт здесь


@app.get("/health")
def health():
    return {
        "ok": "model" in state,
        "model": state.get("model"),
        "whisper": {
            "backend": WHISPER_BACKEND,
            "model": WHISPER_MODEL,
            "device": whisper["device"],
            "loaded": whisper["loaded"],
        },
        "workers": {"laya": laya_limiter.workers, "whisper": whisper_limiter.workers},
        "waiting": {"laya": laya_limiter.waiting, "whisper": whisper_limiter.waiting},
    }


# Обычный def: FastAPI сам выполняет его в пуле потоков, цикл событий не блокируется.
@app.post("/classify", dependencies=[Depends(check_auth)])
def classify(item: Item):
    text = item.description.strip()
    if not text:
        raise HTTPException(status_code=422, detail="description is empty")
    t0 = time.perf_counter()
    answers, queue_ms = laya_limiter.run(lambda: predict(text))
    out = {k: {"choice": answers[k]["choice"], "probabilities": answers[k]["probabilities"]} for k in KEYS}
    out["queue_ms"] = queue_ms
    out["ms"] = round((time.perf_counter() - t0) * 1000)
    return out


@app.post("/transcribe", dependencies=[Depends(check_auth)])
async def transcribe(audio: UploadFile = File(...), lang: str = Form("ru")):
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="audio is empty")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio is too long")

    language = "kk" if lang.startswith("kk") else "ru"
    t0 = time.perf_counter()

    def work():
        # Файл нужен на диске: mlx-whisper читает его через ffmpeg.
        with tempfile.NamedTemporaryFile(suffix=Path(audio.filename or "a.webm").suffix or ".webm") as tmp:
            tmp.write(data)
            tmp.flush()
            return run_whisper(tmp.name, language)

    try:
        # Распознавание тяжёлое и блокирующее — уводим в пул потоков, чтобы цикл событий не вставал.
        text, queue_ms = await run_in_threadpool(whisper_limiter.run, work)
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Whisper не установлен: {e.name}")
    return {
        "text": text.strip(),
        "lang": language,
        "queue_ms": queue_ms,
        "ms": round((time.perf_counter() - t0) * 1000),
    }
