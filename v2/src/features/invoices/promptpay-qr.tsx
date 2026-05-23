/**
 * PromptPay QR generator — EMVCo spec with CRC16-CCITT
 * Ported from v1 modules/19-invoices.js buildPromptPayPayload()
 */

import { useEffect, useRef } from 'react'

/* ── CRC16-CCITT ── */
function crc16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ((crc & 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, '0')
}

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`
}

export function buildPromptPayPayload(promptPayId: string, amount?: number): string {
  const id = promptPayId.replace(/[^0-9]/g, '')

  // Identify type: 10-digit mobile, 13-digit citizen/tax, 15-digit e-wallet
  let aid: string
  if (id.length === 10) aid = `0066${id}` // mobile: add country code
  else if (id.length === 13 || id.length === 15) aid = id
  else aid = id

  const merchantAccInfo = tlv('00', 'A000000677010111') + tlv('01', aid)
  let payload =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('29', merchantAccInfo) +
    tlv('53', '764') + // THB
    (amount != null && amount > 0 ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'TH') +
    tlv('62', tlv('07', 'TXID' + Date.now().toString().slice(-8))) +
    '6304'

  payload += crc16(payload)
  return payload
}

/* ── QR canvas renderer ── */
interface Props {
  promptPayId: string
  amount?: number
  size?: number
  label?: string
}

export function PromptPayQR({ promptPayId, amount, size = 160, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!promptPayId || !canvasRef.current) return
    const payload = buildPromptPayPayload(promptPayId, amount)

    // Use built-in QRCode via dynamic import from qrcode package (bundled in app)
    import('qrcode').then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, payload, {
        width: size,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      }).catch(console.error)
    }).catch(() => {
      // qrcode not available — draw placeholder
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#f1f5f9'
        ctx.fillRect(0, 0, size, size)
        ctx.fillStyle = '#94a3b8'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('QR N/A', size / 2, size / 2)
      }
    })
  }, [promptPayId, amount, size])

  return (
    <div className='flex flex-col items-center gap-1'>
      <canvas ref={canvasRef} width={size} height={size} className='rounded border' />
      {label && <p className='text-[11px] text-muted-foreground'>{label}</p>}
    </div>
  )
}
