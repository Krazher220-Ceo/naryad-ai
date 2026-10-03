-- 0010_update_settings.sql — мастер и руководитель меняют пороги контроля сроков и режим ИИ.
-- Нужно для демо (напоминание через 1 минуту вместо 30) и для переключения облако / локальная модель.

create function update_settings(
  p_remind_before_min         integer,
  p_accept_timeout_min        integer,
  p_accept_timeout_urgent_min integer,
  p_overdue_repeat_min        integer,
  p_lead_escalate_after_min   integer,
  p_ai_provider               text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if app.auth_role() not in ('master', 'lead') then
    raise exception 'Менять настройки может мастер или руководитель' using errcode = '42501';
  end if;
  if least(p_remind_before_min, p_accept_timeout_min, p_accept_timeout_urgent_min, p_overdue_repeat_min, p_lead_escalate_after_min) < 1 then
    raise exception 'Интервалы — не меньше 1 минуты' using errcode = '22023';
  end if;
  if p_ai_provider not in ('cloud', 'local') then
    raise exception 'Режим ИИ: cloud или local' using errcode = '22023';
  end if;

  update settings set
    remind_before_min         = p_remind_before_min,
    accept_timeout_min        = p_accept_timeout_min,
    accept_timeout_urgent_min = p_accept_timeout_urgent_min,
    overdue_repeat_min        = p_overdue_repeat_min,
    lead_escalate_after_min   = p_lead_escalate_after_min,
    ai_provider               = p_ai_provider
  where id = 1;
end;
$$;

revoke execute on function update_settings(integer, integer, integer, integer, integer, text) from public, anon;
grant execute on function update_settings(integer, integer, integer, integer, integer, text) to authenticated;
