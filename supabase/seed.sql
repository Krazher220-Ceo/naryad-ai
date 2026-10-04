-- seed.sql — минимальные демонстрационные справочники и учётные записи для M0.
-- Все данные вымышленные. Это не реальные данные завода.
-- Полный набор (25 единиц оборудования, 15 исполнителей, 500+ нарядов) делает генератор в scripts/seed (M3).
-- Скрипт можно запускать повторно: существующие строки не дублируются.

-- ---------- Участки ----------
insert into sections (name) values
  ('Участок дробления'),
  ('Участок обогащения'),
  ('Ремонтно-механический цех'),
  ('Участок сушки и упаковки')
on conflict (name) do nothing;

-- ---------- Оборудование ----------
insert into equipment (name, inventory_no, section_id, type, criticality, qr_code)
select v.name, v.inv, s.id, v.type, v.crit, 'EQ-' || v.inv
from (values
  ('Дробилка КМД-1750',     'INV-1001', 'Участок дробления',          'дробилка',  1),
  ('Конвейер К-3',          'INV-1002', 'Участок дробления',          'конвейер',  1),
  ('Насос шламовый НШ-2',   'INV-2001', 'Участок обогащения',         'насос',     1),
  ('Флотомашина ФМ-6',      'INV-2002', 'Участок обогащения',         'флотомашина', 2),
  ('Токарный станок 16К20', 'INV-3001', 'Ремонтно-механический цех',  'станок',    3),
  ('Сушильный барабан СБ-1','INV-4001', 'Участок сушки и упаковки',   'сушилка',   2)
) as v(name, inv, section, type, crit)
join sections s on s.name = v.section
on conflict (inventory_no) do nothing;

-- ---------- Шифры неисправностей (категории из п. 5.4 кейса) ----------
insert into fault_codes (code, category, name, norm_hours) values
  ('М-01', 'М', 'Износ футеровки',                    6.0),
  ('М-02', 'М', 'Отказ подшипника',                   3.0),
  ('М-03', 'М', 'Обрыв или износ конвейерной ленты',  4.0),
  ('М-04', 'М', 'Ослабление крепежа',                 1.0),
  ('М-05', 'М', 'Износ уплотнения вала',              2.0),
  ('Э-01', 'Э', 'Отказ электродвигателя',             4.0),
  ('Э-02', 'Э', 'Обрыв кабеля питания',               2.0),
  ('Э-03', 'Э', 'Срабатывание защиты',                1.0),
  ('Э-04', 'Э', 'Неисправность датчика',              1.5),
  ('Г-01', 'Г', 'Течь масла',                         2.0),
  ('Г-02', 'Г', 'Отказ гидронасоса',                  5.0),
  ('Г-03', 'Г', 'Повреждение рукава высокого давления', 1.5),
  ('Г-04', 'Г', 'Падение давления в системе',         2.5),
  ('П-01', 'П', 'Утечка воздуха',                     1.0),
  ('П-02', 'П', 'Отказ пневмоцилиндра',               2.0),
  ('П-03', 'П', 'Засор пневмолинии',                  1.0),
  ('С-01', 'С', 'Недостаток смазки',                  0.5),
  ('С-02', 'С', 'Загрязнение смазки',                 1.0),
  ('С-03', 'С', 'Отказ системы централизованной смазки', 3.0),
  ('С-04', 'С', 'Перегрев узла из-за смазки',         1.5)
on conflict (code) do nothing;

-- ---------- Материалы ----------
insert into materials (name, unit, typical_qty, fault_codes) values
  ('Подшипник 6312',             'шт', 2,   '{М-02}'),
  ('Подшипник 22320',            'шт', 1,   '{М-02}'),
  ('Лента конвейерная, м',       'м',  10,  '{М-03}'),
  ('Болт М16 с гайкой',          'шт', 8,   '{М-04}'),
  ('Манжета армированная',       'шт', 2,   '{М-05,Г-01}'),
  ('Масло индустриальное И-40А', 'л',  5,   '{Г-01,С-01,С-02}'),
  ('Рукав РВД 1/2"',             'шт', 1,   '{Г-03}'),
  ('Кабель ВВГ 3х2,5',           'м',  10,  '{Э-02}'),
  ('Смазка Литол-24',            'кг', 1,   '{С-01,С-04}'),
  ('Фитинг пневматический',      'шт', 2,   '{П-01,П-03}')
on conflict (name) do nothing;

-- ---------- Учётные записи ----------
-- Вход по логину и паролю: логин -> <login>@naryad.local (lib/auth/roles.ts).
-- Функция создаёт пользователя Supabase Auth и связывает его с сотрудником.
create or replace function pg_temp.demo_user(
  p_login text, p_password text, p_full_name text, p_role employee_role,
  p_specialty text, p_grade smallint, p_brigade text, p_shift text
) returns void
language plpgsql as $$
declare
  v_email text := p_login || '@naryad.local';
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into employees (auth_user_id, login, full_name, role, specialty, grade, brigade, shift)
  values (v_uid, p_login, p_full_name, p_role, p_specialty, p_grade, p_brigade, p_shift)
  on conflict (login) do update set auth_user_id = excluded.auth_user_id;
end;
$$;

-- Демо-логины для жюри. Пароль одинаков для всех логинов одной роли, чтобы его было легко запомнить.
-- Пароль не короче 8 символов, буквы и цифры (AGENTS.md).
select pg_temp.demo_user('master1', 'master2026', 'Сапаров Нурлан', 'master', null,          null, null,        'A');
select pg_temp.demo_user('worker1', 'worker2026', 'Ахметов Ерлан',  'worker', 'слесарь',     5::smallint,    'Бригада 1', 'A');
select pg_temp.demo_user('worker2', 'worker2026', 'Ким Виктор',     'worker', 'электрик',    4::smallint,    'Бригада 1', 'A');
select pg_temp.demo_user('worker3', 'worker2026', 'Жумабаев Арман', 'worker', 'сварщик',     4::smallint,    'Бригада 2', 'A');
select pg_temp.demo_user('lead1',   'lead2026', 'Иванова Ольга',  'lead',   null,          null, null,        null);
-- Общий логин участка для оператора. Без входа оператор тоже может сообщить о поломке.
select pg_temp.demo_user('operator1', 'operator2026', 'Оператор участка дробления', 'operator', null, null, null, 'A');

-- ---------- Уровень 4: допуски и шаблоны плановых работ ----------
-- Допуски по специальности. Подбор исполнителя учитывает их (lib/orders/suggest.ts).
-- Выполняется повторно без вреда: значения просто перезаписываются.
update employees set permits = '{электробезопасность}' where role = 'worker' and specialty = 'электрик';
update employees set permits = '{огневые работы}'      where role = 'worker' and specialty = 'сварщик';
-- Слесари с разрядом 5 и выше допущены к работе с гидравликой под давлением.
update employees set permits = case when grade >= 5 then '{работа под давлением}'::text[] else '{}'::text[] end
  where role = 'worker' and specialty = 'слесарь';

-- Шаблоны плановых работ: выдача ППР в одно нажатие.
insert into order_templates (name, type, fault_code, norm_hours, description)
select v.name, 'planned', v.fault_code, v.norm_hours, v.description
from (values
  ('ППР: смазка подшипниковых узлов', 'С-01', 0.5, 'Плановая смазка подшипниковых узлов по графику ППР. Проверить уровень и состояние смазки.'),
  ('ППР: замена масла в редукторе',    'С-02', 1.0, 'Плановая замена масла в редукторе. Слить старое масло, промыть, залить новое до уровня.'),
  ('ППР: подтяжка крепежа',            'М-04', 1.0, 'Плановый осмотр и подтяжка резьбовых соединений рамы и опор.'),
  ('ППР: осмотр конвейерной ленты',    'М-03', 1.0, 'Плановый осмотр ленты и стыков, регулировка натяжения и центровки.'),
  ('ППР: проверка электродвигателя',   'Э-01', 1.5, 'Плановая проверка электродвигателя: сопротивление изоляции, нагрев, вибрация, крепление.'),
  ('ППР: проверка гидросистемы',       'Г-04', 1.5, 'Плановая проверка гидросистемы: давление, рукава, уплотнения, уровень масла.')
) as v(name, fault_code, norm_hours, description)
where not exists (select 1 from order_templates t where t.name = v.name);
