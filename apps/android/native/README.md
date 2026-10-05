# НарядAI: нативное Android-приложение исполнителя

Тонкий клиент веб-приложения «НарядAI» (Kotlin, Jetpack Compose). Правила — в разделе «Android-приложение» файла `AGENTS.md`.

Логики статусов, прав и подсчётов в приложении нет:

- **Чтение** идёт напрямую в Supabase (PostgREST) с токеном пользователя. Видимость строк решают правила доступа базы.
- **Действия** идут только через маршруты веб-приложения `/api/mobile/orders/{id}/transition|complete|photos` с заголовком `Authorization: Bearer <токен>`. Текст ошибки сервера показывается как есть.
- **Без сети** действия складываются в очередь на телефоне (`queue.json`, фото в `pending/`) и уходят сами, когда появится связь. У каждого нажатия свой `clientActionId` (UUID), при повторе он тот же, поэтому сервер не задублирует действие.
- Кэш последних нарядов и уведомлений лежит в настройках приложения: без сети показываем его и плашку «Нет связи».

## Экраны

Вход, Мои наряды, Наряд (история, фото, кнопки по статусу, пауза и отказ с причиной, проверка безопасности, «Нужна помощь»), Закрытие наряда (4 шага: что сделано, шифр, материалы, фото «после»), Уведомления, Профиль (язык Рус/Қаз, очередь отправки, выход). Все надписи — в `app/src/main/res/values/strings.xml` и `values-kk/strings.xml`.

Приложение только для роли «исполнитель». Если войдёт мастер или руководитель, вход покажет, что нужна веб-версия.

## Сборка одной командой

Нужны JDK 21 и Android SDK (платформа 35).

```bash
cd apps/android/native
cp local.properties.example local.properties   # один раз, затем заполнить (ниже)
./gradlew assembleDebug
```

APK: `apps/android/native/app/build/outputs/apk/debug/app-debug.apk`.

`local.properties` не попадает в репозиторий. В нём:

```properties
sdk.dir=/Users/<вы>/Library/Android/sdk
SUPABASE_URL=https://<проект>.supabase.co
SUPABASE_ANON_KEY=<публичный anon-ключ>
WEB_APP_URL=https://naryad-ai.vercel.app
```

Ключ `service_role` сюда не кладут никогда: приложению нужен только публичный anon-ключ.

## Установка на телефон

1. На телефоне включить «Для разработчиков», затем «Отладка по USB».
2. Подключить кабелем и выполнить:
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
   Или скопировать `app-debug.apk` на телефон и открыть его (разрешить установку из этого источника).
3. Для эмулятора: `adb install -r ...` на запущенный эмулятор, дальше так же.

Демо-вход исполнителя: логин `worker1` (пароль в `supabase/seed.sql`). Приложение превращает логин в `worker1@naryad.local`.

## Структура

```
apps/android/native/
├── settings.gradle.kts, build.gradle.kts, gradle.properties, gradle/libs.versions.toml, gradlew
└── app/src/main/
    ├── java/kz/naryadai/app/
    │   ├── MainActivity.kt, NaryadApp.kt   запуск, язык, общие объекты (Graph)
    │   ├── data/   Models (строки базы), Session (токены, кэш), Api (HTTP), Repository (данные и очередь)
    │   ├── util/   ImageUtils (1600 px, JPEG 80, без EXIF), Format (время)
    │   └── ui/     AppRoot (навигация и нижнее меню), screens/, components/, theme/
    └── res/        strings (ru, kk), шрифты Inter и Oswald, значки
```

## Что не сделано

- Реальное время по websocket: вместо него обновление каждые 20 с на экране и по возвращению в приложение.
- Диктовка «что сделано»: маршрут `/api/voice` пока принимает только вход по cookie сайта, для токена приложения он не готов.
- Подпись релизного APK: ключ подписи не хранится в репозитории (`*.keystore` в `.gitignore`).
