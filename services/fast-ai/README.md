# Быстрый слой ИИ (Laya)

Классификация описания наряда: категория шифра, приоритет, специальность. Подробности и результаты — `docs/laya-eval.md`.

```
cd services/fast-ai
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt   # установка
.venv/bin/python finetune/make_data.py        # данные от DeepSeek (ключ из apps/web/.env.local) -> finetune/data/train.jsonl
.venv/bin/python finetune/train_mps.py 4      # дообучение на Mac (~20 мин) -> finetune/laya-naryad/
.venv/bin/python finetune/eval_finetuned.py   # сравнение на 20 тестовых описаниях
FAST_AI_SECRET=секрет .venv/bin/uvicorn server:app --port 8787   # сервер
```

Сервер: `GET /health`, `POST /classify {"description": "..."}` с заголовком `Authorization: Bearer <FAST_AI_SECRET>`.
Если `finetune/laya-naryad/` нет, берётся базовая `laya-multilingual`. В приложении сервис включается переменными
`LAYA_ENABLED=1`, `FAST_AI_URL`, `FAST_AI_SECRET`.
Веса и данные не коммитятся (см. `.gitignore`).
