# Yonghua Starter

Template สำหรับทุก app ของ Yonghua Group · base = [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) (10.9k stars · MIT)
Customized: Yonghua brand · Thai utilities · Supabase Auth · Print system

## หยิบไปใช้

```bash
# 1. clone (copy folder · reset git)
cp -r yonghua-starter ../app-ใหม่
cd ../app-ใหม่
rm -rf node_modules package-lock.json .git
git init

# 2. ตั้งค่า
cp .env.example .env.local
# แก้ค่าใน .env.local (Supabase URL + anon key)

# 3. install + dev
npm install
npm run dev
# → http://localhost:5173
```

## มีอะไรพร้อมใช้

จาก satnaing base:
- ✅ Vite 7 + React 19 + TypeScript strict
- ✅ Tailwind v4 + shadcn/ui (50+ components)
- ✅ TanStack Router (file-based · type-safe) + TanStack Query + Table
- ✅ react-hook-form + zod
- ✅ Zustand auth-store + cookies helper
- ✅ AppShell · Sidebar (collapsible groups · multi-team switcher)
- ✅ ⌘K Command palette
- ✅ Dark/light mode toggle
- ✅ Font + Direction provider (RTL ready)
- ✅ Auth pages: sign-in · sign-up · forgot-password · OTP
- ✅ Settings: profile · account · appearance · notifications · display
- ✅ Error pages: 401 · 403 · 404 · 500 · 503
- ✅ Feature examples: dashboard · tasks · users · chats · apps · help-center
- ✅ DataTable: sort/filter/pagination

จาก Yonghua customization:
- ✅ Sarabun font
- ✅ Yonghua brand (sidebar, titles)
- ✅ **Thai utilities**: พ.ศ. dates · ฿ format + spell · เบอร์โทร · เลขประจำตัว 13 หลัก
- ✅ **Supabase Auth + Google OAuth** (replace Clerk mock)
- ✅ **YhAuthSync** Supabase session ↔ Zustand
- ✅ **Print system** (A4, header repeat, ไม่ตัด row, background สีคงไว้)

## Scripts

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | dev server (port 5173) |
| `npm run build` | build production → `dist/` |
| `npm run preview` | ดู build local |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run knip` | ตรวจ unused code |
| `npm test` | Vitest (browser mode) |

## โครงสร้าง

ดู `CLAUDE.md` · สรุป:

```
src/
├── routes/                file-based (TanStack)
├── features/              feature-organized
├── components/{ui,layout,yonghua}
├── lib/{supabase,yh-auth,thai/,utils,use-print}
├── stores/auth-store
└── styles/{index,theme,print}.css
```

## License

Internal · Yonghua Group only · base = MIT (satnaing/shadcn-admin)
