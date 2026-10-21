-- Each table is private to the authenticated Edge Function. No direct browser grants.
create table if not exists public.n12c_review_snapshots (
  id uuid primary key default gen_random_uuid(), cutoff_date date not null,
  source_name text not null, payload jsonb not null, created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists n12c_review_snapshots_date_idx on public.n12c_review_snapshots(cutoff_date desc,created_at desc);
create table if not exists public.n12c_review_reports (
  id uuid primary key default gen_random_uuid(), snapshot_id uuid not null references public.n12c_review_snapshots(id),
  employee_id text not null, report_date date not null, payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','returned','approved')),
  manager_review jsonb, revision integer not null default 1 check(revision>0),
  submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(employee_id,report_date)
);
create index if not exists n12c_review_reports_snapshot_idx on public.n12c_review_reports(snapshot_id);
create table if not exists public.n12c_review_access (
  token_hash text primary key, employee_id text not null, expires_at timestamptz not null,
  revoked boolean not null default false, created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists n12c_review_access_employee_idx on public.n12c_review_access(employee_id);
create table if not exists public.n12c_review_settings (
  id text primary key check(id='current'), payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.n12c_review_login_limits (
  key_hash text not null, window_id bigint not null, attempts integer not null default 1,
  primary key(key_hash,window_id)
);
alter table public.n12c_review_snapshots enable row level security;
alter table public.n12c_review_reports enable row level security;
alter table public.n12c_review_access enable row level security;
alter table public.n12c_review_settings enable row level security;
alter table public.n12c_review_login_limits enable row level security;
revoke all on public.n12c_review_snapshots,public.n12c_review_reports,public.n12c_review_access,public.n12c_review_settings,public.n12c_review_login_limits from public,anon,authenticated;
grant select,insert,update,delete on public.n12c_review_snapshots,public.n12c_review_reports,public.n12c_review_access,public.n12c_review_settings,public.n12c_review_login_limits to service_role;
create or replace function public.n12c_review_count_login(p_key text,p_window bigint)
returns integer language sql security invoker set search_path='' as $$
  insert into public.n12c_review_login_limits(key_hash,window_id,attempts) values(p_key,p_window,1)
  on conflict(key_hash,window_id) do update set attempts=public.n12c_review_login_limits.attempts+1 returning attempts;
$$;
revoke all on function public.n12c_review_count_login(text,bigint) from public,anon,authenticated;
grant execute on function public.n12c_review_count_login(text,bigint) to service_role;
comment on table public.n12c_review_reports is 'Daily KPI improvement reports; Edge Function enforces employee scope, validation and review state.';
