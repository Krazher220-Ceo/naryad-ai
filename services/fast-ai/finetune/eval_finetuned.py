# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# Сравнение на eval_set.jsonl: Laya без дообучения и после дообучения.
# Набор синтетический и в обучение не попадает (make_data.py убирает совпадения с ним).
# Запуск: .venv/bin/python finetune/eval_finetuned.py [путь к папке дообученной модели]
import sys
from pathlib import Path

from laya import Agent, Router

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from evalkit import report  # noqa: E402
from questions import QUESTIONS  # noqa: E402

router = Router()
report("Без дообучения (multilingual)", lambda t: router.predict(t, QUESTIONS, model="multilingual")["answers"])

tuned = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "laya-naryad"
if tuned.exists():
    agent = Agent(str(tuned))
    report("После дообучения (laya-naryad)", lambda t: agent.predict(t, QUESTIONS)["answers"])
else:
    print("\nНет finetune/laya-naryad: сначала запусти train_mps.py")
