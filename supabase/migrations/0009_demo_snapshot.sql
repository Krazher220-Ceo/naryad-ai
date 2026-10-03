-- 0009_demo_snapshot.sql — «Сбросить демо» для жюри (PLAN.md, «Нужно для проверки жюри»).
--
-- snapshot_demo() сохраняет текущие демо-наряды (после генератора scripts/seed) в схему demo_snapshot.
-- restore_demo() возвращает их и сдвигает все даты вперёд на время, прошедшее со снимка:
-- история всегда заканчивается «сегодня», а открытые наряды снова в работе, а не просрочены на дни.
-- Справочники и учётные записи не трогаются. Журнал удаляется только целиком (TRUNCATE), как в 0008.

create schema if not exists demo_snapshot;
revoke all on schema demo_snapshot from public, anon, authenticated;

create table if not exists demo_snapshot.meta (id smallint primary key default 1 check (id = 1), taken_at timestamptz not null);

create function snapshot_demo() returns void
language plpgsql security definer set search_path = public as $$
begin
  drop table if exists demo_snapshot.work_orders, demo_snapshot.work_order_events,
    demo_snapshot.material_usages, demo_snapshot.ai_reviews;
  create table demo_snapshot.work_orders as table public.work_orders;
  create table demo_snapshot.work_order_events as table public.work_order_events;
  create table demo_snapshot.material_usages as table public.material_usages;
  create table demo_snapshot.ai_reviews as table public.ai_reviews;
  insert into demo_snapshot.meta (id, taken_at) values (1, now())
    on conflict (id) do update set taken_at = excluded.taken_at;
end;
$$;

create function restore_demo() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_shift interval := now() - (select taken_at from demo_snapshot.meta where id = 1);
begin
  if v_shift is null then
    raise exception 'Снимок демо-данных не сделан: сначала snapshot_demo()';
  end if;

  perform reset_demo_orders();

  insert into public.work_orders (id, number, type, description, comment, section_id, equipment_id, assignee_id, brigade,
    master_id, priority, due_at, status, fault_code, needs_permit, parent_order_id, work_done, close_comment,
    accepted_at, started_at, done_at, closed_at, created_at, updated_at) overriding system value
  select id, number, type, description, comment, section_id, equipment_id, assignee_id, brigade, master_id,
         priority, due_at + v_shift, status, fault_code, needs_permit, parent_order_id, work_done, close_comment,
         accepted_at + v_shift, started_at + v_shift, done_at + v_shift, closed_at + v_shift,
         created_at + v_shift, updated_at + v_shift
  from demo_snapshot.work_orders;

  insert into public.work_order_events (id, order_id, actor_id, action, from_status, to_status, comment, reason,
    reason_code, client_action_id, created_at)
  select id, order_id, actor_id, action, from_status, to_status, comment, reason, reason_code, client_action_id,
         created_at + v_shift
  from demo_snapshot.work_order_events;

  insert into public.material_usages (id, order_id, material_id, qty)
  select id, order_id, material_id, qty from demo_snapshot.material_usages;

  insert into public.ai_reviews (id, order_id, verdict, score, confidence, checks, explanation, source, master_score,
    master_reason, created_at)
  select id, order_id, verdict, score, confidence, checks, explanation, source, master_score, master_reason,
         created_at + v_shift
  from demo_snapshot.ai_reviews;

  -- Номера новых нарядов продолжаются после демо-истории.
  perform setval(pg_get_serial_sequence('public.work_orders', 'number'), (select max(number) from public.work_orders));
end;
$$;

revoke execute on function snapshot_demo() from public, anon, authenticated;
revoke execute on function restore_demo() from public, anon, authenticated;
grant execute on function snapshot_demo() to service_role;
grant execute on function restore_demo() to service_role;
