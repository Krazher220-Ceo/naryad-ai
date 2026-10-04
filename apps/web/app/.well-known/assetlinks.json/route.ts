import { NextResponse } from "next/server";

// Связь сайта и Android-приложения (Trusted Web Activity). Без этого файла APK откроется
// с адресной строкой браузера. Отпечаток SHA-256 ключа подписи — в переменной окружения
// ANDROID_SHA256_FINGERPRINTS (через запятую), сам ключ в репозиторий не попадает.
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: process.env.ANDROID_PACKAGE_ID ?? "kz.naryadai.app",
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
