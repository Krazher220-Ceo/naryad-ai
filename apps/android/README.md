# Android-приложение НарядAI (TWA)

Приложение — оболочка Trusted Web Activity над тем же веб-приложением `https://naryad-ai.vercel.app`.
Своей логики в нём нет: вход, права, переходы статусов и проверки работают на сервере и в базе,
а данные синхронизируются со всеми клиентами через одну базу и Realtime (AGENTS.md, «Android-приложение»).

## Что лежит здесь

- `twa-manifest.json` — настройки сборки Bubblewrap: пакет `kz.naryadai.app`, цвета km.kz, иконки из `public/icons`,
  ярлык «Сообщить о поломке».
- Ключ подписи (`*.keystore`) и сгенерированный Android-проект в репозиторий не попадают (`.gitignore`).

## Сборка APK

Нужны Node.js 20+. JDK 17 и Android SDK Bubblewrap скачает сам при первом запуске.

```bash
npm i -g @bubblewrap/cli
cd apps/android
bubblewrap update            # создаёт Android-проект по twa-manifest.json
bubblewrap build             # спросит пароль ключа; при первом запуске создаст naryad-release.keystore
```

Готовые файлы: `app-release-signed.apk` (для установки и сдачи) и `app-release-bundle.aab` (для Google Play).

## Связь сайта и приложения

Чтобы приложение открывалось без адресной строки браузера, сайт должен подтвердить ключ подписи:

```bash
keytool -list -v -keystore naryad-release.keystore -alias naryad | grep SHA256
```

Отпечаток (вида `AB:CD:...`) положить в переменную `ANDROID_SHA256_FINGERPRINTS` на Vercel
(несколько — через запятую). Маршрут `apps/web/app/.well-known/assetlinks.json` отдаст его по адресу
`https://naryad-ai.vercel.app/.well-known/assetlinks.json`. Проверка: `bubblewrap validate --url=https://naryad-ai.vercel.app`.

## Уведомления

В TWA работают те же уведомления, что в браузере: центр уведомлений в приложении и Telegram.
`enableNotifications: true` разрешает приложению показывать уведомления Android от имени сайта.
