# SN Real Estate — v2

> **Override:** ไฟล์นี้ override conventions ของ root `CLAUDE.md` เมื่อทำงานใน `/v2`
> Notion Work Log + Lessons + วิธีอธิบายให้ Tem + "ตอนนี้สถานะ" → ใช้ตาม root CLAUDE.md
>
> Stack + folder convention + Thai utilities → ใช้มาตรฐาน **Yonghua Starter** (อ่านที่ `/Users/tem/Documents/Claude/Projects/yonghua-starter/CLAUDE.md`)

---

## 📌 v2 คือใคร

- **App:** SN Real Estate v2 — rewrite ของ v1 (vanilla HTML+JS)
- **Scope ปัจจุบัน:** Properties (ทรัพย์สิน) + Contracts (สัญญาเช่า) เท่านั้น
- **Why:** ลูกน้องใช้ v1 แค่ contract feature · ใช้ shadcn + React → ทำเร็วขึ้น สวยขึ้น
- **Database:** Supabase project `hfnqgwphahqmajrmsonm` (shared กับ v1 parallel · ห้าม break v1 schema)
- **v1 อยู่ที่:** root directory ของ `App - SN Real Estate/` — production, freeze สำหรับ feature ใหม่
- **Live URL:** https://sn-real-estate-v2.pages.dev

## 🧱 Stack

ใช้ตาม **Yonghua Starter** 100% (Vite 7, React 19, TypeScript, Tailwind v4, shadcn New York · stone, react-router-dom v7, TanStack Query/Table, RHF + zod, Zustand, Sonner, dayjs + buddhist-era, radix-ui, Recharts, Framer Motion, dnd-kit, Biome, Supabase, Google OAuth, CF Pages)

**ห้ามเพิ่ม/เปลี่ยน library โดยไม่ถาม Tem**

## 🎨 Brand customization

**Brand v5 "Quiet & Confident"** — port จาก v1
- Primary: `#0F4C5C` (deep petrol teal) — `--primary` override
- Accent: `#C77D49` (warm copper, rare use) — `--accent` override
- Surface: `#FAFAFA` (cool near-white) — `--background` override
- Radius: `0.5rem` (tighter than starter default `0.625rem`)
- ที่เหลือ — stone neutrals จาก starter

**ห้ามใช้สีอื่นนอกจาก CSS variables** — primary/accent/destructive/etc.

## 🔐 Auth

- Provider: Google OAuth via Supabase Auth
- Domain restrict: `@sstpconstruction.com` (set ใน `VITE_AUTH_ALLOWED_DOMAIN`)
- Callback: `/auth/callback` (starter default)
- Redirect URLs ใน Supabase ต้องมี `https://sn-real-estate-v2.pages.dev/**` + `http://localhost:5173/**`

## 📁 Nav items (sidebar)

- `/` — หน้าแรก (Home icon)
- `/properties` — ทรัพย์สิน (Building2 icon)
- `/contracts` — สัญญา (FileText icon)

แก้ที่ `src/components/yonghua/app-shell.tsx` — `NAV_ITEMS` constant

## 🚦 กฎ v2 (เพิ่มจาก starter)

1. **v1 freeze** — feature ใหม่ไม่ใส่ root (v1) · แค่ bug fix ฉุกเฉิน
2. **Schema migration ต้องไม่ break v1** — เพิ่ม column ปลอดภัย · rename/drop column ห้าม
3. **ก่อนแก้ code บอกชัด** "แก้ที่ไหน · feature ไหน · กระทบส่วนอื่นไหม"
4. **Definition of Done ต่อ feature:**
   - TypeScript build pass
   - Biome check pass (no error)
   - Chrome verify ที่ live URL จริง · screenshot
   - Feature parity (เทียบ v1 ใน checklist)
   - Mobile responsive (test ที่ 390px width)
5. **Audit-first** ก่อน build feature ใหม่ — อ่าน v1 code → list ทุก feature → Tem mark MUST/NICE/SKIP → build ตาม checklist
6. **Notion Work Log + Decision log** — ทุก decision ที่ทำใส่ `v2/docs/decisions.md`

## 🚫 ไม่ทำใน v2 (จนกว่าจะใช้จริง)

- Pipeline · Landlords aggregate · Dashboard + แผนที่ไทย · Renewals
- Excel import/export (ละแล้ว ใช้ Supabase ตรง)
- Activity log UI (port หลัง contract ready)
- Meters · Moveout inspection · Deposit return (contract lifecycle features)
- Invoicing (separate phase)

หลัก: **"ใช้ของจริงเมื่อใช้จริง"** — ไม่ port เผื่อ

## 🚀 Deploy

```bash
npm run deploy
```

→ `npm run build` + `wrangler pages deploy dist` → `sn-real-estate-v2.pages.dev`

## ก่อนแก้ code v2 บอกก่อนว่า

- แก้ที่ไหน (`src/features/...` / `src/routes/...` / `src/components/...` / `src/lib/...`)
- กระทบ component / route อื่นไหม
- เป็น server state, client state, หรือ pure UI
