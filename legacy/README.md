# legacy/ — v1 เก่า (retired 30 พ.ค. 2026)

โค้ด **v1** ของ SN Real Estate (vanilla HTML + JS) ที่ลูกน้องเคยใช้งานก่อนย้ายไป v2

## สถานะ
- ⛔ **เลิกใช้แล้ว** — ลูกน้องใช้ v2 (`/v2`) เต็มตัว
- 📦 เก็บไว้อ้างอิง business logic เก่าเท่านั้น
- 🚫 **ห้ามแก้ · ห้าม deploy** ตัวนี้

## ข้างใน
- `RentalManagement.html` — หน้าหลัก v1 (HTML + CSS + script src)
- `modules/` — โค้ด v1 ทั้งหมด (ดู `modules/INDEX.md` สำหรับ map ฟังก์ชัน)
- `AUDIT_2026-05-08.json` — ไฟล์ audit ยุค v1

## ข้อมูล
v1 กับ v2 ใช้ฐานข้อมูล Supabase ตัวเดียวกัน (`hfnqgwphahqmajrmsonm`) → ข้อมูลทั้งหมดอยู่ใน v2 ครบแล้ว ไม่ต้องย้าย

## ของเดิม host ที่ไหน
Cloudflare Pages project `sn-real-estate` → sn-real-estate.pages.dev (direct-upload · แยกจาก v2 project `sn-real-estate-v2`)
