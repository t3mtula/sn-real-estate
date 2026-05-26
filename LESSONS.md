# Lessons Learned — apply ทุก task

> **กฎจากปัญหาที่เคยเกิด · ห้ามทำซ้ำ**
> Source: https://www.notion.so/5fb68ef12b7b4d16bf0b1220b597c5cb
> Synced: 2026-05-24 · ถ้าเก่ากว่า 7 วัน บอก Claude "sync lessons"

## วิธีใช้

Lesson แต่ละข้อคือ rule ที่ต้อง apply ทันที · title = the rule · ถ้าต้องการ context (Why It Failed / Better Approach) → click Notion link

---

## ⭐ Verification policy (Tem 23 พ.ค. · overrides Chrome-verify rule)

**Default = ไม่ต้อง Chrome verify · verify ด้วย logic-trace แทน** ([Notion](https://www.notion.so/368fdba535ca81e28331cc6911d4b0a4))

ก่อน push ทุก batch (ตามลำดับ ไม่ข้าม):

1. **`tsc -b && vite build` pass** — baseline
2. **`npm run lint` ถ้ามี** — catch dead code/unused imports
3. **Trace code path ใหม่** — walk entry → branch → state mutated → exit · อ่าน unchanged code 2 ฝั่งของ diff ด้วย (bug ซ่อนที่ seam)
4. **Cross-ref invariants ของ codebase** — ก่อนเรียก function/ใช้ data shape → อ่าน signature + 1-2 callers ก่อน · ก่อนถือ convention → grep 1 ที่ใช้จริง ยืนยัน
5. **Sample-input sanity check** สำหรับ math/ตรรกะ — รันตัวอย่างในหัว เทียบกับ expected (ตัวอย่างจริง: dashboard `monthlyRev` หาร freq.months → rate=5,000 quarterly ได้ 1,667 ผิด · ถ้าคิดตัวอย่างก่อน push จะจับได้ทันที)
6. **ตอน port v1 → v2** — อ่าน v1 ช้าๆ · list invariants implicit · บันทึก convention difference (string vs number, per-cycle vs per-month, freq-multiply convention)
7. **Self-review = รัน /scrutinize บนของตัวเอง** ก่อน sign-off ถ้า batch ใหญ่ (3+ commits)

**Chrome verify → ทำเฉพาะตอน Tem ขอ** หรืองานที่ logic-trace จับไม่ได้:
- CSS layout / typography / spacing / alignment
- PDF rendering quality (font/page break/visual)
- Animation/transition smoothness
- Mobile Safari/iOS-specific behavior
- User-reported "ดูแปลก"

---

## 🚀 Cloudflare Pages deploy — ใช้ `--branch=main` เสมอ

**deploy ด้วย `--branch=main` เท่านั้น** — ห้ามใช้ `--branch=production` หรือชื่ออื่น

- `--branch` ใน wrangler คือ **label** ของ deployment ไม่ใช่ environment จริง
- Cloudflare Pages กำหนด production branch ใน project settings = `main`
- ถ้าใส่ `--branch=production` → สร้าง **preview alias** `production.xxx.pages.dev` แทน → URL หลักไม่อัปเดต
- **commit message ต้องเป็น ASCII เสมอ** (ไทย → Cloudflare reject) → ใช้ `--commit-message="feat: ..."`

**คำสั่งที่ถูก:**
```
wrangler pages deploy dist --project-name=sn-real-estate-v2 --branch=main --commit-dirty=true --commit-message="feat: ..."
```

---

## 🖨️ v2 Print — ก่อนแก้ CSS/print ต้อง trace ก่อน + ตรวจ deploy

**ก่อนแก้ print/CSS ใดๆ ใน v2: route → component → import → buildFn → แก้ไฟล์นั้น** ([Notion](https://www.notion.so/36afdba535ca81b5943bdad004147bb1))

- **v2 print map (จำ):** `/templates/*` → `contract-html.ts` (HTML iframe) · `/contracts/*/print` → `contract-pdf.ts` (pdfmake) — คนละไฟล์คนละโลก
- **ใช้ `npm run build` เสมอ** (ไม่ใช่ `npx vite build`) — CI รัน `npm run build` = `tsc -b && vite build` · local ต้องเหมือนกัน
- **ถ้า `npm run build` fail ด้วย "Cannot find module"** → รัน `npm install` ก่อน — อาจมี package ใน lock file ที่ยังไม่ได้ install local
- **หลัง wrangler deploy** ตรวจบรรทัด `Uploaded N files` เสมอ — ถ้า 0 files = dist ไม่เปลี่ยน = deploy ของเก่า ต้องหยุด debug build ก่อน

---

## 🌐 Universal — ทุก app, ทุก task

- **Test end-to-end ของจริงก่อน push** · ห้าม mock confirm=NO · ห้ามทดสอบแค่ click handler ([Notion](https://www.notion.so/352fdba535ca8188b6b0d5bb01f02377))
- **Print layout: ตรวจผล print จริง (Ctrl+P / PDF)** ไม่ใช่แค่ overlay scrollHeight — ยกเว้น Tem ไม่ขอ ([Notion](https://www.notion.so/356fdba535ca81f2ad3ed6c1abcfe94a))
- **Hosting: ใช้ Cloudflare Pages เท่านั้น** ([Notion](https://www.notion.so/351fdba535ca811dbd69c51f8b41ae28))
- **Cloudflare API reject deploy** ถ้า commit message มี utf-8 issue ([Notion](https://www.notion.so/351fdba535ca81f4b564c0ae01ac7060))
- **สร้าง docs 2 ระดับ**: technical ไว้ code · summary ภาษาไทยไว้ให้ Tem ([Notion](https://www.notion.so/351fdba535ca817d9307cce9f102a642))

> ~~ห้ามรายงาน "เสร็จ" ก่อน runtime verify ใน Chrome~~ — **superseded** by Verification policy ข้างบน (23 พ.ค.)
> ~~ตรวจงานใน Chrome (live URL จริง) ก่อนบอก "ส่งแล้ว"~~ — **superseded** ตามนโยบายเดียวกัน

## 🔧 Claude Code config

- **ห้ามตั้ง Stop hook ทำหน้าที่ SessionEnd** ([Notion](https://www.notion.so/350fdba535ca818ab4b1cbbf4224065c))
- **ห้ามใช้ prompt hook ที่ LLM ต้อง return JSON ล้วน** ([Notion](https://www.notion.so/350fdba535ca81608b90d93f08af1bca))

## 🚦 Zola Equipment — เฉพาะ Zola

- **Shared CSS ต้องอยู่ในไฟล์ shared** (เช่น `01a-utils-css.js`) ([Notion](https://www.notion.so/351fdba535ca818aa174c8f05147fdfc))
- **เพิ่ม field ใน quote/sign/customer model** → migration + verify save end-to-end ใน Chrome ([Notion](https://www.notion.so/357fdba535ca8131af70c5491364cf10))
- **Excel filename**: `ชื่อเอกสาร_เลขที่_ลูกค้า_วันที่.xlsx` ([Notion](https://www.notion.so/355fdba535ca81b9b226d5cbe4a7e418))
- **Conflict-check v1 logic ก่อน port** — อย่า blindly copy ([Notion](https://www.notion.so/351fdba535ca81318c62cd8721ea6434))
- **SPA route ต้อง persist ลง sessionStorage** ([Notion](https://www.notion.so/355fdba535ca81049475c7c8317bbaa5))
- **ExcelJS image ต้องคำนวณ EMU offset** ([Notion](https://www.notion.so/355fdba535ca8120ab5cc46e6ce311aa))
- **ExcelJS cell คำนวณกัน** ต้องเป็น formula chain ([Notion](https://www.notion.so/355fdba535ca81ddbdb6f68d291467a2))
- **table-layout: fixed ต้องมี word-break + overflow-wrap** ([Notion](https://www.notion.so/355fdba535ca81aca02bebbe3c3b75e1))
- **Function name collision in concat builds** ([Notion](https://www.notion.so/351fdba535ca81c8ae6af6a602883c7b))
- **ห้าม inline material/qty string** · ใช้ `Zola.fmt.*` ([Notion](https://www.notion.so/350fdba535ca81069848ed44bda02834))
