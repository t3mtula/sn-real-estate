# Yonghua Starter — for Claude sessions

> Template สำหรับทุก app ของ Yonghua Group
> Base: [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) (10.9k stars · MIT) — เลือกเพราะ proven · มี 10+ pages พร้อม · เร็วกว่าทำเองมาก
> Customized: ใส่ Yonghua brand + Thai utilities + Supabase Auth + Print system

## 🧱 Stack (locked — ห้ามเปลี่ยนเอง)

| Layer | Choice | หมายเหตุ |
|---|---|---|
| Build | **Vite 7** | Node 22.11 compatible (Vite 8 มี Rolldown binding bug) |
| Framework | **React 19** | |
| Language | **TypeScript strict** | |
| Routing | **TanStack Router** (file-based) | type-safe · auto-gen `routeTree.gen.ts` · ไม่ใช่ react-router-dom |
| Styling | **Tailwind CSS v4** | via `@tailwindcss/vite` · config ใน `src/styles/index.css` |
| Components | **shadcn/ui** | อย่าแก้ — ใช้ `npx shadcn add` |
| Icons | **lucide-react + Tabler** | ใช้ทั้ง 2 ตาม satnaing convention |
| Forms | **react-hook-form + zod** | shadcn Form integration |
| Server state | **@tanstack/react-query** | |
| Client state | **zustand** | + `src/stores/auth-store.ts` sync กับ Supabase |
| Tables | **@tanstack/react-table** | |
| Charts | **recharts** | ผ่าน shadcn Chart wrappers |
| Toast | **sonner** | |
| Command palette | **cmdk** | ⌘K |
| Date | **dayjs + buddhist-era** | wrap ที่ `@/lib/thai/date` |
| Backend | **Supabase** | project ID ต่อ app · ใส่ใน `.env.local` |
| Auth | **Supabase + Google OAuth** | replace Clerk · domain restrict ผ่าน `VITE_AUTH_ALLOWED_DOMAIN` |
| Lint/Format | **ESLint + Prettier** (จาก satnaing) | TODO: อาจสลับเป็น Biome ภายหลัง |
| Deploy | **Cloudflare Pages + Wrangler** | (satnaing default = Netlify) |

**ห้ามเพิ่ม library โดยไม่ถาม Tem.**

## 🔍 ก่อนเขียน feature ใหม่ — search ของสำเร็จรูปก่อน

**กฎทอง** · กฎที่ Tem ตั้งหลัง pivot Yonghua Starter จาก scratch → satnaing/shadcn-admin

ก่อนเขียน feature ใหม่ (component · hook · lib · integration · UI pattern):

### Step 1 — search ลำดับนี้

1. **เช็ค Yonghua Starter ก่อน** (helpers ใน `@/components/yonghua` · `@/lib` · `@/hooks`) — มีอยู่แล้วแน่ๆ ไหม
2. **shadcn registry** (`npx shadcn registry list` / blocks page) — มี block หรือ component พร้อมไหม
3. **npm registry** + ดู GitHub stars + maintained ล่าสุด + license + bundle size
4. **GitHub templates** (Vercel · Tanstack examples · awesome-* lists)

### Step 2 — เสนอ Tem (อย่างน้อย 2 options)

```
## ทำ [feature X] · มี options ดังนี้:

A. **<library 1>** (12k stars · MIT · maintained · +X KB)
   - Pros / Cons / setup time

B. **<library 2>** (5k stars · MIT · +Y KB)
   - Pros / Cons

C. **เขียนเอง** (~N ชั่วโมง · ต้อง maintain เอง)

ผมแนะ <A/B/C> เพราะ ___ · Tem เอาไหน?
```

### Step 3 — รอ Tem confirm · แล้วลงมือ

### 🟢 เขียนเอง OK เมื่อ:
- Tem ระบุชัด "custom" / "เขียนเอง"
- เป็น **business logic เฉพาะ** ของ Tem (ไม่มี lib ทำได้ทั่วไป)
- งานเล็ก < 30 นาที (wrap config หรือ glue 2 library)

### 🔴 ห้ามเขียนเอง (ต้อง search ก่อน):
- Print system (มี react-to-print)
- Animation (มี framer-motion)
- Drag-drop (มี @dnd-kit)
- Form state (มี react-hook-form + Zod)
- Fetch + cache (มี TanStack Query)
- Table sort/filter (มี TanStack Table)
- Charts (มี recharts)
- Excel I/O (มี xlsx / SheetJS)
- PDF gen (มี react-pdf · browser print)
- File upload (มี Supabase Storage)
- OAuth (มี Supabase Auth)
- Error tracking (มี Sentry)
- Confirm dialog (wrap shadcn AlertDialog)
- Date picker (wrap shadcn Calendar — มี BeDatePicker แล้ว)
- Notifications (in-app: sonner · external: LINE Notify)

### Why this rule

ตอนแรกผม build Yonghua Starter จาก scratch · เขียน Print + Form + Sidebar + ⌘K + dark mode ทั้งหมดเอง · เสีย session ทั้งวัน
Tem ถามตรงๆ "ไม่มีของสำเร็จรูป?" · ผม search · เจอ satnaing/shadcn-admin 10.9k stars ที่ตรงทุกอย่าง · pivot ทันที · เสียงานเก่า

**Lesson:** [Notion](https://www.notion.so/367fdba535ca816eb146ea0102e6708a)

## 📁 Folder structure (satnaing-derived)

```
src/
├── routes/                ← file-based routing (TanStack)
│   ├── __root.tsx
│   ├── _authenticated/    ← auth-guarded pages (dashboard, settings, tasks, users, chats)
│   ├── (auth)/            ← sign-in · sign-up · forgot-password · OTP · auth-callback
│   └── (errors)/          ← 401 · 403 · 404 · 500 · 503
├── features/              ← feature-organized code (auth, dashboard, tasks, users, etc.)
├── components/
│   ├── ui/                ← shadcn (อย่าแก้)
│   ├── layout/            ← AppShell · Sidebar (collapsible groups)
│   ├── yonghua/
│   │   └── print/         ← Yonghua Print system (A4 · header · table · footer)
│   └── yh-auth-sync.tsx   ← bridge Supabase session → auth-store
├── lib/
│   ├── supabase.ts        ← Supabase typed client
│   ├── yh-auth.ts         ← signInWithGoogle · signOut · useSession · isAllowedUser
│   ├── use-print.ts       ← usePrint() hook
│   ├── thai/
│   │   ├── date.ts        ← พ.ศ. dates (dayjs + buddhist-era)
│   │   ├── money.ts       ← ฿ format + spellAmt
│   │   ├── phone.ts       ← 08x-xxx-xxxx format
│   │   └── id.ts          ← เลขประจำตัว 13 หลัก validation
│   ├── utils.ts           ← cn() helper
│   └── ... (satnaing utilities: cookies, handle-server-error, etc.)
├── stores/
│   └── auth-store.ts      ← Zustand (sync'd with Supabase via YhAuthSync)
├── styles/
│   ├── index.css          ← Tailwind v4 + imports
│   ├── theme.css          ← shadcn tokens (satnaing default)
│   └── print.css          ← @page A4 + @media print
└── main.tsx               ← Providers (QueryClient · Theme · Font · Direction · YhAuthSync · Router)
```

## 🛠 CRUD helpers (กัน boilerplate 100 บรรทัด × module)

5 helpers ที่ใช้ในทุก module ของทุก app · ทำให้ CRUD ใหม่เหลือ ~30 บรรทัดแทน 100+

### 1. `useCrud<T>()` — Supabase + TanStack Query CRUD

```ts
import { useCrud } from '@/hooks/use-crud'

const { list, save, remove, reorder } = useCrud<Customer>('customers', {
  sortColumn: 'sort',           // optional · default 'sort'
  orderBy: { column: 'name' },  // optional
  filter: { active: true },     // optional
  messages: { saved: 'บันทึกลูกค้าแล้ว', removed: 'ลบลูกค้าแล้ว' },
})

list.data        // Customer[]
list.isLoading   // boolean
save.mutate(record)        // upsert · auto invalidate · auto toast
remove.mutate(id)          // delete · auto invalidate · auto toast
reorder.mutate(orderedIds) // batch update sort column
```

### 2. `<YhForm>` — RHF + Zod wrapper (จัด 3-generic ที่เพี้ยน)

แก้ปัญหา `z.coerce.number()` ที่ input type = unknown:

```tsx
import { YhForm, NumberField } from '@/components/yonghua/form'

const schema = z.object({
  name: z.string().min(1),
  rent: z.coerce.number().min(0),
})

<YhForm
  schema={schema}
  defaultValues={{ name: '', rent: 0 }}
  onSubmit={async (values) => { /* values: { name: string, rent: number } */ }}
>
  {(form) => (
    <>
      <FormField control={form.control} name="name" ... />
      <NumberField control={form.control} name="rent" label="ค่าเช่า" suffix="บาท" />
      <Button type="submit">บันทึก</Button>
    </>
  )}
</YhForm>
```

### 3. `<NumberField>` — type-safe number input

```tsx
<NumberField control={form.control} name="qty" label="จำนวน" />
<NumberField control={form.control} name="price" label="ราคา" suffix="บาท" decimal={2} />
```

จัดการ:
- `field.value === undefined/null/""` → render "" (ไม่ flash 0)
- onChange parse to number (หรือ "" ถ้า user ลบหมด)
- decimal control via step + inputMode

### 4. `await confirm({...})` — promise-based confirm dialog

```tsx
import { useConfirm } from '@/hooks/use-confirm'

function CustomerRow({ customer }) {
  const confirm = useConfirm()
  const { remove } = useCrud<Customer>('customers')

  async function handleDelete() {
    const ok = await confirm({
      title: `ลบ ${customer.name}?`,
      description: 'ลบแล้วเรียกคืนไม่ได้',
      confirmLabel: 'ลบ',
      destructive: true,
    })
    if (!ok) return
    remove.mutate(customer.id)
  }
  // ...
}
```

`<ConfirmProvider>` wire ใน main.tsx แล้ว · ไม่ต้องตั้งเอง

### 5. `<SortableList>` — drag-reorder list

```tsx
import { SortableList } from '@/components/yonghua/sortable-list'

const { list, reorder } = useCrud<Customer>('customers')

<SortableList
  items={list.data ?? []}
  getId={(c) => c.id}
  onReorder={(ids) => reorder.mutate(ids)}
  renderItem={(c) => <span>{c.name}</span>}
/>
```

Touch + keyboard + a11y พร้อมใช้ · drag handle เป็น ⋮ icon (กัน mis-click)

### Pattern: CRUD module เต็มรูปใน ~30 บรรทัด

```tsx
function CustomersPage() {
  const { list, save, remove, reorder } = useCrud<Customer>('customers')
  const confirm = useConfirm()

  return (
    <FormSection title="ลูกค้า" action={<AddButton onAdd={save.mutate} />}>
      <SortableList
        items={list.data ?? []}
        getId={(c) => c.id}
        onReorder={(ids) => reorder.mutate(ids)}
        renderItem={(c) => (
          <div className="flex justify-between">
            <span>{c.name}</span>
            <Button
              variant="ghost" size="sm"
              onClick={async () => {
                if (await confirm({ title: `ลบ ${c.name}?`, destructive: true })) {
                  remove.mutate(c.id)
                }
              }}
            >
              ลบ
            </Button>
          </div>
        )}
      />
    </FormSection>
  )
}
```

## 🇹🇭 Thai conventions

- **วันที่** = พ.ศ. (BE) เสมอ · ใช้ `fmtBE`, `parseBE`, `fmtThaiLong`, `fmtThaiShort` จาก `@/lib/thai`
- **เงิน** = `amt()` · `spellAmt()` จาก `@/lib/thai` · ห้าม `.toLocaleString()` ตรงๆ
- **เบอร์โทร** = `fmtPhone()` · `isValidPhone()`
- **เลขประจำตัว** = `fmtCitizenId()` · `isValidCitizenId()` (algorithm กรมการปกครอง)
- **ฟอนต์** = Sarabun (sans · Google Fonts) · loaded ใน `src/styles/index.css`

## 🔐 Auth flow

```
User คลิก "เข้าสู่ระบบด้วย Google"
   ↓ signInWithGoogle() จาก @/lib/yh-auth
   ↓ Supabase redirect → Google
   ↓ Google redirect → /auth-callback?redirect=...
   ↓ AuthCallbackPage:
   │   - Supabase auto-detects session (PKCE flow)
   │   - isAllowedUser() ตรวจ domain (VITE_AUTH_ALLOWED_DOMAIN)
   │   - populate auth-store
   │   - navigate → redirect URL (default "/")
   ↓
YhAuthSync (mounted at App root):
   - Listen Supabase onAuthStateChange
   - Sync session → useAuthStore.auth (setUser, setAccessToken, reset)
```

## 🖨️ Print system

```tsx
import {
  PrintLayout, PrintHeader, PrintSection, PrintField,
  PrintTable, PrintFooter, PrintPageBreak, PrintButton
} from '@/components/yonghua/print'
import { usePrint } from '@/lib/use-print'

<PrintLayout preview>
  <PrintHeader title="สัญญาเช่า" documentNo="RE-2569-042" date={fmtThaiLong(d)} />
  <PrintSection title="ผู้เช่า" avoidBreak>
    <PrintField label="ชื่อ" value="สมชาย ใจดี" />
  </PrintSection>
  <PrintTable columns={cols} rows={items} footer={<>รวม {amt(total)}</>} />
  <PrintFooter signatures={[{ label: 'ผู้ให้เช่า' }, { label: 'ผู้เช่า' }]} />
</PrintLayout>

// Trigger:
<PrintButton title="สัญญาเช่า-RE-2569-042" />
```

CSS classes: `.no-print` · `.print-only` · `.page-break-before/-after/-avoid`

## ⚙️ Setup สำหรับ app ใหม่ที่ clone จาก starter

```bash
cp -r yonghua-starter ../<new-app>
cd ../<new-app>
rm -rf node_modules package-lock.json .git
git init
```

1. แก้ `package.json` → `name`
2. แก้ `index.html` → `<title>`
3. แก้ `src/components/layout/data/sidebar-data.ts` → brand + nav items
4. สร้าง `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_AUTH_ALLOWED_DOMAIN=         # optional
   ```
5. ตั้ง Supabase Auth → Providers → Google: enable
6. ใส่ Authorized Redirect URLs ใน Google Cloud Console:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - (Supabase ใช้ URL นี้ · ไม่ใช่ URL ของ app)
7. (option) Gen Supabase types:
   ```bash
   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
   ```
8. `npm install && npm run dev` → http://localhost:5173

## 🚀 Deploy + version control (3 ชั้นกันพลาด)

> ⚠️ v2 อยู่ใต้ repo `github.com/t3mtula/sn-real-estate` (private · รวมแอป SN ตัวเก่าด้วย) · Pages project = `sn-real-estate-v2` (direct-upload)

**Workflow ทุกครั้งที่แก้ feature (ห้ามแก้บน main ตรงๆ):**

```bash
git checkout -b <งาน>           # 1. แตก branch
# 2. แก้ + commit
npm run deploy:preview          # 3. ยิง preview → ตรวจที่ preview.sn-real-estate-v2.pages.dev
git checkout main && git merge <งาน> && git push   # 4. ผ่านแล้ว merge
npm run deploy:prod             # 5. ขึ้นตัวจริง
```

- `npm run deploy` เปล่าๆ = บล็อก (กันเผลอ) · `deploy:preview`/`deploy:prod` ชัดเจน
- พัง → `git revert` + `deploy:prod` ใหม่ หรือ Cloudflare dashboard rollback
- `.env.local` มี secret → อยู่ใน `v2/.gitignore` (`*.local`) · ห้าม commit

## ❗ Common pitfalls

- **อย่าแก้ `routeTree.gen.ts` ตรงๆ** — auto-generated ทุกครั้ง dev/build
- **เพิ่ม route ใหม่ ต้อง vite dev ครั้งหนึ่ง** ให้ regenerate routeTree ก่อน build
- **อย่าแก้ shadcn components ใน `src/components/ui/`** — ใช้ wrapper ใน `src/components/yonghua/` หรือ feature folder
- **อย่าแก้ Supabase schema ฝั่ง prod โดยไม่ migration** — มี risk เสีย data ของ app เก่าที่ใช้ schema เดียวกัน
- **TypeScript paths** — ใช้ `@/...` แทน relative path 2 ระดับขึ้นไป
- **Vite 7 not 8** — Vite 8 มี Rolldown binding bug บน macOS arm64

## 📋 Helpers ทั้งหมด (Quick Reference)

ทุก helper ใส่ใน Starter เพื่อกัน boilerplate · CRUD ใหม่เหลือ ~30 บรรทัด (ไม่ใช่ 100+)

### Data
- **`useCrud<T>(table, opts)`** (`@/hooks/use-crud`) — Supabase + Query CRUD · list/save/remove/restore/reorder · soft delete + optimistic lock + audit log
- **`logActivity({ action, entity, ... })`** (`@/lib/audit-log`) — PDPA + forensic log

### Forms
- **`<YhForm>`** (`@/components/yonghua/form`) — RHF + Zod 3-generic wrapper
- **`<NumberField>`** — type-safe number input
- **`<FormSection>` `<FormGrid>` `<FormActions>` `<FormStepper>`** — layout patterns
- **`<UnsavedChangesWarning>`** — beforeunload guard

### Confirm + Dialog
- **`useConfirm()`** (`@/hooks/use-confirm`) — `await confirm({title, destructive})`

### Lists & Tables
- **`<SortableList>`** (`@/components/yonghua/sortable-list`) — drag-reorder

### UX State
- **`<EmptyState>`** `<LoadingState>` (`@/components/yonghua/state`) — empty + loading
- **`<ErrorBoundary>`** (`@/components/yonghua/error-boundary`) — กัน white screen

### Permission / RBAC
- **`hasPermission(user, 'invoice.delete')`** (`@/lib/permissions`)
- **`<Can user perm="...">`** (`@/components/yonghua/can`) — conditional render

### Print
- **`PrintLayout/Header/Section/Field/Table/Footer/Button`** (`@/components/yonghua/print`)
- **`usePrint()`** (`@/lib/use-print`)

### Thai utilities
- **`fmtBE`, `parseBE`, `fmtThaiLong`** (`@/lib/thai`)
- **`amt()`, `spellAmt()`** — เงินบาท
- **`fmtPhone()`, `isValidPhone()`**
- **`fmtCitizenId()`, `isValidCitizenId()`**
- **`<BeDatePicker>`** (`@/components/yonghua/be-date-picker`) — date picker พ.ศ.

### CSV / Excel
- **`useExportCSV()`** (`@/hooks/use-csv`) — `exportCSV(rows, filename)` · `exportXLSX(rows, filename)`
- **`useImportCSV<T>()`** — `parseFile(file): Promise<T[]>`

### Notifications
- **`notifyLine({ message, link })`** (`@/lib/line-notify`)
- + Edge Function template ที่ `supabase/functions/line-notify/`

### Error tracking
- **`initSentry()`** (`@/lib/sentry`) — เรียกใน main.tsx
- **`captureError(err)`, `setUser({id, email})`, `addBreadcrumb()`**

## 🗄 Supabase migrations workflow

```
supabase/
├── migrations/
│   ├── 20260521000001_audit_log.sql       (มาก่อน · ทุก app)
│   └── YYYYMMDDHHMMSS_<description>.sql   (app-specific)
└── functions/
    └── line-notify/
        └── index.ts                       (Edge Function template)
```

### สร้าง migration ใหม่

```bash
# 1. Link project ถ้ายังไม่ได้
npx supabase login
npx supabase link --project-ref <project-id>

# 2. สร้าง migration ใหม่
npx supabase migration new add_contracts_table

# 3. เขียน SQL ใน file ที่สร้าง

# 4. Test ที่ local (ถ้ามี supabase CLI start)
npx supabase db reset

# 5. Apply ไป cloud
npx supabase db push
```

### กฎ:
- **อย่าแก้ schema ผ่าน Supabase Dashboard** · ใช้ migration เสมอ
- **อย่าแก้ migration file ที่ apply ไปแล้ว** · สร้าง file ใหม่
- ใช้ `IF NOT EXISTS` · `ON CONFLICT DO NOTHING` · idempotent เสมอ
- **เพิ่ม column = nullable หรือมี default** · ห้ามทำให้ของเก่าพัง
- **ห้าม `DROP TABLE/COLUMN/SEQUENCE` โดยไม่ grep** RPC/trigger/view ก่อน

## 🤖 Type generation (sync Supabase schema → TypeScript)

```bash
# Set project ID
export SUPABASE_PROJECT_ID=hfnqgwphahqmajrmsonm

# Generate (จะเขียน src/lib/database.types.ts)
npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/database.types.ts

# ใน src/lib/supabase.ts · เปลี่ยน:
#   type Database = any
# เป็น:
#   import type { Database } from './database.types'
```

ทุกครั้งที่ migration apply · run gen-types ใหม่

## 🔒 Pre-commit hook (Husky + lint-staged)

ก่อน `git commit` · ระบบรัน Prettier + ESLint บนไฟล์ที่ stage:
- ถ้าผ่าน = commit ผ่าน
- ถ้า ESLint error = block · ต้องแก้ก่อน

Config ใน `package.json` → `lint-staged`
Hook ใน `.husky/pre-commit`

ถ้า skip ครั้งเดียว: `git commit --no-verify` (อย่าใช้ปกติ)

## 🐢 ก่อนเริ่ม code feature ใหม่

1. อ่าน `Yonghua Standard Stack — Starter` project ใน Notion
2. อ่าน Lesson DB (Active Rule ทั้งหมด · ไม่ filter project)
3. สร้าง Work Log entry · Status `🔄 In Progress` · link ไปยัง project
4. ก่อนเขียน · บอก plan สั้นๆ (แก้ไหน · กระทบไหน)
5. หลังเขียน · run `npm run build` · `npm run lint` ก่อน commit
