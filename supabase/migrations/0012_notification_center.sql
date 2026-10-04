-- 0012_notification_center.sql — центр уведомлений в приложении и настройки уведомлений (M6).
-- 1. Отметка «прочитано» у уведомления и функция «Прочитать все».
-- 2. Настройки: какие события не слать в Telegram и тихие часы. В приложении видно всё.
-- 3. Отвязать Telegram от своей учётной записи (новый код привязки выдаётся сразу).

-- ============================================================
-- 1. Прочитано
-- ============================================================
alter table notifications add column read_at timestamptz;

-- Счётчик на колокольчике: непрочитанные уведомления сотрудника.
create index notifications_unread_idx on notifications(employee_id, created_at desc) where read_at is null;

-- Отметить свои уведомления прочитанными. p_ids = null — все сразу.
-- Чужие уведомления не трогаются, даже если мастер их видит по правилу чтения.
create function mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  update notifications
     set read_at = now()
   where employee_id = app.auth_employee_id()
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function mark_notifications_read(uuid[]) from public, anon;
grant execute on function mark_notifications_read(uuid[]) to authenticated;

-- Колокольчик обновляется без перезагрузки страницы.
alter publication supabase_realtime add table notifications;

-- ============================================================
-- 2. Настройки уведомлений
-- ============================================================
-- Одна строка на сотрудника. Нет строки — значит всё включено, тихих часов нет.
create table notification_prefs (
  employee_id          uuid primary key references employees(id) on delete cascade,
  telegram_off_kinds   notification_kind[] not null default '{}',  -- эти события не уходят в Telegram
  quiet_from           time,                                       -- тихие часы: Telegram молчит
  quiet_to             time,
  updated_at           timestamptz not null default now(),
  constraint quiet_both check ((quiet_from is null) = (quiet_to is null))
);

alter table notification_prefs enable row level security;

-- Сотрудник читает только свои настройки. Пишет через функцию ниже.
create policy read_own_prefs on notification_prefs
  for select to authenticated
  using (employee_id = app.auth_employee_id());

create function save_notification_prefs(
  p_telegram_off_kinds notification_kind[],
  p_quiet_from time,
  p_quiet_to time
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := app.auth_employee_id();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  insert into notification_prefs (employee_id, telegram_off_kinds, quiet_from, quiet_to, updated_at)
  values (v_me, coalesce(p_telegram_off_kinds, '{}'), p_quiet_from, p_quiet_to, now())
  on conflict (employee_id) do update
    set telegram_off_kinds = excluded.telegram_off_kinds,
        quiet_from = excluded.quiet_from,
        quiet_to = excluded.quiet_to,
        updated_at = now();
end;
$$;

revoke execute on function save_notification_prefs(notification_kind[], time, time) from public, anon;
grant execute on function save_notification_prefs(notification_kind[], time, time) to authenticated;

-- ============================================================
-- 3. Отвязать Telegram
-- ============================================================
-- Чат забывается, код привязки меняется: старая ссылка больше не подключит чужой чат.
create function unlink_telegram() returns void
language sql security definer set search_path = public as $$
  update employees
     set telegram_chat_id = null,
         telegram_link_code = encode(extensions.gen_random_bytes(6), 'hex')
   where id = app.auth_employee_id()
$$;

revoke execute on function unlink_telegram() from public, anon;
grant execute on function unlink_telegram() to authenticated;
