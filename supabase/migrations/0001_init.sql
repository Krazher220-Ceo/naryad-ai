-- 0001_init.sql — начальная схема «НарядAI».
-- Таблицы и статусы по разделу 6 PLAN.md и разделу 8 кейса.
-- Изменение статусов и создание нарядов делаются только функциями из следующих миграций
-- (вызываются из lib/orders). Поэтому прямых прав на UPDATE нарядов у пользователей нет.

-- ============================================================
-- Перечисления
-- ============================================================

create type employee_role as enum ('master', 'worker', 'lead');

-- Десять статусов кейса плюс отмена мастером (п. 5.1 кейса).
create type order_status as enum (
  'issued',       -- Выдан
  'accepted',     -- Принят в работу
  'queued',       -- В очереди
  'rejected',     -- Отклонён
  'in_progress',  -- В работе
  'paused',       -- Приостановлен
  'done',         -- Исполнено
  'ai_review',    -- Проверка ИИ
  'rework',       -- На доработку
  'closed',       -- Закрыт
  'cancelled'     -- Отменён мастером
);

-- Тип работ из кейса: плановый или внеплановый.
create type order_type as enum ('planned', 'unplanned');

-- Приоритеты из кейса: аварийный, высокий, обычный, плановый.
create type order_priority as enum ('emergency', 'high', 'normal', 'planned');

create type photo_kind as enum ('before', 'after');

create type ai_verdict as enum ('accept', 'accept_with_note', 'rework', 'needs_master');

-- Откуда пришёл ответ ИИ.
create type ai_source as enum ('laya', 'llm', 'vlm', 'rules');

create type request_status as enum ('new', 'converted', 'dismissed');

-- ============================================================
-- Справочники
-- ============================================================

create table sections (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table equipment (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  inventory_no text not null unique,
  section_id   uuid not null references sections(id),
  type         text not null,
  criticality  smallint not null default 2 check (criticality between 1 and 3), -- 1 — самая высокая
  qr_code      text unique
);
create index equipment_section_idx on equipment(section_id);

create table employees (
  id               uuid primary key default gen_random_uuid(),
  auth_user_id     uuid unique references auth.users(id) on delete set null,
  login            text not null unique,
  full_name        text not null,
  role             employee_role not null,
  specialty        text,              -- слесарь, электрик, сварщик...
  grade            smallint,          -- разряд
  brigade          text,
  shift            text,              -- смена: A, B...
  on_shift         boolean not null default true, -- серый цвет «не на смене»; остальные цвета считаются по нарядам
  permits          text[] not null default '{}',  -- допуски
  telegram_chat_id bigint
);

create table fault_codes (
  code       text primary key,         -- например, М-02
  category   text not null,            -- М, Э, Г, П, С
  name       text not null,
  norm_hours numeric(5,2) not null check (norm_hours > 0)
);

create table materials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  unit        text not null,
  typical_qty numeric(10,2) not null default 1, -- обычный расход на один наряд
  fault_codes text[] not null default '{}'      -- с какими шифрами обычно списывается
);

create table order_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        order_type not null default 'planned',
  fault_code  text references fault_codes(code),
  norm_hours  numeric(5,2),
  description text not null
);

-- Настройки: всегда одна строка с id = 1.
create table settings (
  id                        smallint primary key default 1 check (id = 1),
  ai_provider               text not null default 'cloud' check (ai_provider in ('cloud', 'local')),
  remind_before_min         integer not null default 30,
  accept_timeout_min        integer not null default 10,
  accept_timeout_urgent_min integer not null default 3
);
insert into settings (id) values (1);

-- ============================================================
-- Наряды и всё, что к ним относится
-- ============================================================

create table work_orders (
  id              uuid primary key default gen_random_uuid(),
  number          bigint generated always as identity unique, -- «Наряд №147»
  type            order_type not null,
  description     text not null,
  comment         text,
  section_id      uuid not null references sections(id),
  equipment_id    uuid not null references equipment(id),
  assignee_id     uuid references employees(id),
  brigade         text,               -- кейс: «исполнитель или бригада»
  master_id       uuid not null references employees(id),
  priority        order_priority not null,
  due_at          timestamptz not null,
  status          order_status not null default 'issued',
  fault_code      text references fault_codes(code),
  needs_permit    boolean not null default false,
  parent_order_id uuid references work_orders(id),
  -- Заполняются исполнителем при закрытии.
  work_done       text,
  close_comment   text,
  -- Времена ключевых переходов, чтобы отчёты не собирали их из журнала каждый раз.
  -- Источник правды — work_order_events.
  accepted_at     timestamptz,
  started_at      timestamptz,
  done_at         timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint work_orders_has_assignee check (assignee_id is not null or brigade is not null)
);
create index work_orders_assignee_idx on work_orders(assignee_id);
create index work_orders_master_idx on work_orders(master_id);
create index work_orders_equipment_idx on work_orders(equipment_id);
create index work_orders_status_idx on work_orders(status);
create index work_orders_due_idx on work_orders(due_at);

-- Журнал наряда. Только дополняется.
create table work_order_events (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references work_orders(id),
  actor_id         uuid references employees(id), -- null — действие системы (ИИ, расписание)
  action           text not null,                  -- issue, accept, queue, reject, start, pause...
  from_status      order_status,
  to_status        order_status,
  comment          text,
  reason           text,
  reason_code      text,  -- waiting_parts, waiting_permit, waiting_stop... для расчёта просрочки
  client_action_id uuid unique, -- защита от дублей при повторной отправке из офлайн-очереди
  created_at       timestamptz not null default now()
);
create index work_order_events_order_idx on work_order_events(order_id, created_at);

create table photos (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references work_orders(id),
  kind       photo_kind not null,
  path       text not null,         -- путь в хранилище Supabase Storage
  taken_at   timestamptz,
  author_id  uuid not null references employees(id),
  sha256     text,
  phash      text,                  -- перцептивный хеш для поиска повторных фото
  created_at timestamptz not null default now()
);
create index photos_order_idx on photos(order_id);
create index photos_sha_idx on photos(sha256);

create table material_usages (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references work_orders(id),
  material_id uuid not null references materials(id),
  qty         numeric(10,2) not null check (qty > 0)
);
create index material_usages_order_idx on material_usages(order_id);

create table ai_reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references work_orders(id),
  verdict       ai_verdict not null,
  score         smallint check (score between 1 and 5),
  confidence    numeric(3,2) check (confidence between 0 and 1),
  checks        jsonb not null default '{}',
  explanation   text,
  source        ai_source not null,
  master_score  smallint check (master_score between 1 and 5),
  master_reason text,
  created_at    timestamptz not null default now(),
  -- Мастер меняет оценку только с причиной.
  constraint ai_reviews_master_reason check (master_score is null or master_reason is not null)
);
create index ai_reviews_order_idx on ai_reviews(order_id);

-- Заявки: попутная находка исполнителя, из которой мастер делает наряд.
create table requests (
  id              uuid primary key default gen_random_uuid(),
  equipment_id    uuid references equipment(id),
  description     text not null,
  photo_path      text,
  created_by      uuid not null references employees(id),
  parent_order_id uuid references work_orders(id),
  status          request_status not null default 'new',
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Журнал нельзя менять и удалять
-- ============================================================

create function forbid_event_changes() returns trigger
language plpgsql as $$
begin
  raise exception 'work_order_events: записи журнала не изменяются и не удаляются';
end;
$$;

create trigger work_order_events_immutable
  before update or delete on work_order_events
  for each row execute function forbid_event_changes();

-- ============================================================
-- Кто вошёл: вспомогательные функции для правил доступа
-- ============================================================

-- security definer: функции читают employees в обход RLS, иначе правила зациклятся.
create function auth_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from employees where auth_user_id = auth.uid()
$$;

create function auth_role() returns employee_role
language sql stable security definer set search_path = public as $$
  select role from employees where auth_user_id = auth.uid()
$$;

-- Видит ли вошедший пользователь наряд: мастер и руководитель — все,
-- исполнитель — назначенные ему или его бригаде.
create function can_see_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from work_orders o
    join employees e on e.auth_user_id = auth.uid()
    where o.id = p_order_id
      and (
        e.role in ('master', 'lead')
        or o.assignee_id = e.id
        or (o.assignee_id is null and o.brigade = e.brigade)
      )
  )
$$;

-- ============================================================
-- Правила доступа (RLS)
-- ============================================================

alter table sections          enable row level security;
alter table equipment         enable row level security;
alter table employees         enable row level security;
alter table fault_codes       enable row level security;
alter table materials         enable row level security;
alter table order_templates   enable row level security;
alter table settings          enable row level security;
alter table work_orders       enable row level security;
alter table work_order_events enable row level security;
alter table photos            enable row level security;
alter table material_usages   enable row level security;
alter table ai_reviews        enable row level security;
alter table requests          enable row level security;

-- Справочники читает любой вошедший сотрудник. Пишет только служебный ключ (скрипты, админ).
create policy read_sections        on sections        for select to authenticated using (true);
create policy read_equipment       on equipment       for select to authenticated using (true);
create policy read_employees       on employees       for select to authenticated using (true);
create policy read_fault_codes     on fault_codes     for select to authenticated using (true);
create policy read_materials       on materials       for select to authenticated using (true);
create policy read_order_templates on order_templates for select to authenticated using (true);
create policy read_settings        on settings        for select to authenticated using (true);

-- Наряды и связанные записи видны по правилу can_see_order.
-- Вставка и изменение — только через функции lib/orders (следующие миграции).
create policy read_work_orders on work_orders
  for select to authenticated using (can_see_order(id));

create policy read_work_order_events on work_order_events
  for select to authenticated using (can_see_order(order_id));

create policy read_photos on photos
  for select to authenticated using (can_see_order(order_id));

create policy read_material_usages on material_usages
  for select to authenticated using (can_see_order(order_id));

create policy read_ai_reviews on ai_reviews
  for select to authenticated using (can_see_order(order_id));

-- Заявки: автор видит свои, мастер и руководитель — все. Создаёт любой сотрудник от своего имени.
create policy read_requests on requests
  for select to authenticated
  using (created_by = auth_employee_id() or auth_role() in ('master', 'lead'));

create policy insert_requests on requests
  for insert to authenticated
  with check (created_by = auth_employee_id());

-- ============================================================
-- Realtime: статусы нарядов и исполнителей у мастера без обновления страницы
-- ============================================================

alter publication supabase_realtime add table work_orders, work_order_events, employees;
