// SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
// © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
// без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
package kz.naryadai.app.util

// dHash 64 бита (16 hex-символов). Тот же алгоритм, что в apps/web/lib/ai/phash.ts:
// картинка 9x8 -> яркость 0.299R + 0.587G + 0.114B -> в каждой строке «левый ярче правого» = 1.
// Без классов Android, чтобы функцию можно было проверить отдельно.
object PerceptualHash {
    const val WIDTH = 9
    const val HEIGHT = 8

    // pixels — 72 пикселя ARGB по строкам (как Bitmap.getPixels).
    fun fromPixels(pixels: IntArray): String {
        val gray = DoubleArray(WIDTH * HEIGHT) {
            val p = pixels[it]
            0.299 * ((p shr 16) and 0xFF) + 0.587 * ((p shr 8) and 0xFF) + 0.114 * (p and 0xFF)
        }
        val sb = StringBuilder()
        for (y in 0 until HEIGHT) {
            var byte = 0
            for (x in 0 until WIDTH - 1) {
                byte = (byte shl 1) or (if (gray[y * WIDTH + x] > gray[y * WIDTH + x + 1]) 1 else 0)
            }
            sb.append("%02x".format(byte))
        }
        return sb.toString()
    }
}
