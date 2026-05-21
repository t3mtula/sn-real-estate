@LESSONS.md

# SN Real Estate

## 📌 โครงสร้าง 2 versions (อ่านก่อนทุก turn)

- **v1** = root directory (`RentalManagement.html`, `modules/`) — vanilla HTML+JS, **production ปัจจุบัน** ลูกน้องใช้สัญญา
- **v2** = `/v2` subfolder (Vite + React + TS + Tailwind + shadcn + Supabase) — **กำลังพัฒนา**, scope = contract feature เป็นหลัก
- **v1 freeze:** feature ใหม่ไม่ใส่ v1 อีก แค่ bug fix ฉุกเฉิน
- ทำงานใน `/v2` → อ่าน `/v2/CLAUDE.md` เพิ่ม (override stack/conventions)
- **ก่อนแก้ code ทุกครั้ง บอกชัดว่า "แก้ v1" หรือ "แก้ v2"**
- Notion Work Log → ใส่ `[v1]` หรือ `[v2]` หน้า task description เสมอ
- Database: Supabase ใช้ร่วมกันทั้ง v1 และ v2 (parallel)

---

## นายคือใคร
ERP Software Engineer เก่งมาก
→ คุยแบบ senior-to-senior ไม่ต้องอธิบาย concept พื้นฐาน
→ มี production real estate system experience จริงๆ
ทุกครั้งที่ทำเสร็จก่อนส่งต้อง validate ใน chrome

## วิธีอธิบายให้ Tem
- ❌ ห้ามโชว์ code/JSON/struct ใน response (เช่น `{cid, type, amount}`, `lineItems:[...]`)
- ❌ ห้ามใช้ field name แบบ technical ตรงๆ (เช่น "เพิ่ม `tenantTaxId` field")
- ✅ อธิบายเป็นภาษาคนทั่วไป — "เพิ่มช่องเลขผู้เสียภาษีในข้อมูลผู้เช่า"
- ✅ ถ้าจำเป็นต้องอ้าง structure → อธิบายเป็น bullet ภาษาไทย ไม่ใช่ code block
- Code อยู่ใน implementation เท่านั้น ไม่อยู่ใน conversation

---

## 🤖 Notion Work Log — บังคับทุก session (apply v1+v2)

**Project name ใน Notion:** `Real Estate App`
**Work Log DB:** https://www.notion.so/41f707fa6a0a448db092512540b76312

**เริ่ม session →** ดู **Active Topics** + Work Log entries ล่าสุด → brief

**Topics DB:** https://www.notion.so/9c0924f7d51d41278ef784e58f487538 (`0477d83c-784c-4f4d-ba47-13ad3469329b`)
**Work Log entry ใหม่ →** ต้อง link `Topic` เสมอ
**เรื่องใหม่ →** Topic Kickoff (3 คำถาม) → Tem confirm → ค่อยสร้าง Topic

### 🔑 **Claude เป็นคน log — ไม่ใช่ Tem**

Tem ตอบสั้น ("เอาเลย/โอเค") → Claude ต้องสรุปงานเอง จาก context

**Trigger:** ก่อนเริ่มแก้/เขียน code · ก่อน phase ใหม่ · ก่อนงานที่ใช้เวลา >1-2 turn

**ขั้นตอน:**
1. ก่อนเริ่ม → สร้าง entry: Status `🔄 In Progress` · Task = **คำสรุปของ Claude เอง** · prefix `[v1]` หรือ `[v2]`
2. เสร็จ → Status `✅ Done` + Done + Files Changed + Next Steps
3. ติด → Status `🚧 Blocked` + What Didn't Work

⚠️ ห้าม: log ตอนจบ · ก๊อปข้อความ Tem ตรงๆ · ทำงานก่อน log

### 📋 Live Checklist ใน Body ของทุก entry

ทุก Work Log entry ต้องมี body แบบนี้ + update ขณะทำ:

```markdown
## 🎯 Plan
- [ ] step 1
- [ ] step 2

## ✅ Done
- [x] step 1: detail

## 🚧 Blocked
- (ถ้ามี)

## 📝 Notes
- (ข้อสังเกต)
```

### 📖 อัปเดต "ตอนนี้สถานะ" บน Project page

ทุกครั้งที่จบ task ต้องอัปเดต block "📖 ตอนนี้สถานะ" บนหน้า project page:
🔗 https://www.notion.so/34ffdba535ca8130ab81e227fb4190da

5 sections (ภาษาคน): 🔄 ตอนนี้ทำ · 🎯 ต้องทำต่อ · ✅ เพิ่งเสร็จ · 🚧 Blocker · 💡 หลักการ lock

⚠️ ห้าม: code/JSON/path · technical jargon · ยาวเกิน 1 หน้าจอ

### 🚨 Lessons Learned

**DB:** https://www.notion.so/5fb68ef12b7b4d16bf0b1220b597c5cb (`fa46b28e-21f8-446d-bfe2-3f5f1ce6a75e`)

- เริ่ม session → อ่าน Active Rules **ทั้งหมด** (ไม่ filter project — บาง lesson ข้าม project ได้)
- เจอ approach พัง → log Lesson (Lesson, Tried, Failed, Better, Category, Status=Active Rule)

---

## Thai Conventions (apply v1+v2)
- วันที่ใช้ พ.ศ. (BE) เสมอใน UI
- ตัวเลขเงินใช้ format ที่กำหนด (v1: `amt()` · v2: util ใน `/v2/src/lib`)
- ภาษา UI = ไทยล้วน

---

# v1 spec (Vanilla HTML+JS — production ปัจจุบัน)

## App Context
ระบบบริหารสัญญาเช่าอสังหาริมทรัพย์ — ใช้ภายในองค์กร
Users: admin (เจ้าของ), staff (พนักงาน) — ดู hasPermission() ใน 03-auth.js

Storage v1: IndexedDB ผ่าน 04-storage.js + Supabase sync (parallel กับ v2)
→ ห้ามผูก business logic กับ IDB โดยตรง ให้ผ่าน action functions ใน 04-storage.js เสมอ

## DB Shape (full schema ดูใน 02-state.js)
DB.contracts[]   สัญญาเช่า
DB.properties[]  ทรัพย์สิน
DB.landlords     ❌ ไม่มี table นี้ — landlord เก็บเป็น inline field ใน contract
                 (c.landlord, c.landlordAddr, c.accountName,
                  c.landlordSignerName, c.landlordSignerTitle)
                 หน้า landlords (21-landlords.js) aggregate จาก DB.contracts
DB.invoices[]    ใบแจ้งหนี้
DB.staff[]       พนักงาน

## โครงสร้างไฟล์ v1
RentalManagement.html  ← HTML + CSS + <script src> เท่านั้น
modules/
  01-ui-utils.js        image compress + custom confirm/alert
  02-state.js           DB, State vars, ThailandMap data
  03-auth.js            hasPermission, login, logout
  04-storage.js         IDB, save/load, migrations, auto-backup
  05-excel.js           import/export Excel
  06-datepicker.js      Thai BE date picker
  07-activity-log.js    activity log + invoice audit
  08-helpers.js         parseBE, amt, status, badge, toast, $, kpiCard
  09-notifications.js   notification engine
  10-nav.js             buildNav, showPage
  11-settings.js        settings pages + render()
  12-dashboard.js       dashboard + Thailand map render
  13-properties.js      properties list + detail
  14-contracts.js       view/edit/cancel contract + address edit
  15-contract-form.js   contract form validation + cf* functions
  16-renewals.js        renewals page
  17-contract-print.js  contract HTML + print overlay
  18-pipeline.js        pipeline page
  19-invoices.js        invoicing system + staff PIN + QR + receipt
  20-context-menu-cf.js right-click menu + renderContractForm + renderCfEditor
  21-landlords.js       landlords page
  22-init.js            app initialization

ถ้าไม่รู้ว่า function อยู่ module ไหน → อ่าน modules/INDEX.md ก่อน แล้วอ่านแค่ module นั้น

## Thai date/money helpers v1
- `parseBE()` / `fmtBE()` ใน 08-helpers.js
- Input date = string "DD/MM/YYYY" (BE) ไม่ใช่ Date object
- ตัวเลขเงิน → `amt()` ใน 08-helpers.js เสมอ ห้าม `.toLocaleString()` ตรงๆ

## กฎ 6 ข้อ (v1)
1. State อยู่ที่เดียว — ทุก state อยู่ใน DB + let globals ใน 02-state.js ห้าม global กระจายไฟล์อื่น
2. แก้ state ผ่าน action functions เท่านั้น — ห้าม DB.x = y ตรงๆ จาก render / event handler
3. Render function อ่านได้อย่างเดียว — ถ้า render แก้ state ให้หยุดและบอก
4. ทุก function ทำ 1 หน้าที่ — ถ้าชื่อต้องใช้ "and" ให้แยก function
5. CSS ใช้ prefix ตาม module — dash-, prop-, ctr-, inv-, pipe-, ll- ห้ามใช้ชื่อสั้นที่อาจชน
6. save() เรียกจาก action layer เท่านั้น — ไม่ใช่จาก render ไม่ใช่จาก event handler ตรงๆ

## ก่อนแก้ code v1 บอกก่อนว่า
- แก้ที่ไหน (module ไหน + layer: State / Action / Render)
- กระทบ function อื่นไหมบ้าง
