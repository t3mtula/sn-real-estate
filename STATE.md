# SN Rental Manager — Session State

> **Update this file ทุกจบ session** · อ่านทุกเริ่ม session คู่กับ `memory/project_app_core.md`

## 🎯 ตอนนี้กำลังทำอะไร
- (ว่าง — เพิ่งจบงาน "นิติบุคคล + ผู้ลงนาม" รอ Tem สั่งต่อ)

## ⏳ งานค้าง / Next
- (ไม่มี)

## ✅ งานที่จบในรอบล่าสุด (2026-05-17 session)
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
- `chore(cleanup): ลบ partyDisplay helper ที่ไม่ถูกเรียกใช้`
- `feat(juristic): support นิติบุคคล + ผู้ลงนาม ครบ end-to-end`
- `fix(prefix): revert staff prefix UI + hasPrefix ใช้ includes`
- `feat(print): apply withPrefix() ใน sigBox ทุกที่`
- `feat(names): prefix dropdown ทุก field ชื่อคน + passport support`

## 🚀 ที่ Tem ใช้ตอนนี้
- Branch deploy: https://sn-real-estate.pages.dev/
- Worktree: `.claude/worktrees/sharp-curie-eaa567/`

## 💬 Session opening flow (สำหรับ Claude)
1. อ่าน `memory/project_app_core.md` → รู้ core concept
2. อ่าน STATE.md (ไฟล์นี้) → รู้ตอนนี้อยู่ตรงไหน
3. Fetch Notion Work Log 3-5 entries ล่าสุด → cross-check
4. Brief Tem 3-5 บรรทัด → "พร้อมรับงาน"
