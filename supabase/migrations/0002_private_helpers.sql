-- 0002_private_helpers.sql — убрать служебные функции из публичного API.
-- Функции из схемы public доступны как /rest/v1/rpc/*. Переносим их в схему app,
-- которую API не отдаёт. Правила доступа ссылаются на функции по ссылке, а не по имени,
-- поэтому продолжают работать.

create schema if not exists app;
grant usage on schema app to authenticated;

alter function public.auth_employee_id() set schema app;
alter function public.auth_role() set schema app;
alter function public.can_see_order(uuid) set schema app;

revoke execute on function app.auth_employee_id() from public, anon;
revoke execute on function app.auth_role() from public, anon;
revoke execute on function app.can_see_order(uuid) from public, anon;
grant execute on function app.auth_employee_id() to authenticated;
grant execute on function app.auth_role() to authenticated;
grant execute on function app.can_see_order(uuid) to authenticated;

alter function public.forbid_event_changes() set search_path = public;
