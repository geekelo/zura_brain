import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

const FRAME_INK = '#1f2937'
const FRAME_ACCENT = '#6d28d9'
const FRAME_SOFT = '#f3e8ff'
const FRAME_BG = '#ffffff'

/**
 * Draw a Zura Spa–framed QR for `phone` onto a canvas (and return PNG data URL).
 */
export async function renderFramedPhoneQr(phone, { size = 720 } = {}) {
  const payload = String(phone || '').trim()
  if (!payload) return null

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const pad = Math.round(size * 0.06)
  const outer = size - pad * 2
  const corner = Math.round(size * 0.04)

  // Soft background
  ctx.fillStyle = FRAME_SOFT
  ctx.fillRect(0, 0, size, size)

  // Outer frame
  roundRect(ctx, pad, pad, outer, outer, corner)
  ctx.fillStyle = FRAME_BG
  ctx.fill()
  ctx.lineWidth = Math.max(3, size * 0.012)
  ctx.strokeStyle = FRAME_ACCENT
  ctx.stroke()

  // Inner double line
  const inset = Math.round(size * 0.028)
  roundRect(ctx, pad + inset, pad + inset, outer - inset * 2, outer - inset * 2, corner * 0.7)
  ctx.lineWidth = Math.max(1.5, size * 0.005)
  ctx.strokeStyle = FRAME_INK
  ctx.globalAlpha = 0.22
  ctx.stroke()
  ctx.globalAlpha = 1

  // Brand header
  const brandY = pad + Math.round(size * 0.11)
  ctx.fillStyle = FRAME_ACCENT
  ctx.font = `700 ${Math.round(size * 0.055)}px "DM Sans", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ZURA SPA', size / 2, brandY)

  // Accent rule under brand
  const ruleW = Math.round(size * 0.22)
  ctx.strokeStyle = FRAME_ACCENT
  ctx.lineWidth = Math.max(2, size * 0.006)
  ctx.beginPath()
  ctx.moveTo(size / 2 - ruleW / 2, brandY + Math.round(size * 0.04))
  ctx.lineTo(size / 2 + ruleW / 2, brandY + Math.round(size * 0.04))
  ctx.stroke()

  // QR block
  const qrSize = Math.round(size * 0.52)
  const qrTop = Math.round(size * 0.22)
  const qrLeft = Math.round((size - qrSize) / 2)
  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, payload, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: FRAME_INK, light: FRAME_BG },
  })
  ctx.drawImage(qrCanvas, qrLeft, qrTop, qrSize, qrSize)

  // Footer label
  ctx.fillStyle = FRAME_INK
  ctx.font = `600 ${Math.round(size * 0.032)}px "DM Sans", system-ui, sans-serif`
  ctx.fillText(payload, size / 2, qrTop + qrSize + Math.round(size * 0.055))

  ctx.fillStyle = FRAME_ACCENT
  ctx.globalAlpha = 0.85
  ctx.font = `500 ${Math.round(size * 0.028)}px "DM Sans", system-ui, sans-serif`
  ctx.fillText('Client phone QR', size / 2, size - pad - Math.round(size * 0.045))
  ctx.globalAlpha = 1

  return {
    dataUrl: canvas.toDataURL('image/png'),
    canvas,
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: 'image/png' })
}

function safeFilename(phone) {
  const digits = String(phone || '').replace(/\D/g, '') || 'client'
  return `zura-spa-qr-${digits}.png`
}

/**
 * Client phone QR with Zura Spa frame — preview, enlarge, download, WhatsApp.
 */
export default function ClientPhoneQr({
  phone,
  clientName,
  whatsappPhoneDigits,
  showToast,
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [hiResUrl, setHiResUrl] = useState('')
  const [enlarged, setEnlarged] = useState(false)
  const [busy, setBusy] = useState(false)
  const genRef = useRef(0)

  useEffect(() => {
    const phoneValue = String(phone || '').trim()
    if (!phoneValue) {
      setPreviewUrl('')
      setHiResUrl('')
      return
    }
    const id = ++genRef.current
    let cancelled = false
    ;(async () => {
      try {
        const [small, large] = await Promise.all([
          renderFramedPhoneQr(phoneValue, { size: 360 }),
          renderFramedPhoneQr(phoneValue, { size: 900 }),
        ])
        if (cancelled || genRef.current !== id) return
        setPreviewUrl(small?.dataUrl || '')
        setHiResUrl(large?.dataUrl || small?.dataUrl || '')
      } catch (err) {
        if (!cancelled) {
          setPreviewUrl('')
          setHiResUrl('')
          showToast?.(err?.message || 'Could not generate QR')
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate only when phone changes
  }, [phone])

  const activeUrl = hiResUrl || previewUrl

  function handleDownload() {
    if (!activeUrl) return
    downloadDataUrl(activeUrl, safeFilename(phone))
    showToast?.('QR downloaded')
  }

  async function handleWhatsapp() {
    if (!activeUrl) return
    setBusy(true)
    try {
      const file = await dataUrlToFile(activeUrl, safeFilename(phone))
      const shareData = {
        files: [file],
        title: 'Zura Spa QR',
        text: `Zura Spa QR for ${clientName || phone}`,
      }
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData)
        showToast?.('Shared — pick WhatsApp if listed')
        return
      }
      // Fallback: download image + open chat so staff can attach
      downloadDataUrl(activeUrl, safeFilename(phone))
      const digits = whatsappPhoneDigits?.(phone) || String(phone || '').replace(/\D/g, '')
      const text = encodeURIComponent(
        `Hello — here is your Zura Spa client QR code for ${phone}.`,
      )
      if (digits) {
        window.open(`https://wa.me/${digits}?text=${text}`, '_blank', 'noopener,noreferrer')
      }
      showToast?.('QR downloaded — attach it in WhatsApp')
    } catch (err) {
      if (err?.name !== 'AbortError') {
        showToast?.(err?.message || 'Could not share QR')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!phone) return null

  return (
    <div className="client-qr">
      <header className="client-qr-head">
        <span className="client-qr-kicker">Zura Spa</span>
        <strong>Client QR</strong>
      </header>
      {previewUrl ? (
        <button
          type="button"
          className="client-qr-frame"
          onClick={() => setEnlarged(true)}
          aria-label="Enlarge Zura Spa QR code"
        >
          <img src={previewUrl} alt={`Zura Spa QR for ${phone}`} />
        </button>
      ) : (
        <p className="muted client-qr-loading">Generating…</p>
      )}
      <div className="client-qr-actions">
        <button type="button" className="text-btn" disabled={!activeUrl} onClick={() => setEnlarged(true)}>
          Enlarge
        </button>
        <span className="client-qr-dot" aria-hidden="true">
          ·
        </span>
        <button type="button" className="text-btn" disabled={!activeUrl} onClick={handleDownload}>
          Download
        </button>
        <span className="client-qr-dot" aria-hidden="true">
          ·
        </span>
        <button type="button" className="text-btn" disabled={!activeUrl || busy} onClick={handleWhatsapp}>
          {busy ? 'Sharing…' : 'Send QR'}
        </button>
      </div>

      {enlarged && activeUrl ? (
        <div
          className="client-qr-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged Zura Spa QR"
          onClick={() => setEnlarged(false)}
        >
          <div className="client-qr-lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2>Zura Spa QR</h2>
              <button type="button" className="text-btn" onClick={() => setEnlarged(false)}>
                Close
              </button>
            </div>
            <p className="muted note-intro">Snap or scan this code · {phone}</p>
            <img className="client-qr-lightbox-img" src={activeUrl} alt={`Zura Spa QR for ${phone}`} />
            <div className="client-qr-actions client-qr-lightbox-actions">
              <button type="button" className="btn outline" onClick={handleDownload}>
                Download
              </button>
              <button type="button" className="btn primary" disabled={busy} onClick={handleWhatsapp}>
                {busy ? 'Sharing…' : 'Send QR'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
