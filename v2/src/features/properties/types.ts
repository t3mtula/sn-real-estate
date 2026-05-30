/**
 * Property type definitions
 *
 * Storage: Supabase `public.properties` table — JSONB blob `data` field
 * Source of truth: v1 model + feature-audit.md Section A1
 */

export const PROPERTY_TYPES = [
  { value: "shophouse", label: "ห้องแถว/อาคารพาณิชย์" },
  { value: "land_with_house", label: "ที่ดินพร้อมสิ่งปลูกสร้าง" },
  { value: "vacant_land", label: "ที่ดินเปล่า" },
  { value: "rooftop_tower", label: "ดาดฟ้า/เสาส่งสัญญาณ" },
  { value: "apartment", label: "อพาร์ตเมนต์" },
  { value: "other", label: "อื่นๆ" },
] as const;

export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number]["value"];

/**
 * Property data (stored in `properties.data` JSONB)
 * Source: audit A1 + v1 modules/13-properties.js + modules/14-contracts.js
 */
export type PropertyData = {
  /** Primary key inside JSON (legacy from v1 · auto-increment from `DB.nextPId`) */
  pid?: number;
  /** ชื่อทรัพย์สิน (required) */
  name: string;
  /** ประเภท · enum 6 ค่า (v2 normalizes to enum · v1 add form had free-text) */
  type: PropertyTypeValue;
  /** จังหวัด/สถานที่ (required) */
  location: string;
  /** ที่อยู่ละเอียด */
  address?: string;
  /** เลขโฉนด (ใช้แทน address ถ้า address ว่าง) */
  titleDeed?: string;
  /** เนื้อที่ free-text เช่น "2 ไร่ 1 งาน 50 ตร.วา" */
  area?: string;
  /** เจ้าของ (free-text · legacy v1 · ใช้กรณี landlord ไม่มีในระบบ หรือเจ้าของนอกระบบ) */
  owner?: string;
  /**
   * เจ้าของจริงในระบบ — link ไป landlords.id (text)
   * ต่างจาก contract.data.landlord_id (ผู้ให้เช่าตามสัญญา) · รองรับ sublease chain
   * เช่น property A: owner = ก (เจ้าของจริง) · contract #1 ก→ข (เช่าหลัก) · contract #2 ข→ค (เช่าช่วง)
   */
  ownerLandlordId?: string;
  /** ทรัพย์สินแบ่งได้หลายผู้เช่าพร้อมกัน (default true ถ้า type=rooftop_tower) */
  multiTenant?: boolean;
  /**
   * มิเตอร์น้ำ/ไฟของทรัพย์สิน — แหล่งความจริงของ "มีมิเตอร์ + เรตหน่วยละกี่บาท"
   * enabled = ทรัพย์นี้มีมิเตอร์ประเภทนั้น → สัญญาใหม่ดึงไปตั้งต้นว่าผู้เช่าต้องจ่าย
   * ratePerUnit = เรตตั้งต้น ใช้ prefill ฟอร์มจดมิเตอร์ (เลขจดแต่ละครั้ง snapshot เรตของตัวเองอยู่แล้ว)
   * ไม่มี key = ทรัพย์เก่าที่ยังไม่ตั้งค่า (ถือว่าไม่มีมิเตอร์)
   */
  utilities?: {
    water?: { enabled: boolean; ratePerUnit?: number };
    electricity?: { enabled: boolean; ratePerUnit?: number };
  };
  /** Status field (legacy v1 · ตอนนี้ derive จาก contracts จริงๆ) */
  status?: string;
  /**
   * รูปภาพ — v1 เก็บ base64 dataURL แต่ละรูป
   * v2 plan: เก็บเป็น URL ของ Supabase Storage (decisions.md)
   */
  images?: string[];
  /** Province ที่ดึงออกมาแยก (ใช้กับแผนที่ + reports) */
  province?: string;
  addr_province?: string;
  /** Sub-fields ของ address — used by `assemblePropAddr` ใน v1 */
  addr_no?: string;
  addr_moo?: string;
  addr_soi?: string;
  addr_road?: string;
  addr_subdistrict?: string;
  addr_district?: string;
  addr_postal?: string;
  /** v2 — free-text "เลขที่/หมู่/ซอย/ถนน" (รวมแทน addr_no/addr_moo/addr_soi/addr_road สำหรับ form) */
  addr_line?: string;
};

/** Property row จาก Supabase */
export type Property = {
  id: string;
  data: PropertyData;
  created_at: string | null;
  updated_at: string | null;
};
