# Lessons Learned — apply ทุก task

> **กฎจากปัญหาที่เคยเกิด · ห้ามทำซ้ำ**
> Source: https://www.notion.so/5fb68ef12b7b4d16bf0b1220b597c5cb
> Synced: 2026-05-09 · ถ้าเก่ากว่า 7 วัน บอก Claude "sync lessons"

## วิธีใช้

Lesson แต่ละข้อคือ rule ที่ต้อง apply ทันที · title = the rule · ถ้าต้องการ context (Why It Failed / Better Approach) → click Notion link

---

## 🌐 Universal — ทุก app, ทุก task

- **ห้ามรายงาน "เสร็จ" ก่อน runtime verify** ที่ live URL จริงใน Chrome — ไม่ใช่แค่ localhost preview ([Notion](https://www.notion.so/350fdba535ca81e598f9fd0ed1a21b89))
- **ตรวจงานใน Chrome (live URL จริง)** ก่อนบอก "ส่งแล้ว" ([Notion](https://www.notion.so/354fdba535ca81609426e029a5a7ca03))
- **Test end-to-end ของจริงก่อน push** · ห้าม mock confirm=NO · ห้ามทดสอบแค่ click handler ([Notion](https://www.notion.so/352fdba535ca8188b6b0d5bb01f02377))
- **Print layout: ตรวจผล print จริง (Ctrl+P / PDF)** ไม่ใช่แค่ overlay scrollHeight ([Notion](https://www.notion.so/356fdba535ca81f2ad3ed6c1abcfe94a))
- **Hosting: ใช้ Cloudflare Pages เท่านั้น** ([Notion](https://www.notion.so/351fdba535ca811dbd69c51f8b41ae28))
- **Cloudflare API reject deploy** ถ้า commit message มี utf-8 issue ([Notion](https://www.notion.so/351fdba535ca81f4b564c0ae01ac7060))
- **สร้าง docs 2 ระดับ**: technical ไว้ code · summary ภาษาไทยไว้ให้ Tem ([Notion](https://www.notion.so/351fdba535ca817d9307cce9f102a642))

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
