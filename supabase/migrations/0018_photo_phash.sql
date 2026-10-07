-- SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
-- © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
-- без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.

-- Перцептивный хеш dHash (64 бита, 16 hex-символов) для поиска повторных фото
-- после обрезки, сжатия и изменения размера. Колонка есть ещё в 0001_init.sql;
-- if not exists делает миграцию безопасной на любой базе.
alter table photos add column if not exists phash text;

-- Только строки с хешем: старые фото без phash пропускаем.
create index if not exists photos_phash_idx on photos(phash) where phash is not null;
-- Поиск похожих фото идёт по свежим снимкам.
create index if not exists photos_created_phash_idx on photos(created_at desc) where phash is not null;
