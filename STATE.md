# SN Rental Manager — Session State

> **Update this file ทุกจบ session** · อ่านทุกเริ่ม session คู่กับ `memory/project_app_core.md`

## 🎯 ตอนนี้กำลังทำอะไร
- (ว่าง — เพิ่งจบ v2 perf fix: ลบ starter cruft (5 features + 6 route groups) + ปิด devtools 2 ตัว + redirect / → /properties · ลด dev mode lag/ค้าง ตามที่ Tem feedback · ระบบลื่นขึ้น · รอ Tem hard reload เช็คใน Chrome · ถ้ายัง lag ค่อย profile devtools Performance tab)

## ⏳ งานค้าง / Next
- **🐛 v2 Mobile Chrome iOS bug — `/tenants` + `/properties` + `/landlords` แสดง 0/0 ราย** (PC desktop ใช้ได้ปกติ) · 2026-05-22 พบครั้งแรก · iPhone Chrome (CriOS) · Tem login Google ผ่าน · API logs ตอบ HTTP 200 · เดา: supabase-js v2 session restore ไม่ทำงานบน iOS Chrome (มี [Lesson Hunza](https://www.notion.so/366fdba535ca81218a09f29d7e7cd4e1) · workaround = wrap supabase.from() ด้วย direct fetch + Bearer token จาก onAuthStateChange) · **Tem ผ่านได้เพราะใช้ PC เป็นหลัก · debug รอบหน้า**
- **⭐ Phase 1B-3b: Property Owner + Sublease Chain**
  - เพิ่ม `properties.ownerLandlordId` field · seed จาก most-frequent landlord ของ property ใน contracts ปัจจุบัน
  - UI Property form/detail: dropdown เปลี่ยนเจ้าของ · show contract chain ใน detail
- **⭐ Phase 1B-3c: Contracts feature**
  - contract list + form: pick tenant + landlord + bank_account_id (อิสระ) + parent_contract_id (กรณีเช่าช่วง) + cancel + print
  - หน้า property A → แสดง chain: Contract #1 (ก→ข) + Contract #2 (sublease #1: ข→ค)
  - Schema plan: [memory/project_sublease_and_bank_design.md](~/.claude/projects/-Users-tem-Documents-Claude-Projects-App---SN-Real-Estate/memory/project_sublease_and_bank_design.md)
- **⭐ Phase 1B-3d: Payment + Reconciliation** (Tem note 2026-05-22 รอบ 2)
  - ตอนรับเงิน trace กลับได้ทันที: slip → bank_account → contract → property/ห้อง · ดูได้ว่าเงินก้อนนี้ของห้องไหน
  - มุมมอง per-landlord / per-bank: ใครได้รับเงินจากใคร เข้าบัญชีไหน รวมเท่าไหร่ · ยอดหนี้เท่าไหร่ · "ชน/ไม่ชน"
  - Close loop: ต้องได้รับ vs ได้รับจริง vs outstanding (ลูกหนี้ค้าง) วน dashboard
  - Schema: `payments` table (slip + bank_account_id + allocations[] = invoices ที่จับคู่) + reuse SlipOK + auto-match v1
  - Schema plan: [memory/project_payment_reconciliation_design.md](~/.claude/projects/-Users-tem-Documents-Claude-Projects-App---SN-Real-Estate/memory/project_payment_reconciliation_design.md)
- **Landlord data cleanup** — บัญชีธนาคารบางคู่ duplicate เพราะ whitespace ใน raw data (เช่น นายอยุทธ์ มี 4 rows แต่จริง 2 unique) · ลูกน้องลบผ่าน UI edit ได้ (หรือรวมงานกับ Phase 1B-3 bank refactor)
- **taxId ของ landlords ทุกราย ว่าง** — ลูกน้องค่อยกรอกผ่าน UI edit (ตามกฎ data fix ผ่าน UI)
- **นางน้ำนอง (SST.001-2569)** ยังอยู่ใน tenants v2 แบบไม่มี taxId — ลูกน้องเก็บ taxId จริงตอน renewal ผ่าน contract UI
- 21 company tenants + 5 company landlords ยังขาดกรรมการลงนาม (Excel ไม่มี · ลูกน้องกรอกผ่าน UI / Dashboard แสดงเตือนแล้ว · ใน v2 tenants detail ก็เห็น)
- 12 contracts ยังไม่มี dur/payment (Excel ก็ไม่มี — สัญญาใหม่ที่เพิ่มหลัง import)
- 3 hardcoded prefix lists ใน html ยังไม่ unified (preexisting v1)
- ถ้าอยากเร็วกว่านี้: แยก backups ออกจาก re_config เป็น table แยก (Phase 3)

## ✅ งานที่จบในรอบล่าสุด (2026-05-22 session #4)
1. **v2 perf — ลบ yonghua-starter cruft + ปิด devtools** (Tem feedback ว่า v2 ใน Chrome รู้สึก lag/ค้าง)
   - Root cause: TanStack file-router pre-load ทุก route ตอน boot รวม starter placeholders ที่ไม่ใช้ + Router/Query devtools auto-mount กิน main thread
   - **ลบ features**: apps, chats, dashboard, tasks, users
   - **ลบ routes**: _authenticated/{apps, chats, tasks, users, help-center}
   - **routes/_authenticated/index.tsx**: rewrite จาก mount Dashboard → `beforeLoad: redirect({ to: '/properties' })`
   - **sidebar-data.ts**: ลบ nav item "หน้าแรก" + LayoutDashboard icon (ไม่ต้อง redirect 2 ชั้นใน UI)
   - **__root.tsx**: ลบ ReactQueryDevtools + TanStackRouterDevtools imports + dev-only block
   - **Verify**: build pass 16.25s · routeTree.gen.ts regenerate ไม่มี ref ของ deleted routes · dev preview test: / → /properties redirect ✓ · /landlords navigate ✓ · console clean · 0 failed requests · screenshot ยืนยัน sidebar update + devtools buttons หาย
   - **commit pending** — รอ Tem hard reload เช็คเอง

## ✅ งานที่จบในรอบล่าสุด (2026-05-22 session #3)
1. **v2 Phase 1B-3a Bank Accounts module** — first-class entity แยก (ตาม design rule ที่ Tem note)
   - **Migration**: สร้าง public.bank_accounts (id text + data jsonb + RLS is_re_staff + idx ownerLandlordId/active)
   - **Seed + dedupe**: unnest landlords.data.banks[] → 22 unique บัญชี (ลดจาก ∼30 entries · dedupe key = owner + acctNo digits-only)
     - แก้ duplicate bug ของ Phase 1B-2: นายอยุทธ์ 4→2 · เอเวอร์มอร์ 2→1 · สมบัตินภา 4→3 · ทรายย่งฮั้ว 5→4
   - **UI ครบ**: list (search + filter by owner) · detail · add/edit form (bank/acctNo/accountName/label/owner select/active switch/notes) · delete
   - **bank-account-new รับ ?owner=xxx** สำหรับ pre-fill จาก landlord-detail
   - **Sidebar เพิ่มเมนู "บัญชีธนาคาร"** ระหว่าง ผู้ให้เช่า → สัญญาเช่า
   - **Refactor landlord**:
     - landlord-form: ลบ banks editor section (7 sections → 6)
     - landlord-detail: ใช้ useBankAccountsByOwner(landlord.id) · เพิ่มปุ่ม "เพิ่มบัญชี" link ไป /bank-accounts/new?owner=...
     - landlord list: bank count จาก useBankAccounts() group by owner
     - schema/types: ลบ banks field (เก็บ @deprecated สำหรับ rollback safety)
   - **Commit**: 6ff814d
   - **Live verify ผ่าน** — list (22/22) · detail (นายอยุทธ์ 2 บัญชี dedupe ถูก) · click bank → bank-account detail

## ✅ งานที่จบในรอบล่าสุด (2026-05-22 session #2)
1. **v2 Phase 1B-2 Landlord section** — first-class entity แยกจาก contract
   - **Migration**: สร้าง public.landlords (id text + data jsonb + RLS is_re_staff + soft-unique on taxId + idx name/partyType)
   - **Seed**: 14 landlords จาก invoice_headers (1:1) + aggregate signers (most-frequent) + banks list จาก contracts (4 ราย multi-bank · max 6) · address parse v1 string → 5 ช่อง
   - **UI ครบ**: list (search/filter/sort + bank count + contract count) · detail (info + banks list + PromptPay + linked contracts) · add/edit form (radio toggle + logo upload + ที่อยู่ 5 ช่อง + banks editor (max 10 rows) + VAT toggle/rate + PromptPay (id/bank/name) + notes)
   - **partyType detection**: regex `^(บริษัท|บจก.|บมจ.|หจก.|ห้าง)` → 7 person + 7 company
   - **v1 ไม่กระทบ** — contracts.data ยังเก็บ landlord inline · invoice_headers ยัง intact (จะลบทีหลัง v1 retire)
   - **Sidebar**: เพิ่ม "ผู้ให้เช่า" ระหว่าง ผู้เช่า — สัญญาเช่า
   - **Commit**: e649801
   - **Live verify ผ่าน** — list (14/14), detail (4 banks + 26 contracts derive), edit form (all sections preload ครบ)

## ✅ งานที่จบในรอบล่าสุด (2026-05-22 session #1)
1. **v2 Phase 1B-1 Tenants section** — first-class entity แยกจาก contract
   - **Migration**: สร้าง public.tenants table (id text + data jsonb + RLS is_re_staff · soft-unique on data->>taxId)
   - **Seed 113 tenants** จาก 143 contracts: 107 group by taxId · 6 group by name (no-taxId + SST.001-2569 ที่ taxId ผิด)
   - **17 นิติบุคคล + 96 บุคคลธรรมดา** detect จากชื่อ (บริษัท/บจก./บมจ./หจก./จำกัด/มหาชน → company)
   - **UI ครบ**: list (search/filter/sort + count สัญญา) · detail (info + linked contracts + delete confirm) · add/edit form (radio toggle บุคคล/นิติบุคคล · signer + branch โผล่ตอน company · ที่อยู่ 5 ช่อง)
   - **Passport support** — taxId field รับทั้ง 13 หลัก + alphanumeric
   - **Dup-check**: pre-flight throw DuplicateTaxIdError → toast พร้อมปุ่ม "ดู" link ไป tenant ที่ชน
   - **v1 ไม่กระทบ** — เป็น additive · contracts.data ยังเก็บ tenant inline เหมือนเดิม
   - **Sidebar**: เพิ่ม "ผู้เช่า" ระหว่าง ทรัพย์สิน — สัญญาเช่า
   - **Commit**: 33a1778 (thai-address split Properties → 5 fields) + 5651921 (tenants section)
2. **v2 Properties thai-address split** — refactor Properties form ให้ address แยกเป็น 5 ช่อง (เลขที่/ตำบล/อำเภอ/จังหวัด/ไปรษณีย์) + cascade autocomplete · Tem verified ก่อน commit

## ✅ งานที่จบในรอบก่อนๆ (2026-05-17 session)
1. **Passport support** — taxId field รับตัวอักษรได้ (auto-detect mode Thai ID vs passport)
2. **Prefix dropdown** ใน 3 fields: signers config, tenantSigner, witness 1+2
3. **Helpers**: `isCompanyName` / `withPrefix` / `hasPrefix(includes-based)` / `splitPrefix` / `_combineName` / `sigBoxParty`
4. **นิติบุคคล + ผู้ลงนาม support end-to-end**:
   - Contract form: prefix dropdown มี optgroup บุคคล/นิติบุคคล + JS toggle hint
   - viewContract: badge "🏢 นิติบุคคล" / "👤 บุคคลธรรมดา" + warning ถ้าขาด signer
   - Print sigBox: multiline สำหรับนิติบุคคล (บริษัท / โดย กรรมการ / ตำแหน่ง)
5. **DB cleanup**: 4 entries (verify จริงผ่าน SQL: 141 contracts, 0 ขาด prefix, 0 ขึ้น "โดย")
   - 2 signers ใน sysConfig (เพิ่ม "นาย")
   - 2 contracts witness1 (เพิ่ม "นาย")
   - 1 tenantSignerName strip "โดย" (สช.7149/2569)
6. **Audit + cleanup** (post-session): ลบ `partyDisplay` ที่เป็น dead code · click-verify บน live URL ผ่าน (badge + warning + label swap ทำงานครบ)
7. **Backfill 3 company contracts** (SQL migration ครั้งเดียว, Tem approve case-by-case) — strip "โดย…" ออกจาก tenant + set tenantSignerName:
   - SN.005-2569 → นางสุเนตรา จินตนาธัญชาติ
   - SN.006-2569 → นายวรัญญู พักตร์ฉวี
   - EV-68-001 → นางสาวนฤมล กมลพันธ์ทิพย์

## 📋 Decisions สำคัญในรอบนี้ (เพิ่มจาก project_app_core.md)
- (ครอบคลุมแล้วใน project_app_core.md "Decisions ที่ตัดสินใจแล้ว")

## 🐛 Known issues / data quality
- **21 ใน 25 active company contracts ยังขาด `tenantSignerName`** (จาก 24 — backfill 3 รายที่ Excel มีข้อมูล: SN.005-2569, SN.006-2569, EV-68-001) · UI ยังแสดง ⚠ warning ใน 21 ใบที่เหลือ · ต้องรอ paper / โทรถาม หรือกรอกตอน renewal
- 3 hardcoded prefix lists ใน html ยังไม่ unified (ALL_NAME_PREFIXES vs tenant form local vs signer pfxOpts) — preexisting ขัด lesson `unify_forms`

## 📍 Latest commits (branch `claude/sharp-curie-eaa567` push main)
- `feat(template-editor): collapsible clauses + TOC nav + preview toggle + history`
- `feat(template-editor): UX upgrade — sticky footer, dirty guard, tooltips, confirms`
- `feat(dashboard+form): เพิ่ม 3 data alerts + deposit checkbox + madeAt auto-fill`
- `perf(load): กรอง backup snapshots ออกจาก re_config fetch + cleanup เก่า`
- `docs(state): backfill 3 company contracts จาก Excel`
- `chore(cleanup): ลบ partyDisplay helper ที่ไม่ถูกเรียกใช้`
- `feat(juristic): support นิติบุคคล + ผู้ลงนาม ครบ end-to-end`
- `fix(prefix): revert staff prefix UI + hasPrefix ใช้ includes`
- `feat(print): apply withPrefix() ใน sigBox ทุกที่`

## 🚀 ที่ Tem ใช้ตอนนี้
- Branch deploy: https://sn-real-estate.pages.dev/
- Worktree: `.claude/worktrees/sharp-curie-eaa567/`

## 💬 Session opening flow (สำหรับ Claude)
1. อ่าน `memory/project_app_core.md` → รู้ core concept
2. อ่าน STATE.md (ไฟล์นี้) → รู้ตอนนี้อยู่ตรงไหน
3. Fetch Notion Work Log 3-5 entries ล่าสุด → cross-check
4. Brief Tem 3-5 บรรทัด → "พร้อมรับงาน"
