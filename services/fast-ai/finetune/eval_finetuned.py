# Сравнение на тех же 20 тестовых описаниях из eval.py: Laya без дообучения и после дообучения.
# Тест рукописный и в обучение не попадает. Запуск: .venv/bin/python finetune/eval_finetuned.py
import ast
import re
import sys
import time
from pathlib import Path

from laya import Agent, Router

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from questions import QUESTIONS  # noqa: E402

KEYS = ["category", "priority", "specialty"]
# Берём CASES из eval.py как текст, чтобы не запускать его тест при импорте
CASES = ast.literal_eval(re.search(r"^CASES = (\[.*?^\])", (HERE.parent / "eval.py").read_text(), re.S | re.M).group(1))


def run(name, predict):
    predict("прогрев")
    hits = {k: 0 for k in KEYS}
    conf = {k: 0.0 for k in KEYS}
    wrong = []  # (уверенность, вопрос, текст, ответ, нужно)
    total = 0.0
    for text, *gold in CASES:
        t0 = time.perf_counter()
        answers = predict(text)
        total += time.perf_counter() - t0
        for k, exp in zip(KEYS, gold):
            a = answers[k]
            p = a["probabilities"][a["choice"]]
            conf[k] += p
            if a["choice"] == exp:
                hits[k] += 1
            else:
                wrong.append((p, k, text, a["choice"], exp))
    n = len(CASES)
    print(f"\n=== {name} ===")
    for k in KEYS:
        print(f"  {k}: {hits[k]}/{n} ({round(hits[k] / n * 100)}%), средняя уверенность {conf[k] / n:.2f}")
    print(f"  среднее время вызова: {round(total / n * 1000)} мс")
    print("  самые уверенные ошибки:")
    for p, k, text, got, exp in sorted(wrong, reverse=True)[:4]:
        print(f"    {p:.2f} {k}: «{text[:60]}» -> {got} (нужно {exp})")


router = Router()
run("Без дообучения (multilingual, вопросы по-английски)",
    lambda t: router.predict(t, QUESTIONS, model="multilingual")["answers"])

tuned = HERE / "laya-naryad"
if tuned.exists():
    agent = Agent(str(tuned))
    run("После дообучения (laya-naryad)", lambda t: agent.predict(t, QUESTIONS)["answers"])
else:
    print("\nНет finetune/laya-naryad: сначала запусти train_mps.py")
