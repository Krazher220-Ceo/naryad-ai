-- 0006_hide_telegram_fields.sql — закрыть служебные поля Telegram от других сотрудников.
-- Справочник сотрудников читает любой вошедший. Но по чужому коду привязки можно
-- подключить свой Telegram к чужой учётной записи и получать её уведомления.
-- Поэтому читать можно только безопасные столбцы, а свой код — через функцию.

revoke select on employees from authenticated;
grant select (id, auth_user_id, login, full_name, role, specialty, grade, brigade, shift, on_shift, permits)
  on employees to authenticated;

-- Свой код привязки и признак, подключён ли Telegram.
create function my_telegram_link() returns table (link_code text, linked boolean)
language sql stable security definer set search_path = public as $$
  select telegram_link_code, telegram_chat_id is not null
  from employees where auth_user_id = auth.uid()
$$;

revoke execute on function my_telegram_link() from public, anon;
grant execute on function my_telegram_link() to authenticated;
