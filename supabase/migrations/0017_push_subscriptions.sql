-- 0017_push_subscriptions.sql — подписки на системные push-уведомления браузера (Web Push, VAPID).
-- Одно устройство или браузер = одна строка. Сотрудник видит, добавляет и удаляет только свои подписки.
-- Отправляет сервер служебным ключом (lib/notify/push.ts), он правила доступа обходит.

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index push_subscriptions_employee_idx on push_subscriptions(employee_id);

alter table push_subscriptions enable row level security;

create policy read_own_push on push_subscriptions
  for select to authenticated
  using (employee_id = app.auth_employee_id());

create policy insert_own_push on push_subscriptions
  for insert to authenticated
  with check (employee_id = app.auth_employee_id());

create policy delete_own_push on push_subscriptions
  for delete to authenticated
  using (employee_id = app.auth_employee_id());
