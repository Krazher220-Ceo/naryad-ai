-- 0007_status_notifications.sql — уведомления о смене статуса мастером или исполнителем.
-- Возврат на доработку, отмена и закрытие — исполнителю; отказ и пауза — мастеру.
alter type notification_kind add value if not exists 'status_change';
