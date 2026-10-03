// Скачать веса Laya (~1,7 ГБ) в кэш ~/.cache/receptron-laya. Запускается один раз.
import { Laya } from "@receptron/laya";

let lastPct = -1;
const laya = await Laya.load({
  onProgress: ({ file, received, total }) => {
    if (!total) return;
    const pct = Math.floor((received / total) * 100);
    if (pct !== lastPct && pct % 5 === 0) {
      lastPct = pct;
      console.log(`${file}: ${pct}%`);
    }
  },
});
console.log("Laya загружена");
await laya.close();
