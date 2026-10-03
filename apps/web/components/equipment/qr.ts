import "server-only";
import QRCode from "qrcode";
import { equipmentIconPaths } from "./EquipmentIcon";

// QR-код с пиктограммой по центру. Уровень H восстанавливает до 30% повреждений,
// поэтому закрытая иконкой середина (около 5% площади) не мешает чтению.
export async function equipmentQrSvg({ url, type, size }: { url: string; type: string; size: number }): Promise<string> {
  const qr = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 1 });

  // Размер квадратов в qr-svg задаёт viewBox "0 0 N N". Рисуем в тех же единицах.
  const match = /viewBox="0 0 (\d+) \1"/.exec(qr);
  const n = match ? Number(match[1]) : 0;
  const body = qr.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

  const badge = n * 0.22; // белая подложка
  const icon = n * 0.16; // иконка внутри подложки
  const badgeXY = (n - badge) / 2;
  const iconXY = (n - icon) / 2;
  const scale = icon / 24; // иконка нарисована на сетке 24x24

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    body +
    `<rect x="${badgeXY}" y="${badgeXY}" width="${badge}" height="${badge}" rx="${badge * 0.2}" fill="#fff"/>` +
    `<g transform="translate(${iconXY} ${iconXY}) scale(${scale})" fill="none" stroke="#0f172a" ` +
    `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" shape-rendering="auto">${equipmentIconPaths(type)}</g>` +
    `</svg>`
  );
}
