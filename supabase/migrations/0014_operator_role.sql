-- 0014_operator_role.sql — роль «Оператор» и уведомление о новой заявке (M7).
-- Новые значения перечислений добавляются отдельной миграцией: использовать значение
-- можно только после того, как миграция с ним закоммичена.

alter type employee_role add value if not exists 'operator';
alter type notification_kind add value if not exists 'new_request';
