// Supabase Edge Function · line-notify
//
// Deploy:
//   supabase functions deploy line-notify
//
// Set secret:
//   supabase secrets set LINE_NOTIFY_TOKEN=your_token_here
//
// (ค่า token ขอจาก https://notify-bot.line.me/my/ · token ต่อ group/personal)
//
// Client → POST /functions/v1/line-notify
//   { "message": "...", "link": "..." }

// @ts-expect-error · Deno runtime · บน Supabase Edge
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const LINE_NOTIFY_TOKEN = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } })
  .Deno?.env.get('LINE_NOTIFY_TOKEN')

interface Body {
  message: string
  link?: string
  _token?: string // ใช้ test override · ใน prod ใช้ env
}

serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = (await req.json()) as Body
  const token = body._token ?? LINE_NOTIFY_TOKEN
  if (!token) {
    return new Response('Missing LINE_NOTIFY_TOKEN', { status: 500 })
  }

  const message = body.link ? `${body.message}\n${body.link}` : body.message

  const formData = new URLSearchParams()
  formData.append('message', message.slice(0, 1000))

  const lineRes = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  if (!lineRes.ok) {
    const err = await lineRes.text().catch(() => lineRes.statusText)
    return new Response(`LINE API error: ${err}`, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  return new Response('OK', {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
})
