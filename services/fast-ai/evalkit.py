# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# Общий код оценки Laya: загрузка eval_set.jsonl и отчёт (точность по полям и матрица ошибок приоритета).
# Описания в eval_set.jsonl синтетические (написаны вручную для демонстрации), не реальные заявки завода.
import json
import time
from collections import Counter
from pathlib import Path

KEYS = ["category", "priority", "specialty"]
PRIORITIES = ["emergency", "high", "normal", "planned"]
EVAL_SET = Path(__file__).resolve().parent / "eval_set.jsonl"


def load_cases():
    return [json.loads(line) for line in EVAL_SET.read_text(encoding="utf-8").splitlines() if line.strip()]


def report(name, predict, cases=None):
    """predict(text) -> {"category": {...}, "priority": {...}, "specialty": {...}} в формате ответов Laya."""
    cases = cases or load_cases()
    predict("прогрев")
    hits = {k: Counter() for k in KEYS}  # верные ответы по языкам
    seen = Counter()
    conf = {k: 0.0 for k in KEYS}
    confusion = Counter()  # (нужно, получено) для приоритета
    wrong = []  # (уверенность, поле, текст, ответ, нужно)
    total = 0.0
    for case in cases:
        t0 = time.perf_counter()
        answers = predict(case["text"])
        total += time.perf_counter() - t0
        seen[case["lang"]] += 1
        for k in KEYS:
            a = answers[k]
            p = a["probabilities"][a["choice"]]
            conf[k] += p
            if a["choice"] == case[k]:
                hits[k][case["lang"]] += 1
            else:
                wrong.append((p, k, case["text"], a["choice"], case[k]))
            if k == "priority":
                confusion[(case[k], a["choice"])] += 1
    n = len(cases)
    print(f"\n=== {name} === ({n} описаний: " + ", ".join(f"{lang} {c}" for lang, c in sorted(seen.items())) + ")")
    for k in KEYS:
        ok = sum(hits[k].values())
        by_lang = ", ".join(f"{lang} {hits[k][lang]}/{seen[lang]}" for lang in sorted(seen))
        print(f"  {k}: {ok}/{n} ({round(ok / n * 100)}%), средняя уверенность {conf[k] / n:.2f}  [{by_lang}]")
    print(f"  среднее время вызова: {round(total / n * 1000)} мс")
    print("  матрица приоритета (строка — нужно, столбец — ответ):")
    print("    " + " " * 10 + "".join(f"{p[:6]:>8}" for p in PRIORITIES))
    for want in PRIORITIES:
        print(f"    {want:10}" + "".join(f"{confusion[(want, got)]:>8}" for got in PRIORITIES))
    print("  самые уверенные ошибки:")
    for p, k, text, got, exp in sorted(wrong, reverse=True)[:5]:
        print(f"    {p:.2f} {k}: «{text[:60]}» -> {got} (нужно {exp})")
