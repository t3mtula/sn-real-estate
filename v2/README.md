# Yonghua Starter

Template สำหรับทุก app ของ Yonghua Group · ไม่ต้อง setup framework/auth/Thai utils ใหม่ทุก app

## หยิบไปใช้

```bash
# 1. clone (copy folder · แล้ว reset git)
cp -r yonghua-starter ../app-ชื่อใหม่
cd ../app-ชื่อใหม่
rm -rf node_modules package-lock.json .git
git init

# 2. ตั้งค่า
cp .env.example .env.local
# แก้ค่าใน .env.local (Supabase URL + key)

# 3. install
npm install

# 4. dev
npm run dev
# → http://localhost:5173

# 5. deploy
npm run deploy
```

## มีอะไรพร้อมใช้

- ✅ Vite + React 19 + TypeScript strict
- ✅ Tailwind v4 + shadcn/ui (25 components · New York · stone)
- ✅ react-router-dom v7 + TanStack Query + Zustand
- ✅ Supabase + Google OAuth (option restrict โดเมน)
- ✅ Forms (react-hook-form + zod)
- ✅ Tables (@tanstack/react-table)
- ✅ Charts (recharts + shadcn Chart)
- ✅ Animation (framer-motion)
- ✅ Drag-drop (@dnd-kit · touch + a11y)
- ✅ Toast (sonner)
- ✅ ⌘K Command palette (cmdk)
- ✅ Thai utilities (พ.ศ., ฿, เบอร์โทร, เลขประจำตัว 13 หลัก)
- ✅ AppShell + Sidebar (collapsible · persisted) + TopBar
- ✅ Biome (lint + format · เร็วกว่า ESLint 10x)
- ✅ Cloudflare Pages deploy config

## Scripts

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | dev server (http://localhost:5173) |
| `npm run build` | build production → `dist/` |
| `npm run preview` | ดู build local |
| `npm run typecheck` | TypeScript check |
| `npm run check` | Biome format + lint + import sort (auto-fix) |
| `npm run format` | Biome format only |
| `npm run lint` | Biome lint only (no fix) |
| `npm run deploy` | build + deploy ไป Cloudflare Pages |

## โครงสร้าง

```
src/
├── lib/                  shared utilities · import จาก @/lib/*
│   ├── thai-date.ts      วันที่ พ.ศ.
│   ├── thai-money.ts     ฿ format + spell
│   ├── thai-phone.ts     08x-xxx-xxxx
│   ├── thai-id.ts        เลขประจำตัว 13 หลัก
│   ├── supabase.ts       typed client
│   ├── auth.ts           Google OAuth + useSession
│   └── utils.ts          cn() helper
├── components/
│   ├── ui/               shadcn (อย่าแก้ตรงๆ)
│   └── yonghua/          AppShell · Sidebar · TopBar · CommandPalette
├── routes/               หน้าต่างๆ
├── stores/               zustand global state
└── index.css             Tailwind v4 + theme tokens
```

## หลัง clone — ปรับให้เป็น app ใหม่

ดู `CLAUDE.md` (รายละเอียดเต็ม) · checklist:

- [ ] แก้ `package.json` → `name`
- [ ] แก้ `wrangler.toml` → `name` (กลายเป็น URL)
- [ ] แก้ `index.html` → `<title>`
- [ ] แก้ `src/components/yonghua/sidebar.tsx` → brand + nav items
- [ ] สร้าง `.env.local`
- [ ] (option) gen Supabase types
- [ ] (option) override theme colors ใน `src/index.css`

## License

Internal · Yonghua Group only
