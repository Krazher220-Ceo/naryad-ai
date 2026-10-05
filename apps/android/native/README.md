# НарядAI — Нативный Android-клиент (Kotlin + Jetpack Compose)

Нативный тонкий клиент системы нарядов на ремонт «НарядAI» для АО «Костанайские минералы».
Разработан в соответствии с разделом «Android-приложение» в `AGENTS.md`.

## Архитектура и принципы

- **Тонкий клиент**: никакой бизнес-логики в приложении. Переходы статусов, валидация прав, начисление рейтинга и аналитика выполняются сервером и базой Supabase.
- **Действия**: отправляются исключительно через HTTP-маршруты `/api/mobile/orders/{id}/...` с Bearer-токеном сессии. Приложение генерирует постоянный `clientActionId` (UUID) для идемпотентности.
- **Офлайн-режим**: локальная база данных Room кэширует наряды, события и фото. При отсутствии сети действия сохраняются в очередь `offline_actions` и отправляются при восстановлении подключения.
- **Интерфейс для работы в перчатках**:
  - Высота интерактивных кнопок не менее 56 dp.
  - Главное действие размещено внизу экрана.
  - Фирменные цвета км.кз: тёмно-синий `#0B2A5B`, акцентный жёлтый `#F5C400`, аварийный красный.
  - Полная поддержка двух языков: Русский (`ru`) и Қазақша (`kk`).

## Структура проекта

```
apps/android/native/
├── build.gradle.kts           # Конфигурация модуля Android, зависимости, BuildConfig
├── local.properties.example   # Шаблон настроек подключения к Supabase и веб-серверу
├── README.md                  # Данная инструкция
└── src/main/
    ├── AndroidManifest.xml    # Разрешения сети, камеры, микрофона, активности
    ├── java/kz/naryadai/app/
    │   ├── MainActivity.kt
    │   ├── NaryadApplication.kt
    │   ├── data/
    │   │   ├── local/         # Room Database, DAOs, SessionManager
    │   │   ├── model/         # Модели данных (WorkOrder, Event, Photo, OfflineAction)
    │   │   ├── remote/        # SupabaseManager, MobileApiClient (Ktor)
    │   │   └── repository/    # OrderRepository (синхронизация, офлайн-очередь)
    │   ├── ui/
    │   │   ├── components/    # Бейджи статусов и приоритетов, баннер офлайна, ReasonBottomSheet
    │   │   ├── navigation/    # NavGraph, Bottom Navigation
    │   │   ├── screens/       # Login, Orders, OrderDetail, CompleteOrder, Notifications, Profile
    │   │   └── theme/         # Цветовая палитра km.kz, Material 3 Theme
    │   └── util/              # ImageUtils (сжатие 1600px, JPEG 80, EXIF strip), NetworkUtils
    └── res/
        ├── values/strings.xml      # Русская локализация
        ├── values-kk/strings.xml   # Казахская локализация
        ├── drawable/               # Векторные ресурсы и иконки
        └── mipmap-*/               # Адаптивные и растровые иконки приложения
```

## Настройка окружения

1. Скопируйте `local.properties.example` в `local.properties`:
   ```bash
   cp local.properties.example local.properties
   ```
2. Укажите ваши ключи Supabase:
   ```properties
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   WEB_APP_URL=https://naryad-ai.vercel.app
   ```

## Сборка APK

Для сборки требуются JDK 21 и Android SDK (API 35/36):

```bash
# Сборка отладочного APK
gradle :app:assembleDebug

# Готовый файл будет находиться по пути:
# apps/android/native/build/outputs/apk/debug/app-debug.apk
```
