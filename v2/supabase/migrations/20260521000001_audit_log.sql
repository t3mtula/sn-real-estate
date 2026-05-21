-- ============================================================
-- audit_log table · ทุก mutation บันทึกที่นี่ (PDPA + forensic)
-- ใช้ผ่าน logActivity() helper จาก @/lib/audit-log
-- ============================================================

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  action      text not null check (action in ('create', 'update', 'delete', 'restore', 'login', 'logout', 'custom')),
  entity      text not null,            -- ชื่อ table หรือ feature (เช่น 'contracts', 'invoices')
  entity_id   text,                     -- id ของ record ที่กระทบ (ถ้ามี)
  description text,                     -- ภาษาคน (เช่น 'สร้างสัญญา RE-2569-042')
  before      jsonb,                    -- snapshot ก่อนเปลี่ยน (สำหรับ update/delete)
  after       jsonb,                    -- snapshot หลังเปลี่ยน (สำหรับ create/update)
  ip_address  text,
  user_agent  text
);

create index if not exists audit_log_user_id_idx on public.audit_log(user_id);
create index if not exists audit_log_entity_idx on public.audit_log(entity, entity_id);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);
create index if not exists audit_log_action_idx on public.audit_log(action);

-- RLS: user เห็นเฉพาะ log ของตัวเอง · admin เห็นทั้งหมด
alter table public.audit_log enable row level security;

create policy "users can read own audit_log"
  on public.audit_log for select
  using (auth.uid() = user_id);

create policy "users can insert own audit_log"
  on public.audit_log for insert
  with check (auth.uid() = user_id);

-- (admin policy ตั้งเพิ่มเองตาม role ของแต่ละ app)

comment on table public.audit_log is 'Activity log for PDPA + business forensic';
comment on column public.audit_log.action is 'one of: create, update, delete, restore, login, logout, custom';
comment on column public.audit_log.before is 'record snapshot before change · use jsonb for flexibility';
comment on column public.audit_log.after is 'record snapshot after change';
