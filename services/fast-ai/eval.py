# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# Тест базовой Laya (без дообучения) на eval_set.jsonl: точность по полям и матрица ошибок приоритета.
# Набор синтетический, правильные ответы записаны заранее. Запуск: .venv/bin/python eval.py
from laya import Router

from evalkit import report
from questions import QUESTIONS

router = Router()
report("Без дообучения (multilingual)", lambda t: router.predict(t, QUESTIONS, model="multilingual")["answers"])
