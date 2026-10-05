package kz.naryadai.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.io.ByteArrayOutputStream

object ImageUtils {
    fun compressImage(imageBytes: ByteArray, maxDimension: Int = 1600, quality: Int = 80): ByteArray {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, options)

        var sampleSize = 1
        val origMax = maxOf(options.outWidth, options.outHeight)
        while (origMax / sampleSize > maxDimension * 2) {
            sampleSize *= 2
        }

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = sampleSize
        }
        val originalBitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, decodeOptions)
            ?: return imageBytes

        val width = originalBitmap.width
        val height = originalBitmap.height
        val scale = if (maxOf(width, height) > maxDimension) {
            maxDimension.toFloat() / maxOf(width, height)
        } else {
            1.0f
        }

        val scaledBitmap = if (scale < 1.0f) {
            val targetW = (width * scale).toInt().coerceAtLeast(1)
            val targetH = (height * scale).toInt().coerceAtLeast(1)
            Bitmap.createScaledBitmap(originalBitmap, targetW, targetH, true)
        } else {
            originalBitmap
        }

        val outputStream = ByteArrayOutputStream()
        // Сжатие в JPEG 80 убирает EXIF метаданные и уменьшает размер
        scaledBitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
        return outputStream.toByteArray()
    }
}

object NetworkUtils {
    fun isOnline(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
