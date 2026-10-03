-- 0003_order_functions.sql — цикл наряда: выдача, переходы статусов, закрытие, фото.
--
-- Все изменения наряда идут только через эти функции (их вызывает lib/orders).
-- Каждая функция в одной транзакции:
--   1) проверяет, кто вызывает и можно ли ему это действие;
--   2) проверяет, что переход допустим (раздел 6 PLAN.md);
--   3) меняет наряд и пишет событие в work_order_events.
-- client_action_id: если событие с таким id уже есть, повтор ничего не делает (офлайн-очередь).

-- ============================================================
-- updated_at обновляется сам
-- ============================================================

create function app.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger work_orders_touch
  before update on work_orders
  for each row execute function app.touch_updated_at();

-- ============================================================
-- Вспомогательное: текущий сотрудник целиком
-- ============================================================

create function app.me() returns employees
language sql stable security definer set search_path = public as $$
  select * from employees where auth_user_id = auth.uid()
$$;

-- Повтор действия из офлайн-очереди: событие с этим id уже записано.
create function app.already_done(p_client_action_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_client_action_id is not null
     and exists (select 1 from work_order_events where client_action_id = p_client_action_id)
$$;

-- ============================================================
-- Выдача наряда (только мастер)
-- ============================================================

create function create_order(
  p_type             order_type,
  p_description      text,
  p_section_id       uuid,
  p_equipment_id     uuid,
  p_priority         order_priority,
  p_due_at           timestamptz,
  p_assignee_id      uuid default null,
  p_brigade          text default null,
  p_comment          text default null,
  p_fault_code       text default null,
  p_client_action_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me employees := app.me();
  v_order_id uuid;
begin
  if v_me.role is distinct from 'master' then
    raise exception 'Выдавать наряды может только мастер' using errcode = '42501';
  end if;

  -- Повтор: вернуть уже созданный наряд.
  if app.already_done(p_client_action_id) then
    select order_id into v_order_id from work_order_events where client_action_id = p_client_action_id;
    return v_order_id;
  end if;

  if coalesce(trim(p_description), '') = '' then
    raise exception 'Нужно описание проблемы' using errcode = '22023';
  end if;
  if p_assignee_id is null and coalesce(trim(p_brigade), '') = '' then
    raise exception 'Нужен исполнитель или бригада' using errcode = '22023';
  end if;
  if not exists (select 1 from equipment where id = p_equipment_id and section_id = p_section_id) then
    raise exception 'Оборудование не относится к выбранному участку' using errcode = '22023';
  end if;
  if p_assignee_id is not null
     and not exists (select 1 from employees where id = p_assignee_id and role = 'worker') then
    raise exception 'Исполнитель не найден' using errcode = '22023';
  end if;

  insert into work_orders (
    type, description, comment, section_id, equipment_id, assignee_id, brigade,
    master_id, priority, due_at, fault_code, status
  ) values (
    p_type, trim(p_description), p_comment, p_section_id, p_equipment_id, p_assignee_id,
    nullif(trim(p_brigade), ''), v_me.id, p_priority, p_due_at, p_fault_code, 'issued'
  ) returning id into v_order_id;

  insert into work_order_events (order_id, actor_id, action, from_status, to_status, comment, client_action_id)
  values (v_order_id, v_me.id, 'issue', null, 'issued', p_comment, p_client_action_id);

  return v_order_id;
end;
$$;

-- ============================================================
-- Переходы статусов
-- ============================================================
-- Действия исполнителя: accept, queue, reject, start, pause, resume.
-- Действия мастера:     close, rework, cancel.
-- Закрытие исполнителем — отдельная функция complete_order (там ещё работы, материалы, фото).

create function transition_order(
  p_order_id         uuid,
  p_action           text,
  p_reason           text default null,
  p_reason_code      text default null,
  p_comment          text default null,
  p_client_action_id uuid default null
) returns order_status
language plpgsql security definer set search_path = public as $$
declare
  v_me    employees := app.me();
  v_order work_orders;
  v_to    order_status;
  v_allowed_from order_status[];
  v_needs_reason boolean := false;
  v_by_master    boolean := false;
begin
  if v_me.id is null then
    raise exception 'Нужно войти' using errcode = '42501';
  end if;

  -- Блокируем строку, чтобы два одновременных нажатия не прошли оба.
  select * into v_order from work_orders where id = p_order_id for update;
  if not found then
    raise exception 'Наряд не найден' using errcode = 'P0002';
  end if;

  if app.already_done(p_client_action_id) then
    return v_order.status;
  end if;

  -- Таблица переходов. Она же продублирована для интерфейса в lib/orders/transitions.ts.
  case p_action
    when 'accept' then v_allowed_from := '{issued,queued}';  v_to := 'accepted';
    when 'queue'  then v_allowed_from := '{issued}';         v_to := 'queued';
    when 'reject' then v_allowed_from := '{issued,queued}';  v_to := 'rejected';    v_needs_reason := true;
    when 'start'  then v_allowed_from := '{accepted,rework}'; v_to := 'in_progress';
    when 'pause'  then v_allowed_from := '{in_progress}';    v_to := 'paused';      v_needs_reason := true;
    when 'resume' then v_allowed_from := '{paused}';         v_to := 'in_progress';
    when 'close'  then v_allowed_from := '{ai_review}';      v_to := 'closed';      v_by_master := true;
    when 'rework' then v_allowed_from := '{ai_review}';      v_to := 'rework';      v_by_master := true; v_needs_reason := true;
    when 'cancel' then
      v_allowed_from := '{issued,accepted,queued,rejected,in_progress,paused,done,ai_review,rework}';
      v_to := 'cancelled'; v_by_master := true; v_needs_reason := true;
    else
      raise exception 'Неизвестное действие: %', p_action using errcode = '22023';
  end case;

  -- Кто может.
  if v_by_master then
    if v_me.role <> 'master' then
      raise exception 'Это действие доступно только мастеру' using errcode = '42501';
    end if;
  else
    if v_me.role <> 'worker' or not (
      v_order.assignee_id = v_me.id
      or (v_order.assignee_id is null and v_order.brigade = v_me.brigade)
    ) then
      raise exception 'Это не ваш наряд' using errcode = '42501';
    end if;
  end if;

  if not (v_order.status = any (v_allowed_from)) then
    raise exception 'Нельзя выполнить «%» из статуса %', p_action, v_order.status using errcode = '22023';
  end if;

  if v_needs_reason and coalesce(trim(p_reason), '') = '' and coalesce(trim(p_reason_code), '') = '' then
    raise exception 'Нужно указать причину' using errcode = '22023';
  end if;

  update work_orders set
    status      = v_to,
    -- Наряд бригады при принятии закрепляется за тем, кто принял.
    assignee_id = case when p_action = 'accept' then coalesce(assignee_id, v_me.id) else assignee_id end,
    accepted_at = case when p_action = 'accept' then coalesce(accepted_at, now()) else accepted_at end,
    started_at  = case when p_action = 'start'  then coalesce(started_at, now())  else started_at end,
    closed_at   = case when p_action = 'close'  then now()                         else closed_at end
  where id = p_order_id;

  insert into work_order_events (order_id, actor_id, action, from_status, to_status, comment, reason, reason_code, client_action_id)
  values (p_order_id, v_me.id, p_action, v_order.status, v_to, p_comment, p_reason, p_reason_code, p_client_action_id);

  return v_to;
end;
$$;

-- ============================================================
-- Закрытие исполнителем: работы, шифр, материалы, фото «после»
-- ============================================================
-- p_materials: [{"material_id": "...", "qty": 2}, ...]
-- Фото загружаются в хранилище и записываются в photos до вызова этой функции.
-- После «Исполнено» наряд сразу уходит на проверку ИИ (done -> ai_review).

create function complete_order(
  p_order_id         uuid,
  p_work_done        text,
  p_fault_code       text,
  p_materials        jsonb default '[]',
  p_comment          text default null,
  p_client_action_id uuid default null
) returns order_status
language plpgsql security definer set search_path = public as $$
declare
  v_me    employees := app.me();
  v_order work_orders;
begin
  select * into v_order from work_orders where id = p_order_id for update;
  if not found then
    raise exception 'Наряд не найден' using errcode = 'P0002';
  end if;

  if app.already_done(p_client_action_id) then
    return v_order.status;
  end if;

  if v_me.role is distinct from 'worker' or v_order.assignee_id is distinct from v_me.id then
    raise exception 'Это не ваш наряд' using errcode = '42501';
  end if;
  if v_order.status <> 'in_progress' then
    raise exception 'Закрыть можно только наряд в работе' using errcode = '22023';
  end if;
  if coalesce(trim(p_work_done), '') = '' then
    raise exception 'Опишите выполненные работы' using errcode = '22023';
  end if;
  if not exists (select 1 from fault_codes where code = p_fault_code) then
    raise exception 'Выберите шифр неисправности' using errcode = '22023';
  end if;
  -- Бизнес-правило кейса: для внеплановых работ фото «после» обязательно.
  if v_order.type = 'unplanned'
     and not exists (select 1 from photos where order_id = p_order_id and kind = 'after') then
    raise exception 'Для внеплановых работ нужно фото «после»' using errcode = '22023';
  end if;

  update work_orders set
    status        = 'ai_review',
    work_done     = trim(p_work_done),
    fault_code    = p_fault_code,
    close_comment = p_comment,
    done_at       = now()
  where id = p_order_id;

  -- Материалы: при повторном закрытии после доработки список заменяется.
  delete from material_usages where order_id = p_order_id;
  insert into material_usages (order_id, material_id, qty)
  select p_order_id, (m ->> 'material_id')::uuid, (m ->> 'qty')::numeric
  from jsonb_array_elements(coalesce(p_materials, '[]')) as m;

  -- Два события: исполнитель закрыл, система отправила на проверку ИИ.
  insert into work_order_events (order_id, actor_id, action, from_status, to_status, comment, client_action_id)
  values (p_order_id, v_me.id, 'done', v_order.status, 'done', p_comment, p_client_action_id);
  insert into work_order_events (order_id, actor_id, action, from_status, to_status)
  values (p_order_id, null, 'send_to_review', 'done', 'ai_review');

  return 'ai_review';
end;
$$;

-- ============================================================
-- Переназначение и смена приоритета (мастер, п. 5.1.5 кейса)
-- ============================================================

-- Переназначить можно, пока работа не начата. Отклонённый наряд возвращается в «Выдан».
create function reassign_order(
  p_order_id         uuid,
  p_assignee_id      uuid default null,
  p_brigade          text default null,
  p_comment          text default null,
  p_client_action_id uuid default null
) returns order_status
language plpgsql security definer set search_path = public as $$
declare
  v_me    employees := app.me();
  v_order work_orders;
begin
  if v_me.role is distinct from 'master' then
    raise exception 'Переназначать может только мастер' using errcode = '42501';
  end if;

  select * into v_order from work_orders where id = p_order_id for update;
  if not found then
    raise exception 'Наряд не найден' using errcode = 'P0002';
  end if;
  if app.already_done(p_client_action_id) then
    return v_order.status;
  end if;
  if v_order.status not in ('issued', 'queued', 'accepted', 'rejected') then
    raise exception 'Переназначить можно только до начала работ' using errcode = '22023';
  end if;
  if p_assignee_id is null and coalesce(trim(p_brigade), '') = '' then
    raise exception 'Нужен исполнитель или бригада' using errcode = '22023';
  end if;
  if p_assignee_id is not null
     and not exists (select 1 from employees where id = p_assignee_id and role = 'worker') then
    raise exception 'Исполнитель не найден' using errcode = '22023';
  end if;

  update work_orders set
    status      = 'issued',
    assignee_id = p_assignee_id,
    brigade     = nullif(trim(p_brigade), ''),
    accepted_at = null
  where id = p_order_id;

  insert into work_order_events (order_id, actor_id, action, from_status, to_status, comment, client_action_id)
  values (p_order_id, v_me.id, 'reassign', v_order.status, 'issued', p_comment, p_client_action_id);

  return 'issued';
end;
$$;

create function change_order_priority(
  p_order_id         uuid,
  p_priority         order_priority,
  p_client_action_id uuid default null
) returns order_priority
language plpgsql security definer set search_path = public as $$
declare
  v_me    employees := app.me();
  v_order work_orders;
begin
  if v_me.role is distinct from 'master' then
    raise exception 'Менять приоритет может только мастер' using errcode = '42501';
  end if;

  select * into v_order from work_orders where id = p_order_id for update;
  if not found then
    raise exception 'Наряд не найден' using errcode = 'P0002';
  end if;
  if app.already_done(p_client_action_id) then
    return v_order.priority;
  end if;
  if v_order.status in ('closed', 'cancelled') then
    raise exception 'Наряд уже завершён' using errcode = '22023';
  end if;

  update work_orders set priority = p_priority where id = p_order_id;

  -- Статус не меняется, но действие попадает в историю.
  insert into work_order_events (order_id, actor_id, action, from_status, to_status, comment, client_action_id)
  values (p_order_id, v_me.id, 'change_priority', v_order.status, v_order.status,
          v_order.priority || ' -> ' || p_priority, p_client_action_id);

  return p_priority;
end;
$$;

-- Функции вызываются только вошедшими сотрудниками.
revoke execute on function create_order(order_type, text, uuid, uuid, order_priority, timestamptz, uuid, text, text, text, uuid) from public, anon;
revoke execute on function transition_order(uuid, text, text, text, text, uuid) from public, anon;
revoke execute on function complete_order(uuid, text, text, jsonb, text, uuid) from public, anon;
revoke execute on function reassign_order(uuid, uuid, text, text, uuid) from public, anon;
revoke execute on function change_order_priority(uuid, order_priority, uuid) from public, anon;
grant execute on function create_order(order_type, text, uuid, uuid, order_priority, timestamptz, uuid, text, text, text, uuid) to authenticated;
grant execute on function transition_order(uuid, text, text, text, text, uuid) to authenticated;
grant execute on function complete_order(uuid, text, text, jsonb, text, uuid) to authenticated;
grant execute on function reassign_order(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function change_order_priority(uuid, order_priority, uuid) to authenticated;

revoke execute on function app.me() from public, anon;
revoke execute on function app.already_done(uuid) from public, anon;
grant execute on function app.me() to authenticated;
grant execute on function app.already_done(uuid) to authenticated;

-- ============================================================
-- Статусы исполнителей для панели мастера
-- ============================================================
-- Цвет (AGENTS.md, раздел «Интерфейс»):
--   off   серый   — не на смене
--   queue синий   — в работе и есть очередь
--   busy  жёлтый  — в работе
--   free  зелёный — свободен
-- security_invoker: правила доступа применяются от имени того, кто смотрит.

create view worker_board with (security_invoker = true) as
select
  e.id,
  e.full_name,
  e.specialty,
  e.grade,
  e.brigade,
  e.on_shift,
  cur.id     as current_order_id,
  cur.number as current_order_number,
  cur.status as current_order_status,
  coalesce(q.queue_count, 0)   as queue_count,
  coalesce(q.pending_count, 0) as pending_count,
  case
    when not e.on_shift                                  then 'off'
    when cur.id is not null and coalesce(q.queue_count, 0) > 0 then 'queue'
    when cur.id is not null                              then 'busy'
    else 'free'
  end as board_status
from employees e
-- Текущий наряд: тот, что в работе, на паузе или принят.
left join lateral (
  select o.id, o.number, o.status
  from work_orders o
  where o.assignee_id = e.id and o.status in ('in_progress', 'paused', 'rework', 'accepted')
  order by case o.status when 'in_progress' then 0 when 'paused' then 1 when 'rework' then 2 else 3 end,
           o.updated_at desc
  limit 1
) cur on true
left join lateral (
  select
    count(*) filter (where o.status = 'queued') as queue_count,
    count(*) filter (where o.status = 'issued') as pending_count
  from work_orders o
  where o.assignee_id = e.id
) q on true
where e.role = 'worker';

grant select on worker_board to authenticated;

-- ============================================================
-- Фото: хранилище и таблица photos
-- ============================================================
-- Путь файла: <order_id>/<любое имя>. Доступ к файлу = доступ к наряду.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

create function app.order_id_from_path(p_name text) returns uuid
language plpgsql immutable set search_path = public as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and app.can_see_order(app.order_id_from_path(name)));

create policy photos_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and app.can_see_order(app.order_id_from_path(name)));

-- Запись о фото: автор — сам вошедший, наряд — видимый ему. Не больше 5 фото одного вида.
create policy insert_photos on photos
  for insert to authenticated
  with check (
    author_id = app.auth_employee_id()
    and app.can_see_order(order_id)
    and (select count(*) from photos p where p.order_id = photos.order_id and p.kind = photos.kind) < 5
  );

grant execute on function app.order_id_from_path(text) to authenticated;
