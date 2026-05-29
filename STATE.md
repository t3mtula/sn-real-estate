# SN Rental Manager — Session State

> **Update this file ทุกจบ session** · อ่านทุกเริ่ม session คู่กับ `memory/project_app_core.md`

## ✅ Session 2026-05-26 — Activity log track-changes + แก้ล่าสุด column

งานทั้งหมด deploy ขึ้น Cloudflare Pages แล้ว · CI ผ่าน ✅ (commit 85dc12e)

1. **Column "แก้ล่าสุด"** ใน contracts list — แสดง updated_at เป็น Thai short date + relative time ("3 วันที่แล้ว") + sort ได้
2. **Field-level diff** — "แก้สัญญา" entries แสดง field ที่เปลี่ยนด้วย label ไทย (26 fields tracked)
3. **Clause track-changes** — character-level LCS diff สีแดงขีดทับ=ลบ · สีเขียว=เพิ่ม · รองรับ sub-clause
4. **Clause log ระบุข้อ** — "แก้ข้อสัญญา ข้อ 1, 3" แทนที่ "แก้ข้อสัญญา (12 ข้อ)"
5. **Collapse UI** — 5 entries แรก + expand · diff collapse 3 รายการ + expand
6. **Bug fix** — isClauseEdit detection ผิด (ทำให้ "แก้สัญญา" ไม่แสดง diff) → fix ด้วย single-key shape check
7. **CI fix** — push commit ที่ค้างอยู่ พร้อมกับงานวันนี้ → CI ผ่าน

**ถัดไป:** ทดสอบ clause diff กับสัญญาจริง · Payment Reconciliation (Phase 1B-3d) · Print audit ค้าง

## ✅ Overnight 2026-05-22 → 2026-05-23 (sleep run · "ทำที่ค้างให้จบ")

ลุยตามที่ค้าง · all live · all commits on main · CI auto-deploy

1. **3e-1 Renewals page** (`/contracts/renewals`)
   - 5 KPI buckets (หมดแล้ว / 30 / 90 / 180 / ทั้งหมด) · progress bar per contract · sidebar entry "สัญญาใกล้หมด"

2. **3d-3 Batch monthly invoice gen** + bulk ops
   - "สร้างรายเดือน" dialog on /invoices · preview จะสร้าง/จะข้าม · เหตุผลข้าม (existing/cancelled/not_due/no_dates/no_rate) · reserve numbers locally to avoid race
   - Checkbox column + floating bulk action bar: บันทึกส่ง (drafts) · ยกเลิก (with reason)

3. **3d-4 Dashboard** (`/dashboard` · now landing page)
   - 8 KPI cards: ยอดเช่าต่อเดือน · ค้างชำระ · เกินกำหนด · occupancy · active · expiring · expired · ยังไม่ออกใบเดือนนี้
   - Top 5 overdue + Top 5 expiring drill-downs · ทุก card link ไปหน้าที่เกี่ยวข้อง
   - (Thailand map deferred to follow-up)

4. **3h-1 Activity log viewer** + wire audit into 6 entities
   - `/activity-log` route + sidebar entry "บันทึกกิจกรรม" · filter action + entity + search · typed Link to entity row
   - `logActivity` wired into mutations: contracts (create/update/cancel/restore) · tenants · landlords · properties · bank_accounts · contract_templates · invoices (create/cancel/restore/markSent/batch_generate/batch_void/batch_markSent)
   - **EntityAuditPanel** compact timeline on invoice detail + contract detail right rail

5. **3j Sublease chain UI** (ก→ข→ค)
   - Vertical chain on contract detail · current contract highlighted · ancestors (parent + grandparent) + direct children
   - New `useChildContracts` query (parent_contract_id eq) · auto-hides when no chain

6. **3g-2 Excel export** (5 lists)
   - Export Excel button on invoices · contracts · tenants · landlords · properties · aging report · Thai headers · BE stamp filename
   - Exports currently filtered/sorted rows

7. **3i Invoice PDF print** (`/invoices/$id/print`)
   - Build pdfmake doc · A4 portrait · landlord header + recipient + items + VAT totals + spell-amount + bank account + signatures · iframe preview + ดาวน์โหลด/สั่งพิมพ์
   - Route restructure: `invoices/$id.tsx` → `invoices/$id/index.tsx` + `invoices/$id/print.tsx`

8. **PRINT-3 Template editor** (shipped earlier in this session, kept)

**Build:** `tsc -b && vite build` pass · routeTree regen ผ่าน vite dev fast-loop · pushed to main 12+ commits · CI deploy

**ยังไม่ทำ overnight:**
- 3d-2 Payments + Reconciliation (big · ต้อง design กับ Tem)
- 3e-2 Meters น้ำ/ไฟ (ใหม่ทั้งระบบ)
- 3f-1 / 3f-2 (deposit return + move-out inspection — ต้อง flow design)
- 3h-2 Notification engine (LINE Notify needs backend setup)
- 3h-5 BE Date picker rewiring (needs careful per-form testing)
- 3l Address inline-edit (already mostly there in property form)
- 3k Pipeline Kanban (need Tem confirm ก่อน)

## ✅ Session 23 พ.ค. (บ่าย) — "ทำทุก feature ที่ v1 มี"

Coverage v2 vs v1 ตอนนี้ **≈ 75-80%** (จาก 55-60%)

Feature ที่เพิ่มใน session นี้ (branch `claude/exciting-bartik-ed52f8` · รอ merge):

1. **Template editor A4 preview split-view** — ซ้าย=แก้ข้อ · ขวา=preview real-time · toggle placeholder/ตัวอย่าง
2. **Follow-up system (3g-1)** — panel บน invoice detail + chip บน list + /reports/follow-up dashboard (4 buckets)
3. **Settings expansion (3 tab ใหม่)**:
   - ข้อมูลบริษัท (logo · bank · PromptPay · VAT · note)
   - พนักงาน (CRUD + role + signature)
   - การแสดงผล (witnesses · expiry/overdue thresholds)
   - ใบแจ้งหนี้ (VAT default · SlipOK API key)
4. **Payment recording** — mark paid/partial · method · date · ref · note → update paidAmount/status
5. **ใบเสร็จรับเงิน** — /invoices/$id/receipt (2 halves ต้นฉบับ+สำเนา)
6. **QR PromptPay** — canvas QR จาก EMVCo spec + card ใน invoice detail
7. **Global search (Cmd+K)** — ค้นหา contracts/invoices/properties/tenants จริง
8. **Per-contract clause override** — collapse panel บน contract detail
9. **Slip image upload** — base64 ใน invoice aside (view/upload/delete)
10. **รายงานลูกหนี้ค้างชำระ** — /reports/outstanding จัดกลุ่มตาม tenant
11. **สรุปรายเดือน** — /reports/monthly issued/paid/outstanding + year filter
12. **Thai ID checksum** — Mod-11 validate บน tenant schema
13. **Witness pre-fill** — ดึงจาก settings.display → contract form default
14. **app_settings + staff migration** — applied ใน Supabase prod

## 🎯 ตอนนี้กำลังทำอะไร
- **[v2] Print port** จาก v1 — ทำเสร็จ **Contract print** แล้ว (HTML+iframe overlay แทน pdfmake) · ถัดไป **Invoice/Receipt** → **Deposit return**
- Tem feedback (23 พ.ค. บ่าย): v1 print docs ดีกว่า v2 (Sarabun lock + navy + appendix) · v1 overlays ใช้ง่ายกว่า → ยกเลิก no-overlay rule

## 📋 Port v1 → v2 Roadmap (Tem 22 พ.ค. หลัง audit)

**กฎ Tem:** ทุก function v1 ต้อง port มา v2 · แต่ก่อน port ต้อง design ใหม่ให้ดีกว่า · ไม่ลอก v1 ตรงๆ แบบโง่ๆ

**Overlay policy (2026-05-23 update · revokes prior "no-overlay rule"):**
- ❌ **เลิกใช้** rule "ทุก modal/overlay → page route" (Tem: v1 overlays ใช้ง่ายกว่า)
- ✅ **Case-by-case**: เลือกตาม UX ที่ดีกว่า
  - **Print preview = overlay** (fullscreen dark + iframe srcdoc · ตาม v1) — ตอนนี้ Contract print ใช้ pattern นี้แล้ว
  - **Form/Detail** = page route ตามเดิมส่วนใหญ่ · แต่ถ้า quick-edit/picker/confirm ใช้ overlay ก็ได้ ถ้า UX ดีกว่า
- ต้อง **preserve context** ตอนเปิด overlay (no scroll loss · ESC ปิด · dirty-state warn ถ้าเป็น form)

**Coverage v2 vs v1 ตอนนี้ ≈ 30-35%** (audit agent run 22 พ.ค. · เห็นทั้ง 22 modules)

### Sprint หน้า (must-have ก่อน v1 retire)
- **3d-2** Payments + Reconciliation core (รับเงิน · slip · SlipOK · QR PromptPay · ใบเสร็จ · ค้างชำระข้ามเดือน) — port modules/19-invoices.js · ลูกน้องใช้ทุกวัน — **task #2**
- **3d-3** Invoice ops ครบ (generate รายเดือนทั้งระบบ · void · audit log viewer · monthly summary) — task #7
- **3d-4** Dashboard + แผนที่ TH + KPI (port modules/12-dashboard.js + TH_PATHS) — task #3
- **Audit Phase B** modal → page route (ลบ/ยกเลิก/แจ้งออก/void · 8-10 routes ใหม่) — task #6

### Sprint ถัดไป (ลูกน้องใช้บ่อย)
- **3e-1** Renewals page + renew/copy contract — task #8
- **3e-2** Meters น้ำ/ไฟ (grid + paste Excel) — task #9
- **3g-1** Aging + Outstanding + Follow-up reports — task #12
- **3g-2** Excel import + export — task #13
- **3h-1** Activity log viewer (audit_log ม data อยู่แล้ว) — task #14
- **3h-2** Notification engine + LINE Notify — task #15
- **3h-5** BE Date picker (ปัจจุบันแสดง พ.ศ. แต่ picker ยัง AD) — task #18

### Backlog (long-tail)
- 3f-1 คืนเงินประกัน · 3f-2 ตรวจรับคืนทรัพย์ — task #10, #11
- 3h-3 Template editor (clause สัญญา) — task #16
- 3h-4 Batch operations (print/sign/generate multiple) — task #17
- 3i Print system ครบ (invoice/receipt/deposit/inspection PDF) — task #19
- 3j Sublease chain UI (parent_contract_id) — task #20
- 3l Address inline-edit + property images (Supabase Storage) — task #22
- 3k Pipeline Kanban — ⚠️ ขอ confirm Tem ก่อนทำ — task #21

### Skip
- Auto-backup IDB (Supabase backup เอง)
- Data fix tool (v2 schema เคร่งจาก zod)
- Onboarding tour
- PIN login (Google OAuth แทน)

### Working principle (task #23 · apply ทุก task)
1. อ่าน v1 module ที่เกี่ยวข้องทั้งไฟล์
2. List edge case + business rule v1 ที่ implicit
3. เทียบกับ Tem rule (no overlay · page-based · ไทย · ลูกน้องใช้ทุกวัน)
4. Propose v2 design ที่ดีกว่า (ไม่ลอก 1:1 · ปรับ flow ให้ shorter/clearer)
5. ขอ Tem confirm ก่อน implement

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

## ✅ งานที่จบในรอบล่าสุด (2026-05-22 session #5)
1. **v2 Phase 1B-3b — Property Owner field (ownerLandlordId)**
   - **Schema**: เพิ่ม `PropertyData.ownerLandlordId?: string` เก็บใน jsonb data field (ไม่ต้อง column ใหม่)
   - **Form**: Select dropdown "ผู้ให้เช่า (เจ้าของในระบบ)" จาก useLandlords() · pattern เลียน bank-account-form · sentinel "none" = ไม่ระบุ · เก็บ field "เจ้าของอื่น" free-text (owner) เป็น fallback legacy
   - **Property detail**: แสดงชื่อ owner landlord + clickable link ไป /landlords/$id · ถ้าไม่ตั้งแสดง owner free-text แทน · มี secondary row "เจ้าของอื่น (หมายเหตุ)" ถ้ามีทั้ง 2
   - **Landlord detail**: เพิ่ม card "ทรัพย์สินที่เป็นเจ้าของ" (filter properties.data.ownerLandlordId === landlord.id) · empty state + ul list (ทรัพย์/ประเภท/ที่อยู่/multi-tenant badge)
   - **Migration SQL** (`20260522000001_seed_property_owner_landlord.sql` · commit f52c656 fix int→bigint): seed จาก most-frequent landlord ของ active contracts · 3-fallback match (landlord_id direct / invoiceHeaderId / name) · idempotent · cast `::bigint` (v2 pid = Date.now() ~13 หลัก) · **Tem apply ผ่าน Supabase dashboard เพราะ MCP ตาย session นี้**
   - **Verify production จริง**: นายสมบัติ พิษณุไวศยวาท (1777947942182) มี 7 ทรัพย์สิน + 3 บัญชี + 7 สัญญาขึ้นครบใน landlord-detail page · seed match ทำงาน ✓
   - **Commit**: 1026c3e push main · CI deploy v2 · f52c656 fix migration cast
   - **ยังไม่ทำ**: Sublease chain UI (รอ Phase 1B-3c contracts มี parent_contract_id)

## ✅ งานที่จบในรอบล่าสุด (2026-05-22 session #4)
1. **v2 perf — fix YhAuthSync re-subscribe loop + ลบ starter cruft** (Tem feedback: เปิดทิ้งไว้แป้ปนึงค้าง)
   - **Root cause หลัก**: YhAuthSync effect dep `[auth]` + `useAuthStore()` แบบ full subscribe → ทุก setState ทำให้ `auth` ref change → effect re-run → unsub+resub Supabase listener · callback เรียก `setUser` + `setAccessToken` อีก 2 setState → leak listeners + setState loop → idle freeze
   - **แก้**: ย้าย store access ไปอ่านใน effect body + callback ผ่าน `useAuthStore.getState()` · เปลี่ยน dep เป็น `[]` · subscribe ครั้งเดียวตอน mount
   - **Round 1 (เสริม)**: ลบ starter cruft features (apps, chats, dashboard, tasks, users) + routes (apps, chats, tasks, users, help-center) · redirect `/` → `/properties` · ลบ "หน้าแรก" nav + LayoutDashboard icon · ปิด ReactQueryDevtools + TanStackRouterDevtools ใน __root.tsx
   - **Verify**: build pass 17.88s · routeTree.gen.ts regen · dev preview: / → /properties redirect ✓ · /landlords navigate ✓ · console clean · 0 failed requests · screenshot ยืนยัน sidebar + devtools หาย
   - **Commit**: 27a4af8 push main · CI auto-deploy v2 Cloudflare Pages (~2-3 นาที)
   - **รอ Tem ทดสอบหลัง deploy** — ถ้าเปิดทิ้งไว้แล้วไม่ค้าง = root cause ถูก · ถ้ายังค้าง = profile Chrome DevTools Performance + Memory tab ต่อ

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
