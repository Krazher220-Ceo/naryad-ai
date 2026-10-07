# SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
# © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
# без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
# Делает обучающие данные для Laya: просит DeepSeek написать реалистичные заявки мастера
# для каждой допустимой комбинации (шифр, специальность, приоритет). Метка = запрошенная комбинация.
# Описания из eval_set.jsonl в данные не попадают.
# Запуск: .venv/bin/python finetune/make_data.py   (ключ DEEPSEEK_API_KEY берётся из apps/web/.env.local)
import json
import random
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib import request

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = HERE / "data" / "train.jsonl"

CATEGORIES = {
    "М": "механика: подшипники, ремни, конвейерная лента, редукторы, износ, футеровка, крепёж, валы, уплотнения, вибрация, шум, трещины",
    "Э": "электрика: электродвигатель, кабель, питание, сработала защита, датчик, щит, искрение, КИП",
    "Г": "гидравлика: течь масла, гидронасос, рукав высокого давления, падение давления в гидросистеме",
    "П": "пневматика: утечка сжатого воздуха, пневмоцилиндр, засор пневмолинии, пневмоклапан",
    "С": "смазка: нет смазки, грязное масло, замена масла, система смазки, перегрев из-за плохой смазки",
}
PRIORITIES = {
    "emergency": "авария: оборудование остановлено или опасно (искры, дым, угроза травмы, крупная течь, линия стоит)",
    "high": "срочно: ещё работает, но быстро ухудшается (сильная вибрация, перегрев, растущая течь)",
    "normal": "обычный: мелкий дефект, может подождать в очереди",
    "planned": "плановый: ТО, осмотр, плановая смазка или замена по графику",
}
SPECIALTIES = {
    "слесарь": "слесарь (механика, гидравлика, пневматика, смазка)",
    "электрик": "электрик (двигатели, кабели, питание, датчики, щиты)",
    "сварщик": "сварщик (трещины, обломы и разрушение металлоконструкций, сварка)",
}
# Допустимые пары (шифр, специальность): электрика — электрик, сварка — только механические дефекты металла.
PAIRS = [("М", "слесарь"), ("М", "сварщик"), ("Э", "электрик"), ("Г", "слесарь"), ("П", "слесарь"), ("С", "слесарь")]
EQUIPMENT = ("дробилки, конвейеры, мельницы, насосы, грохоты, питатели, сушильные барабаны, компрессоры, "
             "флотомашины, гидроциклоны, вентиляторы, редукторы, электродвигатели")
CALLS_PER_COMBO = 2
PER_CALL = 20


def read_key():
    for line in (ROOT / "apps/web/.env.local").read_text().splitlines():
        if line.startswith("DEEPSEEK_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("нет DEEPSEEK_API_KEY в apps/web/.env.local")


KEY = read_key()


def ask(prompt):
    body = json.dumps({
        "model": "deepseek-flash",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "max_tokens": 6000,
        "temperature": 0.9,
    }).encode()
    req = request.Request("https://api.deepseek.com/chat/completions", body,
                          {"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"})
    with request.urlopen(req, timeout=180) as r:
        text = json.load(r)["choices"][0]["message"]["content"]
    items = json.loads(text)["items"]
    return [s.strip() for s in items if isinstance(s, str) and 8 <= len(s.strip()) <= 220]


def ask_retry(prompt):
    for attempt in range(2):
        try:
            got = ask(prompt)
            if got:
                return got
        except Exception as e:  # пустой ответ, плохой JSON, сеть
            print("  повтор:", type(e).__name__)
            time.sleep(2)
    return []


def make_prompt(cat, spec, prio, seed_words):
    return (
        f"Ты помогаешь делать обучающую выборку для системы нарядов на ремонт горно-обогатительного завода.\n"
        f"Напиши {PER_CALL} разных коротких заявок на ремонт на русском, как их пишет мастер смены с телефона: "
        f"1–2 предложения, местами сокращения и опечатки, разный стиль, без нумерации.\n"
        f"Оборудование для разнообразия: {EQUIPMENT}. Сделай акцент на: {seed_words}.\n"
        f"Каждая заявка по смыслу должна относиться к ровно такой комбинации:\n"
        f"- категория: {cat} — {CATEGORIES[cat]}\n"
        f"- приоритет: {prio} — {PRIORITIES[prio]}\n"
        f"- специальность исполнителя: {spec} — {SPECIALTIES[spec]}\n"
        f"Не упоминай слова «категория», «приоритет», «специальность» и сами коды. Не используй имена людей.\n"
        f'Ответ строго JSON: {{"items": ["...", "..."]}}'
    )


def norm(s):
    return re.sub(r"[^а-яёa-z0-9 ]", "", s.lower().replace("ё", "е")).strip()


def windows(s, n=6):
    w = norm(s).split()
    return {" ".join(w[i:i + n]) for i in range(max(1, len(w) - n + 1))} if len(w) >= n else set()


def test_cases():
    lines = (HERE.parent / "eval_set.jsonl").read_text(encoding="utf-8").splitlines()
    return [json.loads(line)["text"] for line in lines if line.strip()]


def main():
    tests = test_cases()
    test_norm = {norm(t) for t in tests}
    test_win = set().union(*(windows(t) for t in tests))
    rng = random.Random(1)
    focus = ["разное оборудование и узлы", "короткие сообщения с опечатками", "разные участки: дробление, помол, флотация, сушка",
             "ночная смена, спешка, разговорный стиль"]
    jobs = []
    for cat, spec in PAIRS:
        for prio in PRIORITIES:
            for _ in range(CALLS_PER_COMBO):
                jobs.append((cat, spec, prio, make_prompt(cat, spec, prio, rng.choice(focus))))
    print(f"запросов к DeepSeek: {len(jobs)}")
    with ThreadPoolExecutor(6) as pool:
        results = list(pool.map(lambda j: ask_retry(j[3]), jobs))

    seen, rows, dropped = set(), [], 0
    for (cat, spec, prio, _), items in zip(jobs, results):
        for text in items:
            n = norm(text)
            if n in seen or n in test_norm or windows(text) & test_win:
                dropped += 1
                continue
            seen.add(n)
            rows.append({"text": text, "category": cat, "priority": prio, "specialty": spec})
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
    print(f"записано {len(rows)} описаний (отброшено дублей и совпадений с тестом: {dropped}) в {OUT}")
    for k in ("category", "priority", "specialty"):
        print(k, dict(Counter(r[k] for r in rows)))
    print("пары:", dict(Counter((r["category"], r["specialty"]) for r in rows)))


if __name__ == "__main__":
    main()
