-- V2-08: pause Telegram alerts on wanted marks.
-- Why: owner paused alerts on 2026-11-08; future use is undecided. Reversible.
-- Kept on purpose: public.wanted_alerts, private.dispatch_wanted_alert, private.on_wanted_mark,
-- the edge function telegram-alert, Vault entries and secrets. Only the two triggers go.
--
-- How to re-enable: run these two statements (copied verbatim from
-- 20261106000000_v2_04_wanted_alerts.sql):
--
--   create trigger marks_wanted_alert_insert
--     after insert on public.marks
--     for each row when (new.state = 'wanted')
--     execute function private.on_wanted_mark();
--
--   create trigger marks_wanted_alert_update
--     after update of state on public.marks
--     for each row when (new.state = 'wanted' and old.state is distinct from new.state)
--     execute function private.on_wanted_mark();

drop trigger if exists marks_wanted_alert_insert on public.marks;
drop trigger if exists marks_wanted_alert_update on public.marks;
