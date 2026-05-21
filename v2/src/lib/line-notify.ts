/**
 * LINE Notify helper · ส่งข้อความเข้า LINE group/personal
 *
 * Setup:
 *   1. ไปที่ https://notify-bot.line.me/my/
 *   2. กด "Generate token" → เลือก group/personal → copy token
 *   3. เก็บ token ไว้ฝั่ง server (Supabase Edge Function หรือ env) · ห้ามเก็บ client
 *   4. สร้าง Edge Function เปิด HTTP endpoint ที่ accept message · forward to LINE Notify
 *
 * ทำไมต้อง server-side?
 *   - LINE Notify ต้องการ Bearer token · ถ้าเก็บใน client = leak ทุก user
 *   - browser → CORS block ถ้าเรียก LINE Notify โดยตรง
 *
 * Usage (client side):
 *   await notifyLine({
 *     message: 'สัญญาเช่า RE-2569-042 จะหมดใน 30 วัน',
 *     link: 'https://app.com/contracts/42',
 *   })
 *
 * Usage (Supabase Edge Function เป็น proxy):
 *   See supabase/functions/line-notify/index.ts (template ด้านล่าง)
 */

interface NotifyLineInput {
  /** ข้อความ · max 1000 ตัวอักษร */
  message: string
  /** ใส่ link · LINE จะแสดงเป็น clickable card */
  link?: string
  /** เลือก endpoint ของ Edge Function ของ project นี้ · default 'line-notify' */
  endpoint?: string
  /** override token (สำหรับ test) · ปกติ Edge Function อ่านจาก env */
  token?: string
}

export async function notifyLine(input: NotifyLineInput): Promise<void> {
  const endpoint = input.endpoint ?? 'line-notify'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not set')

  const url = `${supabaseUrl}/functions/v1/${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      message: input.message,
      link: input.link,
      ...(input.token ? { _token: input.token } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`LINE Notify failed: ${err}`)
  }
}

/**
 * Format message with sections (LINE Notify รับ \n ปกติ)
 *
 * Example:
 *   notifyLine({ message: lineMessage([
 *     '🔔 แจ้งเตือนสัญญาใกล้หมด',
 *     '',
 *     'ลูกค้า: ' + customer.name,
 *     'สัญญา: ' + contract.no,
 *     'วันหมด: ' + fmtThaiLong(contract.end_date),
 *     '',
 *     'กดเพื่อดูรายละเอียด ↓',
 *   ]) })
 */
export function lineMessage(lines: string[]): string {
  return lines.join('\n').slice(0, 1000)
}
