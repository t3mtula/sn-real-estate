@LESSONS.md

# SN Real Estate

## 📌 โครงสร้าง (อ่านก่อนทุก turn)

- **v2 = แอปจริง** อยู่ที่ `/v2` (Vite + React + TS + Tailwind + shadcn + Supabase) — ลูกน้องใช้ตัวนี้เต็มตัวแล้ว
- ทำงานใน `/v2` → อ่าน `/v2/CLAUDE.md` เพิ่ม (stack/conventions ทั้งหมดอยู่ที่นั่น)
- **v1 retired แล้ว (30 พ.ค. 2026)** — โค้ดเก่า vanilla HTML+JS ย้ายเข้า `legacy/` (เก็บอ้างอิงเท่านั้น ห้ามแก้/ห้าม deploy) · ดู `legacy/README.md`
- Database: Supabase project `hfnqgwphahqmajrmsonm` (ตัวเดียว)
- Hosting: Cloudflare Pages `sn-real-estate-v2` → sn-real-estate-v2.pages.dev

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

## 🤖 Notion Work Log — บังคับทุก session

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
1. ก่อนเริ่ม → สร้าง entry: Status `🔄 In Progress` · Task = **คำสรุปของ Claude เอง**
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

## Thai Conventions
- วันที่ใช้ พ.ศ. (BE) เสมอใน UI
- ตัวเลขเงินใช้ util ใน `/v2/src/lib/thai` (`amt()`) — ห้าม `.toLocaleString()` ตรงๆ
- ภาษา UI = ไทยล้วน

> **App spec / stack / conventions / deploy ทั้งหมดอยู่ใน `/v2/CLAUDE.md`** — อ่านที่นั่นก่อนแก้ code
