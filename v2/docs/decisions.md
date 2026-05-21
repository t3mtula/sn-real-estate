# v2 Decisions Log

> Decision ทั้งหมดที่ทำมา · ไฟล์นี้คือ source of truth ของสิ่งที่ Tem ตกลง · Claude reference ก่อนเริ่มงานใหม่ทุกครั้ง

---

## Stack (locked Phase 0)

ใช้ **Yonghua Standard Stack** 100% · ดู `yonghua-starter/CLAUDE.md` สำหรับ stack ครบ
+ override เฉพาะ SN: brand v5 (teal/copper), domain `@sstpconstruction.com`, project name `sn-real-estate-v2`

## Phase 1 scope — locked 2026-05-21

### Phase 1A · Properties (ทรัพย์สิน) — ทุก bundle MUST

- ✅ ตารางทรัพย์สิน + search/filter/sort
- ✅ หน้ารายละเอียดทรัพย์สิน + รูปภาพ
- ✅ Form เพิ่ม/แก้ทรัพย์สิน
- ✅ ประเภทเป็น dropdown 6 ค่า (fix v1 dirty: add free-text vs edit enum)
- ✅ รูปทรัพย์สิน → Supabase Storage (เปลี่ยนจาก base64 ใน JSONB)
- ✅ Multi-tenant property (port มา · ดาดฟ้า/ที่ดินใหญ่)
- 🟡 NICE (defer): KPI cards/donut, activity log

### Phase 1B · Contracts (สัญญาเช่า) — ทุก bundle MUST

- ✅ ตารางสัญญา + search/filter/sort
- ✅ หน้าดูสัญญา + inline edit (port v1's recent inline edit pattern)
- ✅ Form เพิ่ม/แก้สัญญา
- ✅ Property dropdown ในฟอร์ม
- ✅ Tenants table แยก (relational, ตามที่ตกลงไว้)
- ✅ Landlord inline (port เดิม · แยก table ภายหลัง)
- ✅ Witnesses + signers
- ✅ ปุ่มยกเลิกสัญญา + confirm
- ✅ พิมพ์สัญญา (Ctrl+P → PDF) + audit "เว้นบรรทัด/appendix"
- ✅ Notification: สัญญาใกล้หมด (in-app)
- ✅ Activity log: สร้าง/แก้/ยกเลิก
- 🟡 NICE (defer): email notif, Quill rich-text template editor

### Permission (Q3) — defer

Phase 1: **ทุกคน @sstpconstruction.com ทำได้ทุกอย่าง** (เหมือน v1 ที่ไม่มี check)
ใส่ role-based permission ตอน app stable + มี user หลายระดับจริง

### Audit-first checklist source

ทุก feature อ้าง [`v2/docs/feature-audit.md`](feature-audit.md) (268 checkbox items)
ผม build ตาม audit · tick checkbox เมื่อ verify ใน Chrome จริง

---

## Build sequence — Phase 1A (Properties first)

| Batch | งาน | Verify |
|---|---|---|
| **1A-1** | Schema check + TS types + routes scaffold (/properties, /properties/new, /properties/:id, /properties/:id/edit) | build pass + 4 routes load (placeholder content) |
| **1A-2** | List page (table + filter + search + sort) | ลูกน้องเปิดเห็นทรัพย์สินครบจาก Supabase · search/filter ทำงาน |
| **1A-3** | Detail page + image gallery | กดทรัพย์ใดเห็นรายละเอียด + รูปครบ |
| **1A-4** | Add/Edit form + image upload → Supabase Storage | เพิ่ม+แก้ได้จริง · รูปขึ้น Storage · row JSONB ไม่บวม |

หลัง Phase 1A เสร็จ → side-by-side test กับ v1 → switchover ทรัพย์สิน → เริ่ม Phase 1B

---

## Migration safety rules

- ✅ Schema เดิมไม่ break — เพิ่ม column ปลอดภัย · rename/drop ห้าม
- ✅ v1 ยัง run parallel เป็น production จนกว่า v2 จะผ่าน side-by-side test
- ✅ v2 อ่าน + เขียน Supabase ตาราง JSONB เดียวกับ v1 (data field)
- ✅ ทรัพย์สิน image: ใหม่ที่สร้างใน v2 ไป Supabase Storage · base64 เดิมยังอ่านได้ (backward compat)
- ✅ Tenants table: สร้างใหม่ใน Phase 1B-1 · v1 inline data ยังอ่านได้ผ่าน adapter

---

## Open items (defer ต่อ)

- ❓ Quill rich-text template editor → port เมื่อ Tem ต้องแก้สัญญา template เอง
- ❓ `closeContract` action — ไม่มี UI dedicated ใน v1 · derived state จาก expiry date? · กลับมาดู Phase 1B-3
- ❓ `deposit_ledger` — รวมตอนทำ contract หรือเป็น phase ต่อ
- ❓ Property image migration จาก base64 → Storage (สำหรับข้อมูลเดิม) — Phase 2
