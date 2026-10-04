-- 0011_level4_helpers.sql — дополнения уровня 4 (PLAN.md, раздел 3).
--   1. «Как чинили в прошлый раз»: история ремонтов оборудования для исполнителя.
--   2. «Нужна помощь»: исполнитель зовёт мастера, в журнале наряда остаётся запись.
--   3. Попутная находка: мастер превращает заявку исполнителя в наряд или отклоняет её.

-- ============================================================
-- 1. История ремонтов оборудования
-- ============================================================
-- Исполнитель видит только свои наряды (правило can_see_order), а прошлые ремонты машины
-- делали другие люди. Функция отдаёт последние закрытые наряды по оборудованию без имён:
-- что сломалось, что сделали, какие материалы ушли.

create function equipment_repair_history(p_equipment_id uuid, p_exclude_order_id uuid default null)
returns table (
  number     bigint,
  closed_at  timestamptz,
  fault_code text,
  fault_name text,
  work_done  text,
  materials  text
)
language sql stable security definer set search_path = public as $$
  select o.number,
         o.closed_at,
         o.fault_code,
         f.name,
         o.work_done,
         (select string_agg(m.name || ' — ' || mu.qty::text || ' ' || m.unit, ', ' order by m.name)
            from material_usages mu join materials m on m.id = mu.material_id
           where mu.order_id = o.id)
    from work_orders o
    left join fault_codes f on f.code = o.fault_code
   where app.auth_employee_id() is not null
     and o.equipment_id = p_equipment_id
     and o.status = 'closed'
     and (p_exclude_order_id is null or o.id <> p_exclude_order_id)
   order by o.closed_at desc nulls last
   limit 3
$$;

revoke execute on function equipment_repair_history(uuid, uuid) from public, anon;
grant execute on function equipment_repair_history(uuid, uuid) to authenticated;

-- ============================================================
-- 2. «Нужна помощь»
-- ============================================================
-- Статус наряда не меняется. В журнал пишется событие help с комментарием,
-- уведомление мастеру отправляет сервер (lib/orders/notifications.ts).

create function request_help(
  p_order_id         uuid,
  p_comment          text default null,
  p_client_action_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me    employees := app.me();
  v_order work_orders;
begin
  if app.already_done(p_client_action_id) then
    return;
  end if;
  select * into v_order from work_orders where id = p_order_id;
  if not found then
    raise exception 'Наряд не найден' using errcode = 'P0002';
  end if;
  if v_me.id is null or v_order.assignee_id is distinct from v_me.id then
    raise exception 'Помощь может попросить только исполнитель наряда' using errcode = '42501';
  end if;
  if v_order.status not in ('accepted', 'queued', 'in_progress', 'paused', 'rework') then
    raise exception 'Помощь можно попросить только по наряду в работе' using errcode = '22023';
  end if;

  insert into work_order_events (order_id, actor_id, action, from_status, to_status, comment, client_action_id)
  values (p_order_id, v_me.id, 'help', v_order.status, v_order.status, nullif(trim(p_comment), ''), p_client_action_id);
end;
$$;

revoke execute on function request_help(uuid, text, uuid) from public, anon;
grant execute on function request_help(uuid, text, uuid) to authenticated;

-- ============================================================
-- 3. Попутная находка → наряд
-- ============================================================
-- Заявку создаёт исполнитель (правило insert_requests из 0001).
-- Мастер отмечает её «превращена в наряд» или «отклонена».

create function resolve_request(p_request_id uuid, p_status request_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if app.auth_role() is distinct from 'master' then
    raise exception 'Заявку обрабатывает мастер' using errcode = '42501';
  end if;
  if p_status = 'new' then
    raise exception 'Укажите, что сделать с заявкой' using errcode = '22023';
  end if;
  update requests set status = p_status where id = p_request_id and status = 'new';
  if not found then
    raise exception 'Заявка не найдена или уже обработана' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function resolve_request(uuid, request_status) from public, anon;
grant execute on function resolve_request(uuid, request_status) to authenticated;
