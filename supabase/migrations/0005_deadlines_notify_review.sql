-- 0005_deadlines_notify_review.sql — веха M2: контроль сроков, уведомления, оценка ИИ мастером.

-- ============================================================
-- Настройки контроля сроков и проверки ИИ
-- ============================================================

alter table settings
  add column overdue_repeat_min      integer not null default 30,   -- повтор сообщения о просрочке
  add column lead_escalate_after_min integer not null default 120,  -- просрочка дольше — сообщить руководителю
  add column ai_confidence_threshold numeric(3,2) not null default 0.6; -- ниже — вердикт needs_master

-- ============================================================
-- Привязка Telegram
-- ============================================================
-- Сотрудник открывает t.me/<бот>?start=<код>, бот получает код и записывает chat_id.

alter table employees add column telegram_link_code text unique;
update employees set telegram_link_code = encode(extensions.gen_random_bytes(6), 'hex')
where telegram_link_code is null;
alter table employees alter column telegram_link_code set default encode(extensions.gen_random_bytes(6), 'hex');

-- ============================================================
-- Журнал уведомлений
-- ============================================================
-- Каждое отправленное (или неотправленное) сообщение. По нему расписание понимает,
-- что напоминание уже было, и не шлёт его повторно каждую минуту.

create type notification_kind as enum (
  'new_order',      -- исполнителю: выдан наряд
  'remind',         -- исполнителю: до срока осталось N минут
  'overdue',        -- исполнителю и мастеру: наряд просрочен
  'not_accepted',   -- мастеру: наряд не принят вовремя
  'lead_overdue',   -- руководителю: длительная просрочка
  'review_ready'    -- исполнителю и мастеру: ИИ проверил наряд
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references work_orders(id),
  employee_id uuid not null references employees(id),
  kind        notification_kind not null,
  text        text not null,
  delivered   boolean not null,  -- false: Telegram не привязан или ошибка отправки
  error       text,
  created_at  timestamptz not null default now()
);
create index notifications_lookup_idx on notifications(order_id, employee_id, kind, created_at desc);

alter table notifications enable row level security;

-- Сотрудник видит свои уведомления, мастер и руководитель — все. Пишет только сервер (служебный ключ).
create policy read_notifications on notifications
  for select to authenticated
  using (employee_id = app.auth_employee_id() or app.auth_role() in ('master', 'lead'));

-- ============================================================
-- Мастер соглашается с оценкой ИИ или меняет её (п. 6.4 кейса)
-- ============================================================
-- Оценку ИИ записывает сервер. Мастер может только поставить свою оценку с причиной.
-- Закрыть или вернуть на доработку — отдельно, через transition_order.

create function set_master_score(
  p_review_id uuid,
  p_score     smallint,
  p_reason    text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me     employees := app.me();
  v_review ai_reviews;
begin
  if v_me.role is distinct from 'master' then
    raise exception 'Менять оценку может только мастер' using errcode = '42501';
  end if;
  if p_score not between 1 and 5 then
    raise exception 'Оценка от 1 до 5' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Укажите, почему оценка изменена' using errcode = '22023';
  end if;

  select * into v_review from ai_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Проверка не найдена' using errcode = 'P0002';
  end if;

  update ai_reviews set master_score = p_score, master_reason = trim(p_reason) where id = p_review_id;

  -- Изменение оценки попадает в историю наряда.
  insert into work_order_events (order_id, actor_id, action, from_status, to_status, comment, reason)
  select v_review.order_id, v_me.id, 'master_score', o.status, o.status,
         coalesce(v_review.score::text, '—') || ' -> ' || p_score, trim(p_reason)
  from work_orders o where o.id = v_review.order_id;
end;
$$;

revoke execute on function set_master_score(uuid, smallint, text) from public, anon;
grant execute on function set_master_score(uuid, smallint, text) to authenticated;

-- ============================================================
-- Расписание: раз в минуту вызывать /api/cron/deadlines
-- ============================================================
-- На бесплатном Vercel своё расписание срабатывает раз в сутки, поэтому его запускает база.
-- Секрет хранится в Supabase Vault под именем cron_secret (создаётся отдельно, не в git).
-- Адрес приложения — в Vault под именем app_url.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function app.call_deadlines() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url    text := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret');
begin
  if v_url is null or v_secret is null then
    return; -- не настроено — молча пропускаем
  end if;
  perform net.http_post(
    url     := v_url || '/api/cron/deadlines',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function app.call_deadlines() from public, anon, authenticated;

select cron.schedule('naryad-deadlines', '* * * * *', 'select app.call_deadlines()');
