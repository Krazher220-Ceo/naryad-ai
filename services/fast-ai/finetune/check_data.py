# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# Проверяет новые синтетические данные (data/agy_*.jsonl, написаны Antigravity) и склеивает их с train.jsonl
# в train_v2.jsonl: проверка схемы и меток, удаление дублей (точных и почти), удаление всего, что похоже на eval_set.jsonl.
# Запуск: .venv/bin/python finetune/check_data.py
import difflib
import json
import re
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
CATEGORIES = ["М", "Э", "Г", "П", "С"]
PRIORITIES = ["emergency", "high", "normal", "planned"]
# Допустимые пары (шифр, специальность), как в make_data.py
PAIRS = [("М", "слесарь"), ("М", "сварщик"), ("Э", "электрик"), ("Г", "слесарь"), ("П", "слесарь"), ("С", "слесарь")]
SIMILAR = 0.85  # порог похожести (difflib) для почти-дублей и совпадений с тестом


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^а-яёәіңғүұқөһa-z0-9 ]", "", s.lower().replace("ё", "е"))).strip()


def similar(a, b):
    m = difflib.SequenceMatcher(None, a, b)
    return m.real_quick_ratio() > SIMILAR and m.quick_ratio() > SIMILAR and m.ratio() > SIMILAR


def windows(s, n=6):
    # Окна по 6 слов: ловит общий кусок фразы, даже если остальное отличается (как в make_data.py)
    w = s.split()
    return {" ".join(w[i:i + n]) for i in range(max(1, len(w) - n + 1))} if len(w) >= n else set()


def read(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def valid(row):
    return (isinstance(row, dict) and isinstance(row.get("text"), str) and 8 <= len(row["text"].strip()) <= 300
            and row.get("category") in CATEGORIES and row.get("priority") in PRIORITIES
            and (row["category"], row.get("specialty")) in PAIRS)


def main():
    old = read(DATA / "train.jsonl")
    tests = [norm(r["text"]) for r in read(HERE.parent / "eval_set.jsonl")]
    test_win = set().union(*(windows(t) for t in tests))
    kept_norm = [norm(r["text"]) for r in old]
    new, bad = [], Counter()
    for path in sorted(DATA.glob("agy_*.jsonl")):
        try:
            rows = read(path)
        except json.JSONDecodeError:
            raise SystemExit(f"{path.name}: невалидный JSON")
        for row in rows:
            if not valid(row):
                bad["схема или метки"] += 1
                continue
            row = {k: row[k] for k in ("text", "category", "priority", "specialty")}
            row["text"] = row["text"].strip()
            n = norm(row["text"])
            if n in tests or windows(n) & test_win or any(similar(n, t) for t in tests):
                bad["совпадение с eval_set"] += 1
            elif n in kept_norm or any(similar(n, k) for k in kept_norm):
                bad["дубль или почти дубль"] += 1
            else:
                kept_norm.append(n)
                new.append(row)
    merged = old + new
    out = DATA / "train_v2.jsonl"
    out.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in merged) + "\n", encoding="utf-8")
    print(f"старых {len(old)}, новых принято {len(new)}, отброшено {dict(bad)}; всего {len(merged)} -> {out}")
    for name, rows in (("новые", new), ("все", merged)):
        print(f"--- {name}")
        for k in ("category", "priority", "specialty"):
            print(" ", k, dict(Counter(r[k] for r in rows)))
        print("  комбинации:", dict(sorted(Counter((r["category"], r["specialty"], r["priority"]) for r in rows).items())))


if __name__ == "__main__":
    main()
