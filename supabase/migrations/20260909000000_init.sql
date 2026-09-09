-- Blood pressure tracker — initial schema.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ---------------------------------------------------------------- readings --

create table if not exists public.readings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  -- A calendar date, not a timestamp: a reading belongs to the day you took it,
  -- regardless of the timezone the app happens to be opened in later.
  measured_on  date not null,
  time_of_day  text not null default 'morning'
               check (time_of_day in ('morning', 'evening', 'other')),
  systolic     int  not null check (systolic  between 50 and 300),
  diastolic    int  not null check (diastolic between 30 and 200),
  pulse        int  check (pulse between 20 and 250),
  note         text check (note is null or length(note) <= 200),
  created_at   timestamptz not null default now(),
  constraint readings_systolic_above_diastolic check (systolic > diastolic)
);

create index if not exists readings_user_date_idx
  on public.readings (user_id, measured_on desc);

-- ------------------------------------------------------- push subscriptions --

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  -- The endpoint URL is the browser's own identifier for this subscription;
  -- unique so re-subscribing on the same device updates instead of duplicating.
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------- settings --

create table if not exists public.reminder_settings (
  user_id             uuid primary key references auth.users on delete cascade,
  timezone            text not null default 'Asia/Jerusalem',
  -- 0-23, or null to switch that reminder off.
  daily_reminder_hour int check (daily_reminder_hour between 0 and 23),
  missed_day_hour     int check (missed_day_hour between 0 and 23),
  updated_at          timestamptz not null default now()
);

-- --------------------------------------------------------------------- RLS --
-- Every table is scoped to the owning user. The reminder Edge Function uses the
-- service-role key and bypasses these policies by design.

alter table public.readings            enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.reminder_settings   enable row level security;

drop policy if exists readings_own on public.readings;
create policy readings_own on public.readings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists reminder_settings_own on public.reminder_settings;
create policy reminder_settings_own on public.reminder_settings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
