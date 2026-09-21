-- Finance Tracker: схема, политики доступа и индексы.
-- Выполнить целиком в Supabase → SQL Editor → New query → Run.
--
-- Модель безопасности: anon key публичен и попадает в собранный бандл — это
-- нормально и так задумано. Данные защищает Row Level Security: каждая
-- политика ниже пропускает только строки текущего пользователя.

-- ---------------------------------------------------------------- таблицы

create table if not exists public.app_settings (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  theme           text not null default 'system',
  month_start_day smallint not null default 1
);

create table if not exists public.categories (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('expense', 'income')),
  color      text not null,
  icon       text not null,
  sort_order integer not null default 0,
  archived   boolean not null default false
);

create table if not exists public.accounts (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('cash', 'card', 'savings')),
  initial_balance numeric(14, 2) not null default 0,
  color           text not null,
  archived        boolean not null default false
);

create table if not exists public.recurring_rules (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  kind        text not null check (kind in ('expense', 'income')),
  amount      numeric(14, 2) not null check (amount > 0),
  category_id text not null references public.categories (id) on delete cascade,
  account_id  text not null references public.accounts (id) on delete cascade,
  freq        text not null check (freq in ('day', 'week', 'month', 'year')),
  interval_n  integer not null default 1 check (interval_n > 0),
  next_run_at date not null,
  ends_at     date,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.transactions (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('expense', 'income')),
  -- Сумма всегда положительная; знак определяет kind.
  amount       numeric(14, 2) not null check (amount > 0),
  category_id  text not null references public.categories (id) on delete cascade,
  account_id   text not null references public.accounts (id) on delete cascade,
  occurred_at  date not null,
  note         text,
  recurring_id text references public.recurring_rules (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.goals (
  id            text primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date   date,
  color         text not null,
  icon          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.goal_contributions (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  goal_id     text not null references public.goals (id) on delete cascade,
  amount      numeric(14, 2) not null,
  occurred_at date not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.task_templates (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  -- Дни недели как в JS Date.getDay(): 0 — воскресенье … 6 — суббота.
  weekdays   smallint[] not null check (cardinality(weekdays) > 0),
  -- С этого дня начнётся следующее создание задач; всё до него уже создано.
  next_day   date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  day         date not null,
  done        boolean not null default false,
  template_id text references public.task_templates (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- индексы

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_at desc);
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id, occurred_at desc);
create index if not exists recurring_user_next_idx
  on public.recurring_rules (user_id, next_run_at);
create index if not exists contributions_goal_idx
  on public.goal_contributions (goal_id);
create index if not exists tasks_user_day_idx
  on public.tasks (user_id, day desc);

-- ------------------------------------------------------------------- RLS

alter table public.app_settings        enable row level security;
alter table public.categories          enable row level security;
alter table public.accounts            enable row level security;
alter table public.recurring_rules     enable row level security;
alter table public.transactions        enable row level security;
alter table public.goals               enable row level security;
alter table public.goal_contributions  enable row level security;
alter table public.task_templates      enable row level security;
alter table public.tasks               enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings', 'categories', 'accounts',
    'recurring_rules', 'transactions', 'goals', 'goal_contributions',
    'task_templates', 'tasks'
  ]
  loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I
         for all
         to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end
$$;

-- --------------------------------------------- стартовые данные для нового
-- Категории и счета создаёт клиент при первом входе, поэтому триггера здесь
-- нет: так набор по умолчанию остаётся в одном месте (src/lib/seed.ts).
