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

## Голос: Whisper и Qwen3 на Mac

Речь в текст — `POST /transcribe` (поле `audio` — файл записи, поле `lang` — `ru` или `kk`), тот же заголовок
`Authorization`. Модель Whisper large-v3-turbo (MIT) через mlx-whisper (MIT), только Mac с чипом M.

```
brew install ffmpeg
.venv/bin/pip install -r requirements-voice.txt
ollama pull qwen3:4b-instruct-2507-q4_K_M        # разбор речи по полям наряда (Apache 2.0)
FAST_AI_SECRET=секрет .venv/bin/uvicorn server:app --port 8787
```

Разбор текста по полям делает приложение (`apps/web/lib/ai/voice.ts`) через Ollama: переменные `OLLAMA_URL`
и `OLLAMA_VOICE_MODEL` (по умолчанию `qwen3:4b-instruct-2507-q4_K_M`). Mac выключен — облако с обезличиванием,
облако недоступно — текст вставляется без разбора. В браузере без сети работает распознавание телефона.
