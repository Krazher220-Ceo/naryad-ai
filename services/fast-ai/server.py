# HTTP-сервер быстрого слоя: POST /classify {"description": "..."} -> категория, приоритет, специальность.
# Формат ответа ждёт apps/web/lib/ai/classify.ts. Доступ по заголовку Authorization: Bearer <FAST_AI_SECRET>.
# Запуск: FAST_AI_SECRET=... .venv/bin/uvicorn server:app --port 8787
import hmac
import os
import threading
import time
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
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
