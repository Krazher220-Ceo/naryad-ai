-- order_cycle.sql — проверка цикла наряда на настоящей базе.
-- Запуск: вставить целиком в SQL Editor Supabase (или execute_sql через MCP).
-- Всё выполняется внутри транзакции и откатывается: данные в базе не остаются.
-- Нужны демо-пользователи из supabase/seed.sql.
-- В результате каждая строка «... -> must fail» должна быть ERR, остальные — OK.

begin;
create temp table t_log(step int generated always as identity, what text, result text) on commit drop;
grant all on t_log to authenticated;
create temp table v(k text primary key, val text) on commit drop;
grant all on v to authenticated;

-- Войти от имени сотрудника: подставляем его id в JWT, как это делает Supabase.
create or replace function pg_temp.as_user(p_login text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.employees where login = p_login), 'role', 'authenticated')::text, true);
end $$;

-- Выполнить шаг и записать результат или текст ошибки.
create or replace function pg_temp.try(p_what text, p_sql text) returns void language plpgsql as $$
declare r text;
begin
  execute p_sql into r;
  insert into t_log(what, result) values (p_what, 'OK ' || coalesce(r, ''));
exception when others then
  insert into t_log(what, result) values (p_what, 'ERR ' || sqlerrm);
end $$;

insert into v select 'eq', id::text from equipment where inventory_no = 'INV-2001';
insert into v select 'sec', section_id::text from equipment where inventory_no = 'INV-2001';
insert into v select 'w1', id::text from employees where login = 'worker1';

set local role authenticated;

select pg_temp.as_user('worker1');
select pg_temp.try('worker create_order -> must fail', format($q$select create_order('unplanned','Течь масла', %L, %L, 'emergency', now()+interval '2 hours', %L)::text$q$, (select val from v where k='sec'), (select val from v where k='eq'), (select val from v where k='w1')));

select pg_temp.as_user('master1');
select pg_temp.try('master create_order', format($q$select create_order('unplanned','Течь масла на насосе', %L, %L, 'emergency', now()+interval '2 hours', %L, null, null, null, '11111111-1111-1111-1111-111111111111')::text$q$, (select val from v where k='sec'), (select val from v where k='eq'), (select val from v where k='w1')));
insert into v select 'o1', order_id::text from work_order_events where client_action_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.try('create_order repeat returns same id', format($q$select create_order('unplanned','Течь масла на насосе', %L, %L, 'emergency', now()+interval '2 hours', %L, null, null, null, '11111111-1111-1111-1111-111111111111')::text$q$, (select val from v where k='sec'), (select val from v where k='eq'), (select val from v where k='w1')));

select pg_temp.as_user('worker3');
select pg_temp.try('worker3 does not see order 1 (expect 0)', format($q$select count(*)::text from work_orders where id=%L$q$, (select val from v where k='o1')));
select pg_temp.try('worker3 accept -> must fail', format($q$select transition_order(%L,'accept')::text$q$, (select val from v where k='o1')));

select pg_temp.as_user('worker1');
select pg_temp.try('start before accept -> must fail', format($q$select transition_order(%L,'start')::text$q$, (select val from v where k='o1')));
select pg_temp.try('accept', format($q$select transition_order(%L,'accept')::text$q$, (select val from v where k='o1')));
select pg_temp.try('start', format($q$select transition_order(%L,'start')::text$q$, (select val from v where k='o1')));
select pg_temp.try('pause without reason -> must fail', format($q$select transition_order(%L,'pause')::text$q$, (select val from v where k='o1')));
select pg_temp.try('pause with reason', format($q$select transition_order(%L,'pause','Ждём манжету','waiting_parts')::text$q$, (select val from v where k='o1')));
select pg_temp.try('resume', format($q$select transition_order(%L,'resume')::text$q$, (select val from v where k='o1')));
select pg_temp.try('direct update changes 0 rows', format($q$with u as (update work_orders set status='closed' where id=%L returning 1) select count(*)::text from u$q$, (select val from v where k='o1')));
select pg_temp.try('complete without photo -> must fail', format($q$select complete_order(%L,'Заменена манжета','Г-01','[]')::text$q$, (select val from v where k='o1')));
select pg_temp.try('add photo after', format($q$insert into photos(order_id, kind, path, author_id) values (%L,'after','x/after.jpg', app.auth_employee_id()) returning 'ok'$q$, (select val from v where k='o1')));
select pg_temp.try('complete', format($q$select complete_order(%L,'Заменена манжета, течь устранена','Г-01', jsonb_build_array(jsonb_build_object('material_id',(select id from materials where name='Манжета армированная'),'qty',2)))::text$q$, (select val from v where k='o1')));

select pg_temp.as_user('master1');
select pg_temp.try('worker board', $q$select string_agg(full_name||':'||board_status, ', ' order by full_name) from worker_board$q$);
select pg_temp.try('master close', format($q$select transition_order(%L,'close')::text$q$, (select val from v where k='o1')));
select pg_temp.try('journal order 1', format($q$select string_agg(action||':'||coalesce(to_status::text,''), ' > ' order by created_at) from work_order_events where order_id=%L$q$, (select val from v where k='o1')));

select pg_temp.try('order 2', format($q$select create_order('planned','Смазка подшипников', %L, %L, 'normal', now()+interval '2 minutes', %L, null, null, null, '22222222-2222-2222-2222-222222222222')::text$q$, (select val from v where k='sec'), (select val from v where k='eq'), (select val from v where k='w1')));
insert into v select 'o2', order_id::text from work_order_events where client_action_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.as_user('worker1');
select pg_temp.try('queue', format($q$select transition_order(%L,'queue')::text$q$, (select val from v where k='o2')));
select pg_temp.try('reject without reason -> must fail', format($q$select transition_order(%L,'reject')::text$q$, (select val from v where k='o2')));
select pg_temp.try('reject', format($q$select transition_order(%L,'reject','Нет допуска','no_permit')::text$q$, (select val from v where k='o2')));
select pg_temp.as_user('master1');
select pg_temp.try('reassign to worker2', format($q$select reassign_order(%L,(select id from employees where login='worker2'))::text$q$, (select val from v where k='o2')));
select pg_temp.try('change priority', format($q$select change_order_priority(%L,'high')::text$q$, (select val from v where k='o2')));
select pg_temp.try('cancel without reason -> must fail', format($q$select transition_order(%L,'cancel')::text$q$, (select val from v where k='o2')));
select pg_temp.try('cancel', format($q$select transition_order(%L,'cancel','Дубль')::text$q$, (select val from v where k='o2')));
select pg_temp.try('journal order 2', format($q$select string_agg(action||':'||coalesce(to_status::text,''), ' > ' order by created_at) from work_order_events where order_id=%L$q$, (select val from v where k='o2')));

-- Уровень 4: «Нужна помощь», попутная заявка, история ремонтов (миграция 0011).
select pg_temp.as_user('master1');
select pg_temp.try('order 3', format($q$select create_order('unplanned','Стук в насосе', %L, %L, 'normal', now()+interval '2 hours', %L, null, null, null, '33333333-3333-3333-3333-333333333333')::text$q$, (select val from v where k='sec'), (select val from v where k='eq'), (select val from v where k='w1')));
insert into v select 'o3', order_id::text from work_order_events where client_action_id = '33333333-3333-3333-3333-333333333333';
select pg_temp.as_user('worker1');
select pg_temp.try('accept order 3', format($q$select transition_order(%L,'accept')::text$q$, (select val from v where k='o3')));
select pg_temp.try('help', format($q$select request_help(%L,'Нужен второй человек','44444444-4444-4444-4444-444444444444')::text$q$, (select val from v where k='o3')));
select pg_temp.try('help repeat does not duplicate', format($q$select request_help(%L,'Нужен второй человек','44444444-4444-4444-4444-444444444444')::text$q$, (select val from v where k='o3')));
select pg_temp.try('help events = 1', format($q$select count(*)::text from work_order_events where order_id=%L and action='help'$q$, (select val from v where k='o3')));
select pg_temp.try('side request', format($q$insert into requests(created_by, equipment_id, parent_order_id, description) values (app.auth_employee_id(), %L, %L, 'Трещина на кожухе') returning 'ok'$q$, (select val from v where k='eq'), (select val from v where k='o3')));
insert into v select 'r1', id::text from requests where description = 'Трещина на кожухе' order by created_at desc limit 1;
select pg_temp.try('worker resolve request -> must fail', format($q$select resolve_request(%L,'dismissed')::text$q$, (select val from v where k='r1')));
select pg_temp.try('repair history for worker', format($q$select count(*)::text from equipment_repair_history(%L)$q$, (select val from v where k='eq')));
select pg_temp.as_user('worker2');
select pg_temp.try('help on foreign order -> must fail', format($q$select request_help(%L)::text$q$, (select val from v where k='o3')));
select pg_temp.as_user('master1');
select pg_temp.try('master dismiss request', format($q$select resolve_request(%L,'dismissed')::text$q$, (select val from v where k='r1')));

reset role;
select step, what, result from t_log order by step;
rollback;
