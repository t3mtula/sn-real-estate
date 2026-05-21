# SN Real Estate v1 → v2 · Feature Audit

> ทุก feature ที่ v1 มี · Tem mark `[M]` MUST · `[N]` NICE · `[S]` SKIP
> v2 จะ build เฉพาะ MUST ก่อน · NICE port ทีหลัง · SKIP ตัดทิ้ง
>
> ทุก checkbox ใน 1 บรรทัด = 1 การตัดสินใจที่ Tem mark แยกได้
> Code refs ใช้ inline `code` style เพื่อให้ Claude ไป trace ต่อใน v1 ตอน implement

---

## Section A · Properties (ทรัพย์สิน)

> Supabase: `real_estate.properties` (id text PK, data jsonb, timestamps) — ทุก field อยู่ใน `data` blob (ไม่ใช่ column)

### A1. Data fields (จาก v1 model + `14-contracts.js` form)

โครงสร้าง property object ใน v1 (อยู่ใน `DB.properties[]` array — ดู `02-state.js` line 2 + `14-contracts.js` `openAddPropertyDialog`/`editProperty`):

- [ ] `pid` — `number` · primary key auto-increment (max+1 logic ใน `14-contracts.js:718`) · เริ่มที่ 200 (`DB.nextPId` ใน 02-state.js)
- [ ] `name` — `text` required · ชื่อทรัพย์สิน (`14-contracts.js:706`) · มี duplicate detection แบบ live (`propCheckDup`)
- [ ] `type` — `text` required · ประเภท · ใน `13-properties.js:1134` มี enum 6 ค่า: `shophouse` ห้องแถว/อาคารพาณิชย์ · `land_with_house` ที่ดินพร้อมสิ่งปลูกสร้าง · `vacant_land` ที่ดินเปล่า · `rooftop_tower` ดาดฟ้า/เสาส่งสัญญาณ · `apartment` อพาร์ตเมนต์ · `other` อื่นๆ. แต่ฟอร์ม add ใช้ free-text + datalist (`14-contracts.js:649`) — ❓ ตรวจพบ inconsistency: add form = free text, edit dialog = enum select
- [ ] `location` — `text` required · จังหวัด (สถานที่) · free-text + datalist จาก existing (`14-contracts.js:653`)
- [ ] `address` — `text` · ที่อยู่ละเอียด · ประกอบจาก sub-fields: เลขที่/หมู่/ซอย/ถนน, ตำบล/แขวง, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์ 5 หลัก (`assemblePropAddr` ใน `14-contracts.js:513`)
- [ ] `titleDeed` — `text` · เลขโฉนด · ใช้แทน address ถ้า address ว่าง (`getPropertyAddress` ใน `13-properties.js:38`)
- [ ] `area` — `text` · เนื้อที่ free-text เช่น "2 ไร่ 1 งาน 50 ตร.วา" (`14-contracts.js:641`)
- [ ] `owner` — `text` · เจ้าของ (เห็นใน edit dialog แต่ไม่ปรากฏใน add form · `13-properties.js:1191`)
- [ ] `multiTenant` — `boolean` · ทรัพย์สินแบ่งได้หลายผู้เช่าพร้อมกัน (ดาดฟ้า, ที่ดินใหญ่) — ถ้า true ระบบจะ skip การเตือน "สัญญาซ้อน" (`isMultiTenantProperty` ใน `13-properties.js:25`) · default true ถ้า `type === 'rooftop_tower'`
- [ ] `status` — `text` · 'occupied' / 'vacant' / 'active' (เห็นใน edit dialog แต่ไม่บังคับใช้ที่ไหนชัดเจน) — ❓ ตรวจพบว่า status ทรัพย์สินคำนวณจาก contracts จริงๆ ไม่ใช่จาก field นี้ (`propInfo` ใน `13-properties.js:58`)
- [ ] `images` — `array<base64 dataURL>` · รูปภาพแนบ · เพิ่มได้หลายรูป · จำกัดขนาด 3MB/รูป · ไม่มี compression (`propAddImages` ใน `14-contracts.js:442`)
- [ ] `province` / `addr_province` — `text` · จังหวัดที่ดึงออกมาแยก (ใช้กับแผนที่ + รายงาน · ดู `27-province-fill.js`)
- [ ] `created_at` / `updated_at` — `timestamptz` · มี Supabase แต่ไม่แสดงใน UI

### A2. List page actions (จาก `13-properties.js` `renderProperties`)

- [ ] ดูตาราง group by จังหวัด (เฉพาะตอน sort by ชื่อ) · ลำดับ default = ราชบุรี → กรุงเทพฯ → เชียงใหม่ → กาญจนบุรี → นครปฐม → อื่นๆ (`13-properties.js:208`)
- [ ] Search box · ค้นชื่อทรัพย์ / ที่อยู่ / ชื่อผู้เช่า / เลขสัญญา · debounced 300ms
- [ ] Filter ประเภท (dropdown จาก unique types)
- [ ] Filter จังหวัด (dropdown จาก unique locations)
- [ ] Filter สถานะ: ทั้งหมด · มีผู้เช่า · ว่าง · สัญญาใกล้หมด · ที่อยู่ไม่ถูกต้อง · ค้างรับเงินประกัน
- [ ] Sort: ชื่อ ก-ฮ · ค่าเช่า มาก→น้อย · จำนวนสัญญา · สิ้นสุดเร็วสุด · เริ่มสัญญา · สถานะ · ผู้เช่า ก-ฮ · ผู้ให้เช่า ก-ฮ
- [ ] Click row → expand แสดงรายการสัญญาใน-line (`togglePropExpand`)
- [ ] แต่ละ row แสดง progress bar ของสัญญาหลัก (% ผ่านไป + เหลือกี่วัน) · สี เขียว/เหลือง/แดง ตามเหลือ
- [ ] Tab bar บนสุด: ทรัพย์สิน · สัญญาเช่า · ใกล้หมดอายุ (พร้อม badge count)
- [ ] KPI summary cards: ทรัพย์สิน · สัญญามีผล · ยกเลิก · บ./เดือน · บ./ปี
- [ ] Occupancy donut chart · % การเช่า
- [ ] Type distribution mini bars · top 5 ประเภท
- [ ] Banner เตือน "ที่อยู่ไม่ถูกต้อง" / "ไม่มีจังหวัด" / "ค้างรับเงินประกัน" (click filter)
- [ ] Badge "ซ้อน!" บน row ที่มีสัญญาทับช่วงเวลา · click → `showOverlapDetail` modal (`20-context-menu-cf.js:36`)
- [ ] Empty state: "ยังไม่มีทรัพย์สิน" + ปุ่ม "+ เพิ่มทรัพย์สิน"
- [ ] ปุ่ม "+ เพิ่มทรัพย์สิน" เปิด add dialog
- [ ] "เติมจังหวัด" tool · เปิด `openProvinceFillTool` (จาก `27-province-fill.js`)

### A3. Detail page actions (จาก `14-contracts.js` `openPropertyDetail`)

- [ ] เปิดเป็น modal (ไม่ใช่หน้า) — `$('mtitle')` + `$('mbody')`
- [ ] แสดงข้อมูล: ประเภท, สถานที่, ที่อยู่, พื้นที่, เลขโฉนด · มี badge "หลายผู้เช่า" ถ้า multiTenant
- [ ] แสดง banner เตือนถ้า `isBadAddr(p)` (ที่อยู่ไม่ถูกต้อง)
- [ ] รูปภาพ gallery — แสดง thumbnail, click ดูเต็ม, ลบ, prev/next navigation (`propViewImage`)
- [ ] ปุ่ม "+ เพิ่มรูป" · multi-file upload · จำกัด 3MB/รูป
- [ ] แสดงผู้เช่าปัจจุบัน (active contract): ชื่อ, เลขประจำตัว, ที่อยู่, โทร, เลขที่สัญญา
- [ ] แสดง warning ถ้ามีสัญญาซ้อน (overlap) — list คู่ที่ทับ
- [ ] แสดงสัญญาทั้งหมด — click expand เห็น: rate, start, end, purpose + ปุ่ม แก้ไข/ลบ
- [ ] ปุ่ม "เพิ่มสัญญาใหม่" · "แก้ไข" (เปิด edit form) · "ลบ" (ทรัพย์สิน)
- [ ] ปุ่ม ✏️ แก้ไข เปิด `openEditPropertyDialog` แยกอีก dialog (full enum form) — ไม่ใช่ `editProperty` ซึ่งใช้ build form แบบ Add — ❓ ตรวจพบ 2 ฟอร์ม edit ซ้อนกัน ต้อง unify

### A4. Add/Edit form (จาก `14-contracts.js` `buildPropFormHTML` + `13-properties.js` `openEditPropertyDialog`)

- [ ] Field: ชื่อทรัพย์สิน (required, live duplicate detection, suggest dropdown)
- [ ] Field: ประเภท — Add form = free text + datalist · Edit dialog = enum 6 ค่า (`PROP_TYPES`)
- [ ] Field: จังหวัด (location) — required, datalist จาก existing
- [ ] Address sub-fields: เลขที่/หมู่/ซอย/ถนน, ตำบล/แขวง (datalist), อำเภอ/เขต (datalist), จังหวัด (datalist 77 จังหวัด), รหัสไปรษณีย์ 5 หลัก (pattern validation)
- [ ] Field: เนื้อที่ (free text)
- [ ] Field: เลขโฉนด
- [ ] Field: เจ้าของ (owner) — เฉพาะใน edit dialog
- [ ] Field: multiTenant checkbox — เฉพาะใน edit dialog
- [ ] Field: status (occupied/vacant/active) — เฉพาะใน edit dialog
- [ ] Auto-enrich name: ถ้าชื่อเป็นประเภทสั้นๆ (ที่ดิน, บ้าน, ห้องแถว ฯลฯ) จะ append ต./อ. จาก address อัตโนมัติ (`autoEnrichPropName`)
- [ ] Duplicate confirmation: ถ้าชื่อชนกับที่มี → confirm dialog
- [ ] Validation errors แสดงรวมใน `propFormErrors` box (ไม่ inline)
- [ ] Image upload — Add form ❓ ไม่มี · ทำใน detail page เท่านั้น

### A5. Permissions (จาก `03-auth.js`)

- [ ] role `admin` — view, print, create, edit, delete, settings, staff, import, export, void, view_reports (ทุก report)
- [ ] role `manager` — view, print, create, edit, export, void, view_reports (ทุก report) · ไม่มี delete/settings/staff/import
- [ ] role `staff` — view, print, view_reports (เฉพาะ action, occupancy, expiry, arrears) · ไม่มี create/edit/delete
- [ ] role `pending` — ไม่มีสิทธิ์อะไร (ใช้ตอนตรวจ allowlist หลัง Google login)
- [ ] Login = Google Workspace OAuth ผ่าน Supabase · `_resolveStaffRole` ตรวจ allowlist จาก `real_estate.staff` ตาราง
- [ ] Domain allowlist (จาก `07-domain-allowlist.sql`) — ❓ ตรวจพบ domain whitelist เพิ่มเติม
- [ ] เฉพาะ admin ลบทรัพย์สินได้ (`deleteProperty` checks `hasPermission('delete')`)
- [ ] ❓ ตรวจไม่พบ permission check ที่ Add/Edit property — ต้องถาม Tem ว่า staff ควร add/edit ได้ไหม

### A6. Activity log events (จาก `07-activity-log.js` + grep)

- [ ] `add_property` — เพิ่มทรัพย์สิน (`14-contracts.js:723`) · log ชื่อ
- [ ] `edit_property` — แก้ไขทรัพย์สิน (`14-contracts.js:786`) · log ชื่อ
- [ ] `property_edit` — แก้ไขจาก edit dialog (`13-properties.js:1221`) · log ชื่อ — ❓ ตรวจพบ 2 event names สำหรับ edit (ควร unify เป็น 1)
- [ ] `delete_property` — ลบทรัพย์สิน (`14-contracts.js:816`) · log ชื่อ + entity_type/id + before snapshot
- [ ] Activity log มี audit log viewer (`viewActivityLog` ใน `07-activity-log.js:62`) แสดง filter entity_type, user, limit
- [ ] log เก็บใน DB.activityLog (max 500) + persist ไป Supabase `real_estate.activity_log`

### A7. Cross-feature linkage

- [ ] เชื่อมกับ contracts ผ่าน `c.pid` (FK) — soft link ใน JSONB
- [ ] ลบ property — block ถ้ามี active contract · warn ถ้ามี expired/cancelled · warn เพิ่มถ้ามี orphan invoices
- [ ] เชื่อมกับ invoices ผ่าน `inv.cid` → `contract.pid` (indirect, 2-hop)
- [ ] เชื่อมกับ landlords (จาก aggregation) — ใช้ `c.landlord` ของ contracts ที่ pid ตรง
- [ ] Cancel contract — ไม่กระทบ property record ตรงๆ · แค่ทำให้ property กลายเป็น "ว่าง" จาก `propInfo`
- [ ] Image storage — ปัจจุบันเก็บเป็น base64 dataURL ใน JSONB · v2 ต้องตัดสินใจย้าย Supabase Storage หรือไม่

---

## Section B · Contracts (สัญญาเช่า)

> Supabase: `real_estate.contracts` (id text PK, property_id text, status text default 'active', data jsonb, timestamps)

### B1. Data fields (จาก `15-contract-form.js` `openAddContractDialog` line 202 + `13-properties.js` viewContract line 1015)

ทุก contract object มี fields ครบดังนี้ (ใน JSONB `data`):

**Identification:**
- [ ] `id` — `number` · PK auto-increment จาก `DB.nextCId` เริ่ม 200
- [ ] `no` — `text` · เลขสัญญา · format `สช.XXX/YYYY (BE)` · auto-gen ปุ่ม "สร้างเลข" (`genNextContractNo` ใน 15-contract-form.js:1379) · required · unique validation (block ถ้าซ้ำ)
- [ ] `date` — `text` BE date · วันทำสัญญา · default = today BE
- [ ] `pid` — `number` · FK → properties · required · ล็อกไม่ได้แก้ตอน edit/renew/copy
- [ ] `property` — `text` · denormalized property name (snapshot ตอนสร้าง)

**Tenant (inline · v2 จะแยกเป็น `tenants` table):**
- [ ] `tenant` — `text` · ชื่อผู้เช่าเต็ม (prefix + first + last assembled) · required
- [ ] `tenantPrefix` — `text` · คำนำหน้า — enum: นาย/นาง/นางสาว/บริษัท/ห้างหุ้นส่วนจำกัด/น.ส./ม.ร.ว./ม.ล./ศ./ผศ./รศ./ดร./พล.ท./พล.ต./พ.อ./พ.ท./ร.ต./ว่าที่ ร.ต. (เก็บ in-form เฉยๆ ไม่ persist separately)
- [ ] `phone` — `text` · เบอร์โทรศัพท์
- [ ] `taxId` — `text` · เลขบัตรประชาชน 13 หลัก หรือ เลขผู้เสียภาษี · format `X-XXXX-XXXXX-XX-X` · mod-11 checksum validation (`isValidThaiId` 15-contract-form.js:876)
- [ ] `branch` — `text` · สาขา · default `00000` = สำนักงานใหญ่ · ใช้กับใบกำกับภาษี
- [ ] `tenantAddr` — `text` · ที่อยู่ผู้เช่า · ประกอบจาก sub-fields เหมือน property address · required
- [ ] `tenantLogo` — `text` base64 dataURL · โลโก้/รูปผู้เช่า (compress 200px, 0.7 quality) · ใช้แสดงในใบแจ้งหนี้
- [ ] `tenantSig` — `text` base64 dataURL · ลายเซ็นผู้เช่า

**Landlord (inline · จะ port เป็นแบบ inline ก่อนใน v2 · แยก table ทีหลัง):**
- [ ] `landlord` — `text` · ชื่อบริษัท/ผู้ให้เช่า · datalist + custom · auto จาก `cfSelectHeader` ถ้าเลือก invoiceHeader
- [ ] `landlordAddr` — `text` · ที่อยู่ผู้ให้เช่า · auto-fill จาก previous contracts โดย landlord name (`vcLandlordChange`) หรือจาก `invoiceHeaders` table
- [ ] `landlordSignerName` — `text` · ชื่อกรรมการที่เซ็น (ฝั่งผู้ให้เช่า) · เลือกจาก `DB.sysConfig.signers`
- [ ] `landlordSignerTitle` — `text` · ตำแหน่งกรรมการ (เช่น "กรรมการผู้จัดการ")
- [ ] `landlordSig` — `text` base64 · ลายเซ็นผู้ให้เช่า
- [ ] `accountName` — `text` · ชื่อบัญชี (ฝั่งผู้ให้เช่า)
- [ ] `bank` — `text` · ธนาคาร (fallback ไป invoiceHeader ถ้าว่าง)
- [ ] `acctNo` — `text` · เลขบัญชี
- [ ] `invHeaderId` — `number` · FK ไปยัง `DB.invoiceHeaders` (ใน Supabase `real_estate.invoice_headers`) — เลือกแล้ว auto-fill landlord + bank + address — alternative ของ inline

**Witnesses (พยาน):**
- [ ] `witness1Name` — `text` · พยานคนที่ 1 · default = `DB.sysConfig.defaultWitness1` ถ้าไม่ใช่ผู้เซ็น
- [ ] `witness1Title` — `text` · ตำแหน่งพยาน 1
- [ ] `witness1Sig` — `text` base64 · ลายเซ็นพยาน 1
- [ ] `witness2Name` — `text` · พยานคนที่ 2
- [ ] `witness2Title` — `text` · ตำแหน่งพยาน 2
- [ ] `witness2Sig` — `text` base64 · ลายเซ็นพยาน 2
- [ ] Validation: signer ≠ witness1 ≠ witness2 (`validateSignerWitness` line 154)
- [ ] ❓ ตรวจไม่พบ `tenantSignerName/Title` ใน form — แต่ใช้ใน print (`sigBoxParty` ใน 17-contract-print.js:148) — อาจเป็น dead code

**Lease terms:**
- [ ] `start` — `text` BE date · required · valid BE format
- [ ] `end` — `text` BE date · required · ต้องหลัง start
- [ ] `dur` — `text` · ระยะเวลา เช่น "3 ปี 6 เดือน" · ประกอบจาก `durYears` + `durMonths` · มี 2-way binding กับ end date (`cfCalcEndFromDur` / `cfCalcDurFromEnd`)
- [ ] `rate` — `text` · อัตราค่าเช่า เช่น "เดือนละ 50,000 บาท" · prefix enum: วันละ/เดือนละ/ไตรมาสละ/ครึ่งปีละ/ปีละ/เหมาจ่าย
- [ ] `deposit` — `text` · เงินประกัน (เก็บเป็น digits-only · format ตอน display ด้วย `fmtDeposit` แปลงเป็น "50,000 บาท (ห้าหมื่นบาทถ้วน)")
- [ ] `hasDeposit` — `boolean` · ❓ ตรวจพบใน print แต่ไม่มีใน form — มีกรณีที่ deposit = 0 หรือไม่มี
- [ ] `monthlyBaht` — `number` · pre-computed monthly revenue (สำหรับ rates ที่ไม่ใช่รายเดือน)
- [ ] `payment` — `text` · วิธีชำระ · ประกอบจาก: `paySchedule` (ล่วงหน้า/ทุกเดือน/รายไตรมาส/รายปี/ตามสัญญา) + `payChannel` (โอนเงิน/เงินสด/เช็ค/อื่นๆ) + `payNote` (free text)
- [ ] `dueDay` — `number` 1-31 · วันครบกำหนดใบแจ้งหนี้ของทุกเดือน · default 5 · เดือนสั้นใช้วันสุดท้าย
- [ ] `purpose` — `text` · วัตถุประสงค์การเช่า · required · datalist + custom · ใช้คาดเดา category ใน `cat()` helper (ที่พักอาศัย/เสาสัญญาณ/ป้ายโฆษณา/สำนักงาน/สาธารณูปโภค/เกษตรกรรม/ที่จอดรถ/โกดัง-โรงงาน)
- [ ] `area` — `text` · พื้นที่ (auto-pull จาก property)
- [ ] `spot` — `text` · จุด/ตำแหน่งบนทรัพย์ (เช่น "ล็อก A", "ชั้น 2") · ใช้ตอนทรัพย์มีหลายจุด · datalist จาก spots ของ property นั้น
- [ ] `rateAdj` — `text` · ข้อความปรับค่าเช่า · auto-generated จาก `rateAdjType` + `rateAdjPercent` แล้วเป็น Thai sentence
- [ ] `rateAdjType` — `text` enum: `none` (ไม่ปรับ) / `percent` (ปรับ % ตอนต่อสัญญา) / `custom` (พิมพ์เอง)
- [ ] `rateAdjPercent` — `number` 1-100 · % ที่ปรับ · ใช้ตอน `rateAdjType=percent` · auto-calc rate ใหม่ตอน renew (`applyRenewRateAdj` line 1123)
- [ ] `madeAt` — `text` · ทำที่ (สถานที่ทำสัญญา) · auto จาก landlord address (`cfMadeAt` readonly)

**Status flags:**
- [ ] `signed` — `boolean` · เซ็นแล้วหรือยัง · toggle ได้ใน list (`toggleSigned`)
- [ ] `cancelled` — `boolean` · ถูกยกเลิกหรือไม่
- [ ] `cancelledDate` — `text` BE date · วันที่ออกจริง (วันยกเลิก)
- [ ] `cancelledReason` — `text` · เหตุผลยกเลิก · enum dropdown + custom: ผู้เช่าขอยกเลิกก่อนกำหนด / หมดสัญญาแล้วไม่ต่อ / ผิดสัญญา-ค้างค่าเช่า / ผู้ให้เช่าบอกเลิก / เปลี่ยนผู้เช่าใหม่ / อื่นๆ
- [ ] `originalEnd` — `text` BE date · end เดิมก่อน cancel · เก็บไว้ restore
- [ ] `closed` — `boolean` · สิ้นสุดสมบูรณ์ (ตรวจรับคืน + คืนเงินประกันครบ)
- [ ] `noticeDate` — `text` BE date · วันที่ผู้เช่าแจ้งย้ายออก (ก่อนยกเลิกจริง)
- [ ] `plannedMoveOut` — `text` BE date · วันที่จะออกจริง
- [ ] `noticeNote` — `text` · หมายเหตุการแจ้งย้ายออก (เช่น "แจ้งผ่าน Line")
- [ ] `depositReceivedAt` — `text` BE date · วันที่รับเงินประกัน (legacy · ใช้ deposit invoice แทนได้)

**Relationships:**
- [ ] `renewedFrom` — `number` · ถ้าเป็นสัญญาต่อ ชี้ไปสัญญาเดิม
- [ ] `copiedFrom` — `number` · ถ้าเป็นสัญญาคัดลอก
- [ ] `clauseOverrides` — `object` · keys "0", "1", "2.0" (ข้อ.ข้อย่อย) → text ที่ใช้แทนข้อมาตรฐาน · แสดงสีแดงในจอ ดำในพิมพ์

**Audit:**
- [ ] `audit` — `array<{ts, beDateStr, action, detail, user, snapshot}>` · per-contract audit trail (cancel/restore/edit) · max 50 entries

### B2. List page actions (จาก `14-contracts.js` `renderContracts` line 836)

- [ ] Group by tenant (ผู้เช่า 1 คนรวมหลายสัญญา) — ดู `tenantMap`
- [ ] KPI cards: ผู้เช่า · สัญญาทั้งหมด · สัญญามีผล · ใกล้หมดอายุ · บ./เดือน
- [ ] Search: ผู้เช่า / เลขสัญญา · debounced 300ms
- [ ] Filter status: ทุกสถานะ · มีผล · ใกล้หมด · หมดอายุ · รอเริ่ม · ยกเลิก
- [ ] Filter เซ็น: ทุกการเซ็น · เซ็นแล้ว · ยังไม่เซ็น
- [ ] Sort: ผู้เช่า · ทรัพย์สิน · สถานะ · ระยะสัญญา · ค่าเช่า (มาก→น้อย default)
- [ ] Pagination: 50 tenants/page · "แสดงเพิ่ม 50" button
- [ ] Tab bar: ทรัพย์สิน · สัญญาเช่า · ใกล้หมดอายุ (badge count)
- [ ] Click tenant → expand · เห็นสัญญาทุกฉบับของ tenant นั้น
- [ ] Click contract row → `viewContract` (modal)
- [ ] Right-click contract row → context menu (`showCtxMenu` ใน `20-context-menu-cf.js`) — actions: ดูรายละเอียด · พิมพ์สัญญา · toggle เซ็นแล้ว/ยังไม่เซ็น · แก้ไข · ต่อสัญญา · คัดลอก
- [ ] Batch select: checkbox per contract + per tenant (เลือกทั้งหมดของ tenant นั้น) + Shift+Click range select + select-all checkbox
- [ ] Batch actions bar: พิมพ์ที่เลือก · เซ็นแล้ว · ยังไม่เซ็น · ยกเลิก (clear)
- [ ] Batch print: `batchPrintContracts` รวมหลายสัญญาในหน้าเดียว (page-break-after each)
- [ ] Progress bar ในแต่ละ row · % ผ่านไป + วันเหลือ
- [ ] ปุ่ม "+ เพิ่มสัญญา" · "พิมพ์" (batch)
- [ ] Empty state: "ยังไม่มีสัญญา" + ปุ่ม
- [ ] "ใกล้หมดอายุ" tab (`renewals` page) — list สัญญาที่ status=expiring (ดู `16-renewals.js`)

### B3. View page actions (`viewContract` ใน `13-properties.js:769`)

- [ ] เปิดเป็น modal
- [ ] Header: status badge (มีผล/ใกล้หมด/หมดอายุ/รอเริ่ม/ยกเลิก/สิ้นสุด) + เลขสัญญา + วันเหลือ
- [ ] แสดง: ผู้เช่า, ผู้ให้เช่า, ค่าเช่า/เดือน, ความถี่ (รายเดือน/ไตรมาส/6เดือน/ปี/เหมา)
- [ ] Progress bar เต็มความกว้าง + % ผ่านไป + วันเหลือ
- [ ] Banner ถ้า cancelled: วันที่ยกเลิก + เหตุผล
- [ ] Workflow strip (`_vcWorkflowStrip` line 692):
  - active + ไม่มี notice → แสดงสถานะเงินประกัน + ปุ่ม "📢 แจ้งย้ายออก"
  - มี notice → แสดงข้อมูล notice + ปุ่มแก้ + ปุ่ม "สรุปย้ายออก"
  - expired/cancelled/closed → 2 ขั้น: ตรวจรับคืนทรัพย์ → คืนเงินประกัน
- [ ] Action buttons: พิมพ์สัญญา · ต่อสัญญา · คัดลอก · ✎ แก้ข้อ (clause override) · ใบรับเงินประกัน (ถ้ามี) · ยกเลิก/คืนสถานะ
- [ ] KPI strip (`buildContractKpi`): ค้างชำระ · ชำระตรงเวลา · เฉลี่ยล่าช้า · ใบทั้งหมด
- [ ] Payment timeline (`buildContractTimeline`): filter chips (ทั้งหมด/ค้างชำระ/ชำระแล้ว) + sorted by month desc + pagination (default 12, +12)
- [ ] Timeline row: slip thumbnail (ถ้ามี) · เดือน · status badge · เลขใบ · subline (ชำระ XX/เลยกำหนด YY วัน) · ยอดเงิน · quick action (+ บันทึกชำระ / ดูรายละเอียด)
- [ ] Detail section (collapsible · default open): เงื่อนไขการเช่า (start/rate/end/deposit/dur/payment) · ทรัพย์สิน · ผู้เกี่ยวข้อง · บัญชีรับเงิน · ทำที่
- [ ] ปุ่ม "แก้ไข" → `openEditContract` (full form)
- [ ] Audit history (collapsible): max 20 entries · "ประวัติการแก้ไข"
- [ ] ❓ ตรวจพบ inline edit functions (`toggleFieldEdit`, `saveFieldEdit` ใน 13-properties.js:1044) — มี per-field inline edit ใน detail view แต่ไม่ obvious จาก UI · ต้องถามว่าใช้จริงไหม

### B4. Add/Edit form (จาก `15-contract-form.js`)

ฟังก์ชันหลัก: `contractFormHTML(mode, c, pid)` — mode = add/edit/renew/copy. Behaviors แตกต่างกันต่อ mode:
- add (pid passed): pre-fill จากสัญญาก่อนหน้าใน property (พิมพ์ใหม่แต่ no/date/start/end/dur เป็นค่าว่าง)
- edit: load existing values, lock property
- renew: copy fields, blank no/date, start=today, blank end, auto-calc rate ถ้า rateAdjType=percent
- copy: copy all, blank no/date

**Section: ข้อมูลพื้นฐาน**
- [ ] เลือกทรัพย์สิน — dropdown · ล็อกตอน edit/renew/copy
- [ ] เลขที่สัญญา + ปุ่ม "สร้างเลข" (auto-gen)
- [ ] วันทำสัญญา (Thai date picker)
- [ ] ทำที่ (readonly · auto จาก landlord address)

**Section: ข้อมูลผู้เช่า**
- [ ] ชื่อ — split เป็น คำนำหน้า + ชื่อ + นามสกุล (assemble เป็น hidden `tenant` field) · datalist จาก existing tenants
- [ ] เลขบัตร/ผู้เสียภาษี — format อัตโนมัติ + checksum validation (red border ถ้าผิด)
- [ ] สาขา — radio "สำนักงานใหญ่" / "สาขา" + เลขสาขา 5 หลัก
- [ ] โทรศัพท์
- [ ] ที่อยู่ผู้เช่า (sub-fields)
- [ ] โลโก้ผู้เช่า — file upload + auto-compress 200px

**Section: รายละเอียดสัญญา**
- [ ] วัตถุประสงค์ — dropdown + custom · required
- [ ] อัตราค่าเช่า — radio prefix (วัน/เดือน/ไตรมาส/6เดือน/ปี/เหมา) + จำนวนเงิน + "บาท" suffix
- [ ] ระยะเวลา — ปี + เดือน inputs · 2-way bind กับ start/end date
- [ ] วันเริ่มต้น (date picker) + วันสิ้นสุด (date picker)
- [ ] เงินประกัน — format with commas onblur
- [ ] พื้นที่ — readonly · auto จาก property
- [ ] จุด/ตำแหน่งบนทรัพย์ — datalist จาก spots ของ property

**Section: การชำระเงิน / ผู้ให้เช่า**
- [ ] วิธีชำระ — กำหนดชำระ select + ช่องทาง select + free-text note (assemble เป็น hidden `payment`)
- [ ] วันครบกำหนดใบแจ้งหนี้ (1-31) · default 5
- [ ] ผู้ให้เช่า — dropdown จาก `DB.invoiceHeaders` (จาก settings) · auto-fill landlord + bank + address + madeAt · มี preview card สีเขียว
- [ ] Manual landlord section (เปิดเมื่อเลือก "+ กรอกเอง"): ชื่อผู้ให้เช่า dropdown + custom · ที่อยู่ผู้ให้เช่า (auto จาก landlord ก่อนหน้า · display only)
- [ ] การปรับค่าเช่า — 3 radios: ไม่ปรับ / ปรับเมื่อต่อสัญญา X% / พิมพ์เอง · auto-generate Thai sentence ลง hidden field · preview ข้อความ

**Section: ผู้เซ็น & พยาน**
- [ ] กรรมการผู้เซ็น (ฝั่งผู้ให้เช่า) — dropdown จาก `DB.sysConfig.signers` + auto-fill title
- [ ] พยาน 1 — datalist (signers + staff) + ตำแหน่ง · default จาก `DB.sysConfig.defaultWitness1` (เช่น "อยุทธ์")
- [ ] พยาน 2 — datalist + ตำแหน่ง
- [ ] ลายเซ็นผู้ให้เช่า — file upload · base64 preview
- [ ] ลายเซ็นผู้เช่า
- [ ] ลายเซ็นพยาน 1
- [ ] ลายเซ็นพยาน 2

**Validation (`validateContractForm`):**
- [ ] required: pid, tenantFirst, purpose, rateAmt > 0, start, end, no (และห้าม "-"), end > start
- [ ] rateAdjPercent 1-100 ถ้าเลือก percent
- [ ] เลขสัญญาห้ามซ้ำกับ contracts อื่น
- [ ] deposit (ถ้ากรอก) ต้องเป็นตัวเลข
- [ ] BE date format dd/mm/yyyy
- [ ] errors แสดงทั้ง inline + summary box ที่บน + scroll-into-view + shake animation

**Auto-behaviors:**
- [ ] Select tenant → auto-fill phone, taxId, branch, tenantAddr, tenantLogo จาก contract ก่อนหน้า (`cfAutoFillTenant`)
- [ ] Select landlord → auto-fill landlordAddr + madeAt + select matching bank
- [ ] Select property → auto-fill area
- [ ] Confirm overlap (ถ้ามีสัญญาทับช่วงเวลาบน property เดียวกัน + ไม่ใช่ multi-tenant) — `confirmOverlapAndSave`

**On save:**
- [ ] สร้าง deposit invoice อัตโนมัติ (`createDepositInvoice` ใน 04-storage.js:581)
- [ ] เพิ่ม deposit ledger entry ถ้า deposit > 0 (`addDepositLedger`)
- [ ] log activity (add_contract / edit_contract / renew_contract / copy_contract)

### B5. Cancel contract (`openCancelDialog` ใน `14-contracts.js:134`)

- [ ] Confirm modal · warning box "ยืนยันยกเลิกสัญญา"
- [ ] แสดง summary: start, end, ค่าเช่า/งวด, วันเหลือ + ค้างชำระกี่งวด
- [ ] Pre-fill cancel date = `plannedMoveOut` หรือ today BE
- [ ] Field: วันที่ออกจริง (date picker, required)
- [ ] Field: เหตุผลยกเลิก — dropdown + custom textarea
- [ ] ถ้ามีใบแจ้งหนี้ค้าง → confirm dialog (ค้างกี่ใบ รวมกี่บาท · ยกเลิกได้แต่ใบยังอยู่ในระบบ)
- [ ] On confirm: set `cancelled=true`, `cancelledDate`, `cancelledReason`, save `originalEnd=end`, set `end=cancelDate`
- [ ] log: `cancel_contract` + per-contract audit "cancel"
- [ ] Restore (`restoreContract`): เช็ค overlap ก่อน restore (กันสัญญาใหม่มาเช่าทับช่วงเก่า) · restore end จาก originalEnd · audit "restore"

### B6. Print contract (`contractHTML` ใน `17-contract-print.js:4`)

**Layout:**
- [ ] A4 portrait · margin 12-14mm · font Sarabun
- [ ] **หน้า 1 (สัญญาหลัก)** — Header (สัญญาเช่า / Tenancy Agreement + เลขที่สัญญา badge) → Date strip (ทำสัญญา ณ X เมื่อวันที่ Y · Thai date) → Parties table 2-col (ผู้ให้เช่า · ผู้เช่า ครบทุก field) → Body (intro + 12 clauses + sub-clauses + closing · clause overrides แสดงสีแดงในจอ ดำในพิมพ์ + note "(แก้ไข)" ในจอ) → Signature section (ผู้ให้เช่า · ผู้เช่า ด้วย `sigBoxParty` ซึ่งรู้จัก company vs individual + พยาน 2 คน)
- [ ] **หน้า 2 (เอกสารแนบท้าย / Schedule)** — Banner ใหม่ → Parties section (compare 2-col) → รายละเอียดทรัพย์สิน (key|value table: ทรัพย์สิน, วัตถุประสงค์, พื้นที่, เอกสารสิทธิ์) → ระยะเวลาและค่าเช่า (วันเริ่ม BE month name, วันสิ้นสุด, ระยะเวลา, อัตราค่าเช่า, วิธีชำระ, การปรับค่าเช่า, เงินประกัน with Thai-baht text) → บัญชีรับโอน (ธนาคาร, ชื่อบัญชี, เลขที่, PromptPay) → หมายเหตุ → Signature
- [ ] CSS optimizations: clauses/sub-clauses ห้าม page-break-inside · signature h=72px เฉพาะคู่สัญญา · pages page-break-after: always
- [ ] Print mode (@media print): กดปุ่ม "🖨️ พิมพ์/บันทึก PDF" → window.print() → browser default save as PDF
- [ ] Preview overlay: full screen iframe · header ด้วยปุ่ม "พิมพ์" + "ปิด" — `openPrintOverlay`
- [ ] Filename default = "สัญญาเช่า {no} {tenant short}" หรือ "สัญญาเช่า N ฉบับ"
- [ ] Variable substitution `{{tenant}}`, `{{landlord}}`, `{{property}}`, `{{start}}`, `{{end}}`, `{{rent}}`, `{{deposit}}`, `{{contractNo}}` ใน intro/clauses/closing (`renderTemplateText`)
- [ ] Master template เก็บใน `DB.templates[]` + active = `DB.activeTemplate` · default 12 clauses + sub-clauses ใน `02-state.js:16-38`
- [ ] Clause editor (`openClauseOverrideEditor` ใน `14-contracts.js:3`) — per-contract override · textarea ทุกข้อ + ทุกข้อย่อย · empty = ใช้แม่แบบ
- [ ] Batch print (`batchPrintContracts`) — รวมหลายสัญญา · แต่ละสัญญาเริ่มหน้าใหม่

### B7. Permissions

- [ ] เหมือน Section A5 (admin/manager/staff hierarchy)
- [ ] เฉพาะ admin ลบสัญญาได้ (`deleteContract` check `hasPermission('delete')`)
- [ ] Delete: ต้อง prompt เหตุผล + confirm + cascade option (ลบ invoices ด้วยหรือไม่)
- [ ] staff = view + print only · ไม่ create/edit/cancel
- [ ] manager = ส่วนใหญ่ทำได้ ยกเว้น delete

### B8. Activity log events (จาก grep + `07-activity-log.js`)

- [ ] `add_contract` — สร้างสัญญาใหม่
- [ ] `edit_contract` — แก้ไขสัญญา + per-contract audit
- [ ] `renew_contract` — ต่อสัญญา (สร้างสัญญาใหม่ link ผ่าน renewedFrom)
- [ ] `copy_contract` — คัดลอกสัญญา
- [ ] `cancel_contract` — ยกเลิก · log reason + per-contract audit (snapshot originalEnd + cancelDate)
- [ ] `sign_contract` / `unsign_contract` — toggle เซ็น
- [ ] `delete_contract` — ลบ · log reason + full contract snapshot
- [ ] `delete_orphan_invoices` — ลบใบที่ผูกกับสัญญาที่ถูกลบ
- [ ] `edit_clause_override` — แก้ข้อสัญญาเฉพาะ + count ข้อที่แก้
- [ ] `notice_moveout` / `notice_edit` — บันทึก/แก้แจ้งย้ายออก
- [ ] `restore` — คืนสถานะ (per-contract audit only · ไม่มี global activity log)
- [ ] Per-contract audit (`c.audit` array · max 50) — เก็บ ts, action, detail, user, snapshot
- [ ] Orphan audit `DB.contractAuditOrphan` — สำหรับ contract ที่ถูกลบ

### B9. Notifications (จาก `09-notifications.js`)

Notification engine คำนวณ real-time จาก DB · ไม่มี persistent notification table:

- [ ] สัญญาหมดอายุแล้ว (0 ถึง -30 วัน) — `danger` priority 1
- [ ] สัญญาจะหมดภายใน 30 วัน — `danger` priority 2
- [ ] สัญญาจะหมดภายใน 90 วัน — `warning` priority 3 · กรอง expiringDays config (default 90)
- [ ] ใบแจ้งหนี้ค้างชำระ (overdue) — `danger` ถ้า >30 วัน, `warning` ถ้า <30
- [ ] ใบแจ้งหนี้ชำระบางส่วน (partial) — `warning` (skip ถ้าเลย due แล้ว rule overdue จัดการ)
- [ ] Follow-up date ถึงกำหนด (0-3 วัน) — `warning/info`
- [ ] ใบแจ้งหนี้ใกล้ครบกำหนด (≤7 วัน) — `info`
- [ ] ทรัพย์สินว่าง (ไม่มี active contract) — `info`
- [ ] ยังไม่สร้างใบแจ้งหนี้เดือนนี้ (สำหรับ active monthly contracts) — `info`
- [ ] Notification panel — bell icon + badge count + filter tabs (ทั้งหมด/สัญญา/ใบแจ้งหนี้/ทรัพย์สิน) · panel auto-close on outside click
- [ ] Click notification → execute action (open contract / invoice modal / property detail)
- [ ] Animate bell ถ้ามี danger
- [ ] ❓ ตรวจไม่พบ notification เกี่ยว: deposit ยังไม่รับ / signature ยังไม่ครบ / tax info incomplete — มี indirect ผ่าน banner ในหน้า property/contract แต่ไม่อยู่ใน global notifications

### B10. Cross-feature linkage

- [ ] FK → properties ผ่าน `c.pid` · denormalized `c.property` (name snapshot)
- [ ] FK ← invoices ผ่าน `inv.cid` · 1 contract มีหลาย invoices
- [ ] Auto-create deposit invoice ตอนสร้างสัญญา (`createDepositInvoice` ใน 04-storage.js)
- [ ] Auto-create deposit ledger entry ('in') ถ้า deposit > 0 ตอนสร้าง/renew/copy
- [ ] Deposit return — manual flow ผ่าน `openDepositReturn` (28-deposit-return.js)
- [ ] Move-out inspection — แยกหน้า (`openInspectionForm` ใน 29-moveout-inspection.js) — เก็บใน `real_estate.inspections`
- [ ] **Inline landlord data** (v2 จะ port มาก่อน · แยก table ทีหลัง):
  - `c.landlord` — ชื่อบริษัท/บุคคล
  - `c.landlordAddr` — ที่อยู่
  - `c.accountName` — ชื่อบัญชี (ฝั่งผู้ให้เช่า)
  - `c.landlordSignerName` — กรรมการที่เซ็น
  - `c.landlordSignerTitle` — ตำแหน่งกรรมการ
  - alternative: `c.invHeaderId` → `DB.invoiceHeaders` (มีโครงสร้าง landlord ใน settings)
- [ ] **Inline tenant data** (v2 จะแยก `tenants` table):
  - `c.tenant` — ชื่อเต็ม
  - `c.phone` — โทร
  - `c.taxId` — เลขบัตร/ผู้เสียภาษี
  - `c.branch` — สาขา (สำหรับใบกำกับ)
  - `c.tenantAddr` — ที่อยู่
  - `c.tenantLogo` — โลโก้ (base64)
  - `c.tenantSig` — ลายเซ็น (base64)
- [ ] Editing landlord/tenant address ผ่าน `editLandlordAddr` / `editTenantAddr` (`14-contracts.js:75`) — อัพเดต **ทุก contract** ที่ landlord/tenant name ตรงกัน (cascading update inline data) — ❓ ใน v2 ถ้าแยก tenants table แล้ว FK ก็ไม่ต้อง cascade แบบนี้
- [ ] Contract clause master เก็บใน `DB.templates[]` (ใน `real_estate.templates` table) · 1 active template + clause editor มี Quill (rich text)

---

## Section C · Open questions for Tem

Items ที่ดูจาก code แล้วไม่ชัด หรือมี trade-off · ขอ Tem ตัดสิน:

- ❓ **Property type — enum vs free-text?** v1 มี 2 ฟอร์มขัดกัน: Add ใช้ free text + datalist, Edit dialog ใช้ enum 6 ค่า (`shophouse/land_with_house/vacant_land/rooftop_tower/apartment/other`). v2 จะใช้แบบไหน? (แนะนำ: enum + "อื่นๆ" + custom string)

- ❓ **Property image storage — base64 ใน JSONB ต่อ หรือย้าย Supabase Storage?** v1 เก็บเป็น base64 dataURL ใน `p.images[]` array · จำกัด 3MB/รูป. v2 ถ้าย้าย Storage ได้ data size เล็กลง + load เร็วขึ้น แต่ต้อง upload flow ใหม่

- ❓ **Permission ของ "Add/Edit Property"** — code v1 ไม่มี `hasPermission('create')` check ที่ Add property · ใช้ default permission · staff สร้าง property ได้ไหม? (manager/admin เท่านั้น?)

- ❓ **Inline edit ใน view contract** — มี `toggleFieldEdit/saveFieldEdit` ใน 13-properties.js:1044 แต่ไม่ obvious จาก UI ปัจจุบัน. ยัง active อยู่ไหม หรือ legacy?

- ❓ **2 forms สำหรับ edit property** — `editProperty` (build form แบบ Add ใหม่) vs `openEditPropertyDialog` (full dialog · มี multiTenant/status/owner) — v2 ทำเป็น 1 form เดียวให้ครบ?

- ❓ **`tenantSignerName/Title`** — ใช้ใน print (`sigBoxParty` 17-contract-print.js:148 สำหรับนิติบุคคล) แต่ไม่มีใน form. Tem ใช้จริงไหม สำหรับเคสที่ผู้เช่าเป็นบริษัท ต้องมีกรรมการเซ็น?

- ❓ **`hasDeposit` flag** — ใช้ใน print (`17-contract-print.js:298`) แต่ไม่มีใน form. ตอนนี้ดูเหมือนใช้ `c.deposit === 0 || ไม่มี deposit` แทน. v2 ทำ explicit field หรือ infer จาก amount?

- ❓ **Witness defaults** — `DB.sysConfig.defaultWitness1` (เช่น "อยุทธ์") — มี logic match ชื่อย่อ กับ full name จาก signers/staff list. v2 ต้อง port การ matching นี้ไหม?

- ❓ **Contract template editor (rich text Quill)** — v1 มี WYSIWYG editor + variable insert + drag-drop reorder clauses ใน `20-context-menu-cf.js` · ขนาดใหญ่ ซับซ้อน. v2 รอบนี้ port ไหม หรือ defer?

- ❓ **Activity log events `edit_property` vs `property_edit`** — 2 ชื่อ event สำหรับ action เดียวกัน. v2 unify เป็นชื่อเดียว (รูป `entity_action` เช่น `property_edit`)?

- ❓ **Renewals page (`16-renewals.js`)** — list สัญญาที่ status=expiring · เป็น tab แยก. v2 ทำเป็น filter หรือ dedicated page?

- ❓ **`closeContract` action** — เห็น flag `c.closed` ใน workflow strip · "สิ้นสุดสมบูรณ์" หลังตรวจรับคืน + คืนเงินประกัน. ไม่มี dedicated UI action ที่ set closed=true · เป็น state ที่ derive ไหม? ต้อง trace อีกที

- ❓ **Multi-tenant property + spot** — v1 รองรับ 1 property แบ่งหลายผู้เช่า (ดาดฟ้า เสาส่งสัญญาณ) ผ่าน `multiTenant` flag + `c.spot` field. v2 model นี้ต่อ หรือเลือก data shape ดีกว่า (เช่น `property_units` sub-table)?

- ❓ **`real_estate.deposit_ledger`** — มี table แต่ไม่ได้รวมในการ audit รอบนี้. v2 รวมหรือเก็บแยก?

- ❓ **Inline cascade edit** — เปลี่ยน landlord address จะอัพเดตทุกสัญญาที่ landlord name เดียวกัน (อัพเดต field inline). v2 ถ้ามี landlord table ทำ FK ตรงๆ ดีกว่า ไม่ต้อง cascade — Tem confirm หรือ?

- ❓ **`branch` field (สาขาใบกำกับภาษี)** — เก็บที่ contract level. v2 ที่จะแยก tenants table — branch ควรอยู่ที่ tenant level (เพราะ 1 บริษัทมีหลายสาขา) หรือ contract level?
