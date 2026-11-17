-- Staff can move a member's due date (owner's decision of 2026-11-17):
-- - on the first payment, dues can start from any date, past or future;
-- - later, the next due date can be moved, and every later due follows it
--   (moved to the 10th, they fall due on the 10th each month after).
-- Months already owed move too: the change starts at the first month not
-- paid in full. Months already paid keep their dates, so no payment moves.
--
-- due_changes lists where the schedule was re-anchored, oldest first:
--   [{"from_period": 3, "due_on": "2026-12-10"}, ...]
-- Period n falls due on the due_on of the last change with from_period <= n,
-- (n - from_period) months on, and freezes push it back as before. due_on is
-- the date before freezes: the app works it out so the month shows exactly
-- the day staff picked. A change at period 0 replaces billing_starts_on.
--
-- It lives on memberships rather than in its own table so every screen that
-- reads a membership gets it in the same row, with no extra query per page
-- on the Worker. Owners and managers write it through the existing update
-- policy; the audit trigger records every change with before and after.

create function public.valid_due_changes(changes jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  this_period int;
  this_due date;
  prev_period int := -1;
  prev_due date;
begin
  if jsonb_typeof(changes) is distinct from 'array'
     or jsonb_array_length(changes) > 600 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(changes) loop
    -- Separate ifs: SQL does not promise to test an "or" left to right, and
    -- jsonb_object_keys fails on anything but an object.
    if jsonb_typeof(item) is distinct from 'object' then
      return false;
    end if;
    if (select count(*) from jsonb_object_keys(item)) <> 2
       or jsonb_typeof(item -> 'from_period') is distinct from 'number'
       or jsonb_typeof(item -> 'due_on') is distinct from 'string'
       or (item ->> 'from_period') !~ '^[0-9]{1,3}$'
       or (item ->> 'due_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      return false;
    end if;

    this_period := (item ->> 'from_period')::int;
    begin
      this_due := (item ->> 'due_on')::date;
    exception when others then
      return false;
    end;

    -- Matches the check on payments.first_period: fifty years of months.
    -- Later changes start later and fall due later, so dates never go
    -- backwards from one month to the next.
    if this_period >= 600 or this_period <= prev_period
       or (prev_due is not null and this_due <= prev_due) then
      return false;
    end if;
    prev_period := this_period;
    prev_due := this_due;
  end loop;

  return true;
end;
$$;
-- The check runs as whoever writes the row: owners and managers.
grant execute on function public.valid_due_changes(jsonb) to authenticated;

alter table public.memberships
  add column due_changes jsonb not null default '[]'::jsonb
  constraint memberships_due_changes_valid
  check (public.valid_due_changes(due_changes));

grant update (due_changes) on table public.memberships to authenticated;
