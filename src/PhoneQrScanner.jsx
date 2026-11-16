import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

/**
 * Pull a phone (or digit string) out of scanned QR text.
 * Supports raw phones, Zura Spa QR payloads, and wa.me links.
 */
export function phoneFromQrText(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''

  const wa = raw.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)[/]?(\+?\d{7,15})/i)
  if (wa?.[1]) return wa[1].replace(/^\+/, '')

  const tel = raw.match(/^tel:(.+)$/i)
  if (tel?.[1]) {
    const d = tel[1].replace(/[^\d+]/g, '')
    return d || tel[1].trim()
  }

  // Prefer original formatting when the whole payload looks like a phone
  if (/^[\d\s+\-().]+$/.test(raw)) {
    const digits = raw.replace(/\D/g, '')
    if (digits.length >= 7) return raw.replace(/\s+/g, ' ').trim()
  }

  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 7 && digits.length <= 15) return digits

  return ''
}

async function stopScanner(scanner) {
  if (!scanner) return
  try {
    if (scanner.isScanning) await scanner.stop()
  } catch {
    /* ignore */
  }
  try {
    scanner.clear()
  } catch {
    /* ignore */
  }
}

export default function PhoneQrScanner({ open, onClose, onScan, showToast }) {
  const reactId = useId()
  const readerId = `qr-reader-${reactId.replace(/:/g, '')}`
  const fileReaderId = `qr-file-${reactId.replace(/:/g, '')}`
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  const showToastRef = useRef(showToast)
  const handledRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  onScanRef.current = onScan
  showToastRef.current = showToast

  useEffect(() => {
    if (!open) return undefined
    handledRef.current = false
    setError('')
    setStarting(true)

    const scanner = new Html5Qrcode(readerId)
    scannerRef.current = scanner
    let cancelled = false

    ;(async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (handledRef.current || cancelled) return
            const phone = phoneFromQrText(decoded)
            if (!phone) {
              showToastRef.current?.('QR did not contain a phone number')
              return
            }
            handledRef.current = true
            onScanRef.current?.(phone)
          },
          () => {},
        )
        if (!cancelled) setStarting(false)
      } catch (err) {
        if (!cancelled) {
          setStarting(false)
          setError(
            /permission|notallowed|denied/i.test(String(err?.message || err))
              ? 'Camera permission denied — you can upload a QR image instead'
              : 'Could not start camera — upload a QR image instead',
          )
        }
      }
    })()

    return () => {
      cancelled = true
      const s = scannerRef.current
      scannerRef.current = null
      stopScanner(s)
    }
  }, [open, readerId])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      // File decode needs its own instance (camera scanner may already be running).
      const fileScanner = new Html5Qrcode(fileReaderId, { verbose: false })
      const decoded = await fileScanner.scanFile(file, false)
      await stopScanner(fileScanner)
      const phone = phoneFromQrText(decoded)
      if (!phone) {
        showToastRef.current?.('QR did not contain a phone number')
        return
      }
      handledRef.current = true
      onScanRef.current?.(phone)
    } catch (err) {
      showToastRef.current?.(err?.message || 'Could not read QR from image')
    }
  }

  if (!open) return null

  return (
    <div
      className="client-qr-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Scan client QR"
      onClick={onClose}
    >
      <div className="client-qr-lightbox-panel scan-qr-panel" onClick={(ev) => ev.stopPropagation()}>
        <div className="panel-head">
          <h2>Scan client QR</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted note-intro">
          Point the camera at a Zura Spa client QR. The phone number fills the search field.
        </p>
        {starting && !error ? <p className="muted">Starting camera…</p> : null}
        {error ? <p className="scan-qr-error">{error}</p> : null}
        <div id={readerId} className="scan-qr-reader" />
        <div id={fileReaderId} className="scan-qr-file-reader" aria-hidden="true" />
        <div className="client-qr-actions client-qr-lightbox-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFile}
          />
          <button type="button" className="btn outline" onClick={() => fileInputRef.current?.click()}>
            Upload QR image
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
