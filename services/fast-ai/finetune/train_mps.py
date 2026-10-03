# Дообучение Laya (multilingual) на одном Mac (MPS). Адаптация скрипта авторов из Kaggle без DDP.
# Для каждого описания строим 3 примера (категория, приоритет, специальность) по вопросам из questions.py.
# Потеря: RLCD (policy gradient с proper_reward) + мягкая кросс-энтропия, как в оригинале.
# Запуск: .venv/bin/python finetune/train_mps.py [EPOCHS]
import json
import os
import random
import shutil
import sys
import time
from pathlib import Path

import torch
from huggingface_hub import snapshot_download
from safetensors.torch import load_file, save_file

from laya.agent import _fix_tokenizer_config, _load_tokenizer
from laya.common import QTYPES, TEMP_MAX, TEMP_MIN, build_model, build_sequence, proper_reward, render_options

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from questions import QUESTIONS  # noqa: E402

DATA = HERE / "data" / "train.jsonl"
OUT = HERE / "laya-naryad"
LOG = HERE / "train.log"

EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
MICRO_BATCH = 8
GRAD_ACCUM = 4          # эффективный батч 32
GROUP_SIZE = 4          # число шумовых сэмплов для RLCD
LR_ENCODER = 2.5e-5
LR_HEAD = 1.0e-4
SIGMA_START, SIGMA_END = 0.4, 0.1
SMOOTH = 0.9            # вес верного варианта, остальное делится поровну
MAX_LEN = 512           # описания короткие, 512 с запасом
CALIB_FRACTION = 0.10


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def base_dir():
    root = snapshot_download("convaiinnovations/laya", allow_patterns=["multilingual/*"], local_files_only=True)
    return os.path.join(root, "multilingual")


def build_items(rows, tok, cfg):
    # По одному примеру на вопрос; цель — почти one-hot с лёгким сглаживанием.
    items = []
    for row in rows:
        for qid, q in QUESTIONS.items():
            keys = list(q["criteria"].keys())
            k = len(keys)
            label = keys.index(row[qid])
            target = [(1 - SMOOTH) / (k - 1)] * k
            target[label] = SMOOTH
            spec = {"t": q["type"], "ins": q["instructions"], "crit": q["criteria"]}
            seq, markers = build_sequence(tok, row["text"], spec, MAX_LEN, cfg["head_max_len"])
            if len(markers) != len(render_options({"t": q["type"], "crit": q["criteria"]})):
                continue
            items.append({"ids": seq, "markers": markers, "qtype": QTYPES[q["type"]], "target": target, "label": label})
    return items


def collate(items, pad_id):
    n, L = len(items), max(len(it["ids"]) for it in items)
    kmax = max(len(it["markers"]) for it in items)
    ids = torch.full((n, L), pad_id, dtype=torch.long)
    att = torch.zeros((n, L), dtype=torch.long)
    mpos = torch.zeros((n, kmax), dtype=torch.long)
    mmask = torch.zeros((n, kmax), dtype=torch.bool)
    target = torch.zeros((n, kmax), dtype=torch.float32)
    for i, it in enumerate(items):
        ids[i, : len(it["ids"])] = torch.tensor(it["ids"])
        att[i, : len(it["ids"])] = 1
        k = len(it["markers"])
        mpos[i, :k] = torch.tensor(it["markers"])
        mmask[i, :k] = True
        target[i, :k] = torch.tensor(it["target"])
    return {"input_ids": ids, "attention_mask": att, "marker_pos": mpos, "marker_mask": mmask,
            "target": target, "qtype": torch.tensor([it["qtype"] for it in items])}


def fit_one_temp(sel):
    # Температура, минимизирующая кросс-энтропию на отложенных примерах.
    if len(sel) < 10:
        return 1.0
    kmax = max(len(z) for z, _ in sel)
    Z = torch.full((len(sel), kmax), -1e4)
    T = torch.zeros((len(sel), kmax))
    for i, (z, t) in enumerate(sel):
        Z[i, : len(z)] = torch.tensor(z)
        T[i, : len(t)] = torch.tensor(t, dtype=torch.float32)
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)

    def closure():
        opt.zero_grad()
        loss = -(T * torch.log_softmax(Z / log_t.exp(), -1)).sum(-1).mean()
        loss.backward()
        return loss

    opt.step(closure)
    return float(torch.clamp(log_t.exp(), TEMP_MIN, TEMP_MAX).item())


def main():
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    mdir = base_dir()
    _fix_tokenizer_config(mdir)
    cfg = json.load(open(os.path.join(mdir, "rl_agent_config.json")))
    tok = _load_tokenizer(os.path.join(mdir, "tokenizer"), cfg)
    log(f"устройство {device}, база {mdir}")

    rows = [json.loads(line) for line in DATA.read_text().splitlines() if line.strip()]
    random.Random(20261003).shuffle(rows)
    n_calib = max(10, int(len(rows) * CALIB_FRACTION))
    calib_items = build_items(rows[:n_calib], tok, cfg)    # отложены целиком по описаниям
    train_items = build_items(rows[n_calib:], tok, cfg)
    log(f"описаний {len(rows)}: обучение {len(rows) - n_calib}, калибровка {n_calib}; примеров {len(train_items)} / {len(calib_items)}")

    model = build_model(cfg, encoder_dir=os.path.join(mdir, "encoder"), pretrained=False)
    model.load_state_dict(load_file(os.path.join(mdir, "model.safetensors")), strict=True)
    model.encoder.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.head_checkpointing = True
    # Таблица слов (~197M параметров) заморожена: экономит память и время, а язык модель уже знает.
    for n, p in model.named_parameters():
        if "embeddings.tok_embeddings" in n:
            p.requires_grad = False
    model.to(device)
    model.train()

    enc = [p for n, p in model.named_parameters() if "encoder." in n and p.requires_grad]
    head = [p for n, p in model.named_parameters() if "encoder." not in n]
    log(f"обучаемых параметров: энкодер {sum(p.numel() for p in enc)/1e6:.0f}M, голова {sum(p.numel() for p in head)/1e6:.1f}M")
    opt = torch.optim.AdamW([{"params": enc, "lr": LR_ENCODER}, {"params": head, "lr": LR_HEAD}], weight_decay=0.01)
    updates_per_epoch = max(1, len(train_items) // (MICRO_BATCH * GRAD_ACCUM))
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=updates_per_epoch * EPOCHS, eta_min=1e-6)

    t0 = time.time()
    step = 0
    for epoch in range(EPOCHS):
        random.Random(42 + epoch).shuffle(train_items)
        sigma = SIGMA_START + (SIGMA_END - SIGMA_START) * epoch / max(1, EPOCHS - 1)
        total, nb, accum = 0.0, 0, 0
        opt.zero_grad(set_to_none=True)
        for b in range(0, len(train_items), MICRO_BATCH):
            batch = collate(train_items[b:b + MICRO_BATCH], tok.pad_token_id)
            dev = {k: v.to(device) for k, v in batch.items()}
            logits, act = model(dev["input_ids"], dev["attention_mask"], dev["marker_pos"], dev["marker_mask"], dev["qtype"])
            logits = logits.float()
            mask, target = dev["marker_mask"], dev["target"]
            k = mask.sum(-1, keepdim=True).float()
            # RLCD: шумовые варианты распределения, награда по proper_reward, преимущество относительно среднего
            eps = torch.randn((GROUP_SIZE,) + logits.shape, device=device) * sigma * mask
            eps = (eps - eps.sum(-1, keepdim=True) / k) * mask
            z = logits.detach().unsqueeze(0) + eps
            q = torch.softmax(z.masked_fill(~mask, -1e4), -1)
            with torch.no_grad():
                r = proper_reward(q, target.unsqueeze(0), dev["qtype"], mask, w_sph=0.75, w_rps=1.0)
                adv = r - r.mean(0, keepdim=True)
                adv = adv / (adv.std() + 1e-6)
            logp = -(((z - logits.unsqueeze(0)) ** 2) * mask).sum(-1) / (2 * sigma ** 2)
            loss_rl = -(adv * logp).mean()
            loss_ce = -(target * torch.log_softmax(logits.masked_fill(~mask, -1e4), -1)).sum(-1).mean()
            loss = (loss_rl + loss_ce) / GRAD_ACCUM + 0.0 * act.sum()
            loss.backward()
            accum += 1
            if accum % GRAD_ACCUM == 0 or b + MICRO_BATCH >= len(train_items):
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step()
                sched.step()
                opt.zero_grad(set_to_none=True)
            total += loss.item() * GRAD_ACCUM
            nb += 1
            step += 1
            if step % 25 == 0:
                log(f"эпоха {epoch+1}/{EPOCHS} шаг {step} | loss {loss.item()*GRAD_ACCUM:.4f} (ce {loss_ce.item():.4f}) | reward {r.mean().item():.3f} | {time.time()-t0:.0f} с")
        log(f"=== эпоха {epoch+1}/{EPOCHS} готова за {time.time()-t0:.0f} с, средняя loss {total/max(1,nb):.4f}")

    # Калибровка температур на отложенных описаниях
    model.eval()
    preds, correct = [], 0
    with torch.no_grad():
        for c in range(0, len(calib_items), 16):
            chunk = calib_items[c:c + 16]
            cb = {k: v.to(device) for k, v in collate(chunk, tok.pad_token_id).items()}
            lg, _ = model(cb["input_ids"], cb["attention_mask"], cb["marker_pos"], cb["marker_mask"], cb["qtype"])
            lg = lg.float().cpu().numpy()
            for i, it in enumerate(chunk):
                z = lg[i, : len(it["markers"])]
                correct += int(z.argmax() == it["label"])
                preds.append((it["qtype"], z, it["target"]))
    log(f"точность на отложенных описаниях (калибровка): {correct}/{len(calib_items)} = {correct/len(calib_items):.3f}")
    temps = [1.0, 1.0, 1.0]
    sel = [(z, t) for qt, z, t in preds if qt == QTYPES["choice"]]
    temps[QTYPES["choice"]] = fit_one_temp(sel)
    log(f"температуры (choice, score, noul): {[round(t, 3) for t in temps]}")

    # Сохраняем в той же раскладке, что и базовый чекпойнт
    OUT.mkdir(exist_ok=True)
    sd = {k: v.half().contiguous().cpu() for k, v in model.state_dict().items()}
    save_file(sd, str(OUT / "model.safetensors"))
    for sub in ("encoder", "tokenizer"):
        shutil.rmtree(OUT / sub, ignore_errors=True)
        shutil.copytree(os.path.join(mdir, sub), OUT / sub)
    cfg["fine_tuned"] = True
    cfg["model_name"] = "laya-naryad"
    cfg["temperature"] = temps
    cfg.pop("temperature_by_options", None)
    cfg["training"] = {"epochs_completed": EPOCHS, "examples": len(train_items), "seconds": round(time.time() - t0)}
    json.dump(cfg, open(OUT / "rl_agent_config.json", "w"), indent=2, ensure_ascii=False)
    log(f"сохранено в {OUT}, всего {time.time()-t0:.0f} с")


if __name__ == "__main__":
    main()
