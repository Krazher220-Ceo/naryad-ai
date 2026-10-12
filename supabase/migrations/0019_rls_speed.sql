-- SPDX-License-Identifier: LicenseRef-NaryadAI-NonCommercial
-- © 2026 команда «НарядAI»: Алихан, Бауыржан, Али, Тамерлан. Только для проверки и обучения,
-- без коммерческого использования. Полные условия — файл LICENSE в корне репозитория.
--
-- Ускорение правил доступа (RLS). Права не меняются, меняется только то, как часто считаются проверки.
--
-- Было: app.auth_employee_id(), app.auth_role() и app.can_see_order() вызывались для КАЖДОЙ строки.
-- Это функции SECURITY DEFINER, Postgres не может встроить их в запрос, и каждая делает подзапрос
-- к employees. Подсчёт непрочитанных уведомлений (~10 тыс. строк) занимал больше секунды на каждой странице.
--
-- Стало:
-- 1. (select app.auth_role()) — Postgres считает такой подзапрос один раз на весь запрос (initPlan).
-- 2. Мастер и руководитель видят всё, поэтому для них проверка роли стоит первой и дорогая
--    can_see_order по строкам не нужна.
-- 3. Наряды проверяются прямо по полям строки, без повторного чтения work_orders внутри функции.

create or replace function app.auth_brigade()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select brigade from employees where auth_user_id = auth.uid()
$$;

grant execute on function app.auth_brigade() to authenticated;

-- Уведомления, настройки, подписки на push: только свои (мастер и руководитель видят все уведомления).
alter policy read_notifications on notifications using (
  employee_id = (select app.auth_employee_id())
  or (select app.auth_role()) in ('master', 'lead')
);
alter policy read_own_prefs on notification_prefs using (employee_id = (select app.auth_employee_id()));
alter policy read_own_push on push_subscriptions using (employee_id = (select app.auth_employee_id()));
alter policy delete_own_push on push_subscriptions using (employee_id = (select app.auth_employee_id()));
alter policy insert_own_push on push_subscriptions with check (employee_id = (select app.auth_employee_id()));

-- Отчёты и заявки.
alter policy read_report_snapshots on report_snapshots using ((select app.auth_role()) in ('master', 'lead'));
alter policy read_requests on requests using (
  created_by = (select app.auth_employee_id())
  or (select app.auth_role()) in ('master', 'lead')
);
alter policy insert_requests on requests with check (created_by = (select app.auth_employee_id()));

-- Наряд виден мастеру и руководителю, своему исполнителю и бригаде, если исполнитель ещё не назначен.
-- То же условие, что в app.can_see_order, но по полям самой строки.
alter policy read_work_orders on work_orders using (
  (select app.auth_role()) in ('master', 'lead')
  or assignee_id = (select app.auth_employee_id())
  or (assignee_id is null and brigade = (select app.auth_brigade()))
);

-- Таблицы при наряде: мастер и руководитель сразу, остальным — проверка наряда.
alter policy read_work_order_events on work_order_events using (
  (select app.auth_role()) in ('master', 'lead') or app.can_see_order(order_id)
);
alter policy read_ai_reviews on ai_reviews using (
  (select app.auth_role()) in ('master', 'lead') or app.can_see_order(order_id)
);
alter policy read_material_usages on material_usages using (
  (select app.auth_role()) in ('master', 'lead') or app.can_see_order(order_id)
);
alter policy read_photos on photos using (
  (select app.auth_role()) in ('master', 'lead') or app.can_see_order(order_id)
);
alter policy insert_photos on photos with check (
  author_id = (select app.auth_employee_id())
  and app.can_see_order(order_id)
  and (select count(*) from photos p where p.order_id = photos.order_id and p.kind = photos.kind) < 5
);
