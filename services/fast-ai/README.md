# Быстрый слой ИИ (Laya)

Классификация описания наряда: категория шифра, приоритет, специальность. Подробности и результаты — `docs/laya-eval.md`.

```
cd services/fast-ai
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt   # установка
.venv/bin/python finetune/make_data.py        # данные от DeepSeek (ключ из apps/web/.env.local) -> finetune/data/train.jsonl
.venv/bin/python finetune/train_mps.py 4      # дообучение на Mac (~20 мин) -> finetune/laya-naryad/
.venv/bin/python finetune/eval_finetuned.py   # сравнение на 192 тестовых описаниях (eval_set.jsonl, синтетические)
FAST_AI_SECRET=секрет .venv/bin/uvicorn server:app --port 8787   # сервер
```

Сервер: `GET /health`, `POST /classify {"description": "..."}` с заголовком `Authorization: Bearer <FAST_AI_SECRET>`.
Какие веса брать, см. `LAYA_MODEL` ниже; если ничего не задано и `finetune/laya-naryad/` нет, берётся базовая `laya-multilingual`. В приложении сервис включается переменными
`LAYA_ENABLED=1`, `FAST_AI_URL`, `FAST_AI_SECRET`.
Веса и данные не коммитятся (см. `.gitignore`).

## Голос: Whisper и Qwen3 на Mac

Речь в текст — `POST /transcribe` (поле `audio` — файл записи, поле `lang` — `ru` или `kk`), тот же заголовок
`Authorization`. Модель Whisper large-v3-turbo (MIT). На Mac с чипом M — через mlx-whisper (MIT), на Linux — через faster-whisper (MIT, см. ниже).

```
brew install ffmpeg
.venv/bin/pip install -r requirements-voice.txt
ollama pull qwen3:4b-instruct-2507-q4_K_M        # разбор речи по полям наряда (Apache 2.0)
FAST_AI_SECRET=секрет .venv/bin/uvicorn server:app --port 8787
```

Разбор текста по полям делает приложение (`apps/web/lib/ai/voice.ts`) через Ollama: переменные `OLLAMA_URL`
и `OLLAMA_VOICE_MODEL` (по умолчанию `qwen3:4b-instruct-2507-q4_K_M`). Mac выключен — облако с обезличиванием,
облако недоступно — текст вставляется без разбора. В браузере без сети работает распознавание телефона.

## Linux и видеокарта NVIDIA

Тот же сервер работает без Mac. Whisper тогда идёт через faster-whisper (CTranslate2, MIT). ffmpeg не нужен, аудио читает PyAV.
Нужны драйвер NVIDIA, CUDA 12 и cuDNN 9; без видеокарты модель работает на процессоре (int8, медленнее).

```
cd services/fast-ai
python3.11 -m venv .venv && .venv/bin/pip install -r requirements-voice-linux.txt
LAYA_MODEL=Krazher/laya-naryad FAST_AI_SECRET=секрет .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8787
```

`Krazher/laya-naryad` — пример id репозитория на Hugging Face с весами дообученной Laya (см. `LAYA_MODEL`).
Устройство для Whisper выбирается само: `cuda` с float16, если CTranslate2 видит видеокарту, иначе `cpu` с int8.
`GET /health` показывает выбранный движок и устройство (`whisper.backend`, `whisper.device`; до первого запроса устройство `auto`).

## Параллельность и очередь

К каждой модели одновременно идёт не больше `LAYA_WORKERS` / `WHISPER_WORKERS` запросов, остальные ждут в очереди.
Если в очереди уже `QUEUE_MAX` запросов или место не освободилось за `QUEUE_WAIT_S` секунд, сервер сразу отвечает
`503 {"busy": true}`. Приложение (`classify.ts`, `voice.ts`) считает любой не-200 ответ недоступностью и идёт по запасному пути.
В ответах есть `queue_ms` (сколько ждали) и `ms` (всё время обработки).

## Переменные окружения

| Переменная | По умолчанию | Что делает |
|---|---|---|
| `FAST_AI_SECRET` | нет (обязательна) | Секрет для заголовка `Authorization: Bearer ...` |
| `WHISPER_BACKEND` | `auto` | `mlx`, `faster` или `auto` (mlx на Mac с чипом M, если установлен `mlx_whisper`, иначе faster-whisper) |
| `WHISPER_MODEL` | `mlx-community/whisper-large-v3-turbo` для mlx, `large-v3-turbo` для faster | Модель Whisper (для проверки на слабой машине: `tiny`) |
| `WHISPER_WORKERS` | `1` для mlx, `2` для faster | Сколько распознаваний идёт одновременно (для faster это ещё и `num_workers` модели) |
| `LAYA_WORKERS` | `1` | Сколько классификаций идёт одновременно. Потокобезопасность модели не проверена, поэтому 1 |
| `QUEUE_MAX` | `4` | Сколько запросов может ждать очереди к одной модели |
| `QUEUE_WAIT_S` | `5` | Сколько секунд `/classify` ждёт своей очереди |
| `QUEUE_WAIT_VOICE_S` | `20` | То же для `/transcribe` |
| `LAYA_MODEL` | не задана | Веса Laya: локальная папка или id репозитория Hugging Face (скачивается через `huggingface_hub`) |
| `LAYA_HF_REPO` | не задана | Запасной id репозитория Hugging Face, если `LAYA_MODEL` не задана и локальной `finetune/laya-naryad/` нет |

Порядок выбора весов Laya: `LAYA_MODEL` → локальная `finetune/laya-naryad/` → `LAYA_HF_REPO` → базовая `laya-multilingual`.
