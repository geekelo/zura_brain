const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function url(path) {
  return `${API_BASE}${path}`
}

/** Rails `t.decimal` may arrive as "35000.0" — always coerce to a finite number. */
export function parseDecimal(value, fallback = 0) {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(n) ? n : fallback
}

/** Normalize to `HH:MM:SS` for `/pos/sessions/:ss/times`. */
export function toTimeOfDay(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  const plain = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (plain) {
    const hh = plain[1].padStart(2, '0')
    const mm = plain[2]
    const ss = (plain[3] || '00').padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  // API often returns clock times on a dummy UTC date (e.g. 2000-01-01T14:05:00.000Z)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function nowTimeOfDay(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function hasSessionTime(value) {
  return Boolean(toTimeOfDay(value))
}

/** API duration is seconds → e.g. "3h 40m 5s" (nbsp so it won't wrap mid-duration). */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  if (!total) return '—'
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || h > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join('\u00a0')
}

function parseOtherPhones(value) {
  if (Array.isArray(value)) {
    return value.map((p) => String(p).trim()).filter(Boolean)
  }
  return String(value || '')
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function mapSex(sex) {
  const s = String(sex || '').toLowerCase()
  if (s === 'm' || s === 'male') return 'male'
  if (s === 'f' || s === 'female') return 'female'
  return 'other'
}

function buildClientBody(client) {
  return {
    name: client.name,
    phone: client.phone,
    other_phones: parseOtherPhones(client.other_phones),
    sex: mapSex(client.sex),
    cycle: Number(client.cycle) || 0,
    cycle_length: client.cycle_length,
    adult: !!client.adult,
  }
}

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function apiError(res, data, fallbacks = {}) {
  if (res.status === 401) {
    return { ok: false, status: 401, error: data?.error || fallbacks[401] || 'Invalid code' }
  }
  if (res.status === 403) {
    return { ok: false, status: 403, error: data?.error || fallbacks[403] || 'Not allowed' }
  }
  if (res.status === 404) {
    return { ok: false, status: 404, error: data?.error || fallbacks[404] || 'Not found' }
  }
  if (res.status === 400) {
    return { ok: false, status: 400, error: data?.error || fallbacks[400] || 'Invalid request' }
  }
  if (res.status === 422) {
    const errors = data?.errors
    return {
      ok: false,
      status: 422,
      error: Array.isArray(errors) ? errors.join('. ') : data?.error || 'Validation failed',
      errors,
    }
  }
  return {
    ok: false,
    status: res.status,
    error: data?.error || `Request failed (${res.status})`,
  }
}

export function normalizeClient(apiClient) {
  const other = Array.isArray(apiClient.other_phones)
    ? apiClient.other_phones
    : parseOtherPhones(apiClient.other_phones)
  const name = apiClient.name || ''
  const phone = apiClient.phone || ''
  const cycle = Number(apiClient.cycle) || 0
  const cycleLength = apiClient.cycle_length ?? 4
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const phoneDigits = String(phone).replace(/\D/g, '')
  const initials =
    parts.length === 0
      ? (phoneDigits.slice(-2) || '—').toUpperCase()
      : parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()

  // Clients are keyed by phone — GET /pos/clients no longer returns `id`.
  return {
    name,
    phone,
    other_phones: other.join(', '),
    otherPhonesList: other,
    phoneDigits,
    initials,
    sex: apiClient.sex === 'female' ? 'F' : apiClient.sex === 'male' ? 'M' : 'Other',
    cycle,
    cycle_length: cycleLength,
    cycleCurrent: cycle,
    cycleTotal: cycleLength,
    adult: !!apiClient.adult,
    badge: apiClient.adult ? 'Adult' : 'Minor',
    created_by: apiClient.created_by,
    createdByCode: apiClient.created_by,
    createdByName: apiClient.created_by,
    totalSessions: apiClient.total_sessions ?? 0,
    completedSessions: apiClient.completed_sessions ?? apiClient.completed ?? 0,
    pendingSessions: apiClient.pending_sessions ?? 0,
    disputedSessions: apiClient.disputed_sessions ?? 0,
    ongoingSessions: apiClient.ongoing_sessions ?? 0,
    onCycleSessions: apiClient.on_cycle_sessions ?? null,
    offCycleSessions: apiClient.off_cycle_sessions ?? null,
    preferences: apiClient.client_preferences ?? apiClient.preferences ?? '',
    created_at: apiClient.created_at,
    updated_at: apiClient.updated_at,
  }
}

/** Stable client key (phone). */
export function clientKey(client) {
  if (!client) return ''
  const digits = String(client.phoneDigits || '').replace(/\D/g, '')
  if (digits) return digits
  return String(client.phone || '').replace(/\D/g, '') || String(client.phone || '')
}

export function normalizePaymentUrlEntry(entry) {
  if (entry == null || entry === '') return null
  if (typeof entry === 'string') {
    return { imgUrl: entry, delUrl: '', dateTime: '' }
  }
  if (typeof entry === 'object') {
    const imgUrl = String(entry.img_url || entry.imgUrl || entry.url || '').trim()
    if (!imgUrl) return null
    return {
      imgUrl,
      delUrl: String(entry.del_url || entry.delUrl || '').trim(),
      dateTime: entry.date_time || entry.dateTime || '',
    }
  }
  return null
}

export function normalizePaymentMethod(apiPm) {
  const paymentUrl = (Array.isArray(apiPm.payment_url) ? apiPm.payment_url : [])
    .map(normalizePaymentUrlEntry)
    .filter(Boolean)
  return {
    id: apiPm.id,
    sessionId: apiPm.session_id,
    source: String(apiPm.source || '').toLowerCase(),
    type: String(apiPm.type || '').toLowerCase(),
    amount: parseDecimal(apiPm.amount),
    status: String(apiPm.status || '').toLowerCase(),
    paymentUrl,
    receiptUploadedAt: apiPm.receipt_uploaded_at || paymentUrl[0]?.dateTime || null,
    createdAt: apiPm.created_at || '',
    updatedAt: apiPm.updated_at || '',
    raw: apiPm,
  }
}

/** First receipt image URL, if any. */
export function paymentReceiptImgUrl(pm) {
  const first = Array.isArray(pm?.paymentUrl) ? pm.paymentUrl[0] : null
  return first?.imgUrl || ''
}

function therapistLabel(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (typeof value === 'object') {
    return String(
      value.work_name || value.name || value.code || value.unique_code || value.st || '',
    ).trim()
  }
  return ''
}

export function normalizeSessionTherapist(row, extras = {}) {
  const therapist = row?.therapist && typeof row.therapist === 'object' ? row.therapist : null
  const name =
    therapistLabel(row?.name) ||
    therapistLabel(therapist) ||
    extras.name ||
    extras.code ||
    (row.therapist_id != null || row.id != null
      ? `Therapist #${row.therapist_id ?? row.id}`
      : '')
  return {
    id: row.id,
    sessionId: row.session_id,
    therapistId: row.therapist_id ?? therapist?.id,
    role: String(row.role || extras.role || '').toLowerCase() || 'lead',
    tipAmount: parseDecimal(row.tip_amount, null),
    tipBalance: parseDecimal(row.tip_balance, null),
    points: parseDecimal(row.points),
    feedback: row.feedback ?? null,
    code: extras.code || therapist?.code || therapist?.unique_code || '',
    name,
    raw: row,
  }
}

/** e.g. "Jasmine (Lead)" */
export function formatSessionTherapistLabel(st) {
  const name = st?.name ? String(st.name).trim() : ''
  if (!name) return ''
  const role = st?.role ? String(st.role).trim() : ''
  if (!role) return name
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
  return `${name} (${roleLabel})`
}

export function formatSessionTherapistsLabel(list) {
  if (!Array.isArray(list) || list.length === 0) return ''
  return list.map(formatSessionTherapistLabel).filter(Boolean).join(', ')
}

function normalizeTherapists(apiSession, extras = {}) {
  // Assigned therapists only — never fall back to session_creator.
  const sessionTherapists = Array.isArray(apiSession.session_therapists)
    ? apiSession.session_therapists.map((row) => normalizeSessionTherapist(row))
    : Array.isArray(extras.sessionTherapists)
      ? extras.sessionTherapists
      : []

  if (sessionTherapists.length > 0) {
    return {
      sessionTherapists,
      therapists: sessionTherapists.map(formatSessionTherapistLabel).filter(Boolean),
    }
  }

  const labels = []
  const rawList = apiSession.therapists || apiSession.therapist_names
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      const label = therapistLabel(item)
      if (label) labels.push(label)
    }
  } else if (rawList) {
    const single = therapistLabel(rawList)
    if (single) labels.push(single)
  } else if (apiSession.therapist) {
    const single = therapistLabel(apiSession.therapist)
    if (single) labels.push(single)
  }

  return {
    sessionTherapists,
    therapists: [...new Set(labels)],
  }
}

const SESSION_HISTORY_KEYS = [
  'pending',
  'started',
  'ended',
  'payment_verified',
  'completed',
  'disputed',
]

export function normalizeSessionHistory(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const history = {}
  for (const key of SESSION_HISTORY_KEYS) {
    history[key] = !!src[key]
  }
  history.tipped = parseDecimal(src.tipped, 0)
  // Keep any extra true flags from API (skip tipped — numeric)
  for (const [key, value] of Object.entries(src)) {
    if (key === 'tipped' || key in history) continue
    history[key] = !!value
  }
  return history
}

/** Labels for true session_history flags, in order. Tip shows when tipped > 0. */
export function sessionHistoryTrueLabels(history) {
  const h = history && typeof history === 'object' ? history : {}
  const labels = []
  for (const key of SESSION_HISTORY_KEYS) {
    if (!h[key]) continue
    labels.push(key === 'payment_verified' ? 'payment verified' : key)
  }
  const tip = Number(h.tipped)
  if (Number.isFinite(tip) && tip > 0) {
    labels.push(`tip ${tip.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
  }
  for (const [key, value] of Object.entries(h)) {
    if (SESSION_HISTORY_KEYS.includes(key) || key === 'tipped' || !value) continue
    labels.push(String(key).replace(/_/g, ' '))
  }
  return labels
}

export function normalizeComment(c) {
  return {
    name: String(c?.name || '').trim(),
    comment: String(c?.comment || '').trim(),
    date_time: c?.date_time || c?.dateTime || '',
    resolved: !!c?.resolved,
  }
}

export function normalizeClientSupport(raw) {
  if (!raw || typeof raw !== 'object') return null
  const description = String(raw.description || '').trim()
  if (!description && raw.amount == null && !raw.type && raw.id == null) return null
  const type = String(raw.type || '').trim().toLowerCase()
  return {
    id: raw.id ?? null,
    description,
    notes: String(raw.notes || '').trim(),
    amount: parseDecimal(raw.amount),
    type: type === 'payout' || type === 'payin' ? type : type || '',
    accountType: raw.account_type || '',
    settled: !!raw.settled,
    createdAt: raw.created_at || '',
  }
}

export function normalizeClientSupports(apiSession) {
  const list = Array.isArray(apiSession?.client_supports)
    ? apiSession.client_supports
    : apiSession?.client_support
      ? [apiSession.client_support]
      : []
  return list.map(normalizeClientSupport).filter(Boolean)
}

export function normalizeSession(apiSession, extras = {}) {
  const comments = Array.isArray(apiSession.comments)
    ? apiSession.comments.map(normalizeComment)
    : []
  const status = String(apiSession.status || 'pending').toLowerCase()
  const paymentMethods = Array.isArray(apiSession.payment_methods)
    ? apiSession.payment_methods.map(normalizePaymentMethod)
    : Array.isArray(extras.paymentMethods)
      ? extras.paymentMethods
      : []
  const nestedClient =
    apiSession.client && typeof apiSession.client === 'object' ? apiSession.client : null
  const nestedCreator =
    apiSession.session_creator && typeof apiSession.session_creator === 'object'
      ? apiSession.session_creator
      : null
  const cycleNum = apiSession.cycle
  const cycleLength = apiSession.cycle_length
  const { sessionTherapists, therapists } = normalizeTherapists(apiSession, extras)
  const sessionCreatorName = therapistLabel(nestedCreator) || ''
  const sessionHistory = normalizeSessionHistory(apiSession.session_history)
  const clientSupports = normalizeClientSupports(apiSession)
  const clientSupport = clientSupports[0] || null
  const disputes = Array.isArray(apiSession.disputes)
    ? apiSession.disputes.map(normalizeDispute).filter(Boolean)
    : []

  return {
    id: apiSession.id,
    clientId: apiSession.client_id ?? nestedClient?.id,
    clientName: nestedClient?.name || extras.clientName || apiSession.client_name || '',
    clientPhone: nestedClient?.phone || extras.clientPhone || apiSession.client_phone || '',
    dateTime: apiSession.session_date || apiSession.created_at || new Date().toISOString(),
    createdAt: apiSession.created_at || '',
    sessionType: (() => {
      const raw = String(apiSession.session_type || '').trim()
      if (!raw) return ''
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    })(),
    massageType: apiSession.massage_type || '',
    cycleNum,
    cycleLength,
    // Denominator is always 4 (not API cycle_length).
    cycle: `Cycle ${cycleNum ?? '—'} · ${cycleNum ?? '—'}/4`,
    amount: parseDecimal(apiSession.amount),
    settled: !!apiSession.settled,
    offCycle: !!apiSession.off_cycle,
    lunez: !!apiSession.lunez,
    lunezAmount: parseDecimal(apiSession.lunez_amount),
    hands: String(apiSession.hands ?? ''),
    clientSupport,
    clientSupports,
    disputes,
    sessionTherapists,
    therapists,
    therapistLabel: therapists.join(', '),
    comments,
    paymentMethods,
    status,
    sessionHistory,
    paymentVerified: !!sessionHistory.payment_verified,
    sessionCode: apiSession.session_code || '',
    startTime: toTimeOfDay(apiSession.start_time),
    endTime: toTimeOfDay(apiSession.end_time),
    duration: apiSession.duration ?? 0,
    sessionCreatorId: apiSession.session_creator_id ?? nestedCreator?.id,
    sessionCreatorName,
    staffCode: extras.staffCode || '',
    staffName: extras.staffName || '',
    source: extras.source || 'api',
    raw: apiSession,
  }
}

/**
 * POST /pos/clients
 * Does not accept client_preferences — use updatePosClientPreferences after create.
 */
export async function createPosClient({ code, client }) {
  const res = await fetch(url('/pos/clients'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      code: String(code || '').trim(),
      client: buildClientBody(client),
    }),
  })
  const data = await readJson(res)
  if (res.status === 201) return { ok: true, client: data }
  return apiError(res, data, { 404: 'Therapist not found' })
}

/**
 * GET /pos/clients?search=...
 */
export async function searchPosClients(search) {
  const q = String(search || '').trim()
  const path = q ? `/pos/clients?search=${encodeURIComponent(q)}` : '/pos/clients'
  const res = await fetch(url(path), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(res)
  if (res.status === 200) {
    return { ok: true, clients: (Array.isArray(data) ? data : []).map(normalizeClient) }
  }
  return { ...apiError(res, data), clients: [] }
}

/**
 * PATCH or PUT /pos/clients/preferences
 * Updates only client_preferences. No admin code required.
 */
export async function updatePosClientPreferences({ phone, client_preferences, method = 'PATCH' }) {
  const res = await fetch(url('/pos/clients/preferences'), {
    method: method === 'PUT' ? 'PUT' : 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      phone: String(phone || '').trim(),
      client_preferences: String(client_preferences ?? ''),
    }),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, client: data }
  return apiError(res, data, { 404: 'Client not found' })
}

/**
 * GET /pos/sessions
 * Optional `phone` — that client's sessions ordered by cycle. Unknown phone → 404.
 */
export async function listPosSessions({ phone } = {}) {
  const params = new URLSearchParams()
  if (phone) params.set('phone', String(phone).trim())
  const qs = params.toString()
  const res = await fetch(url(`/pos/sessions${qs ? `?${qs}` : ''}`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(res)
  if (res.status === 200) {
    return {
      ok: true,
      sessions: (Array.isArray(data) ? data : []).map((s) => normalizeSession(s)),
    }
  }
  return {
    ...apiError(res, data, { 404: 'Client not found for that phone' }),
    sessions: [],
  }
}

function buildClientSupportBody(client_support) {
  if (!client_support) return null
  const description = String(client_support.description || '').trim()
  if (!description) return null
  const amount = parseDecimal(client_support.amount, NaN)
  if (!Number.isFinite(amount)) return null
  const type = String(client_support.type || '').trim().toLowerCase()
  if (type !== 'payin' && type !== 'payout') return null
  const body = { description, amount, type }
  const notes = String(client_support.notes || '').trim()
  if (notes) body.notes = notes
  return body
}

/**
 * POST /pos/sessions
 * Do not send `status` — server defaults to pending.
 * When `lunez` is false, omit `lunez_amount` (DB default is 0).
 * When `lunez` is true, send `lunez_amount` (default 10000).
 * `off_cycle` defaults to false.
 * Optional top-level `client_support` `{ description, amount, type, notes? }` — omit if unused.
 */
export async function createPosSession({ st, client_phone, session, client_support }) {
  const lunez = !!session.lunez
  const sessionBody = {
    session_type: String(session.session_type || '').trim().toLowerCase(),
    massage_type: String(session.massage_type || '').trim(),
    amount: parseDecimal(session.amount),
    off_cycle: !!session.off_cycle,
    lunez,
    hands: String(session.hands ?? ''),
  }
  if (lunez) {
    const amt = parseDecimal(session.lunez_amount, 10000)
    sessionBody.lunez_amount = amt > 0 ? amt : 10000
  }
  const payload = {
    st: String(st || '').trim(),
    client_phone: String(client_phone || '').trim(),
    session: sessionBody,
  }
  const support = buildClientSupportBody(client_support)
  if (support) payload.client_support = support

  const res = await fetch(url('/pos/sessions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await readJson(res)
  if (res.status === 201) return { ok: true, session: data }
  return apiError(res, data, {
    404: 'Client or therapist not found',
    422: 'client_support requires description, amount, and type',
  })
}

/**
 * PATCH /pos/sessions/:ss/client_support
 * Without `client_support.id` → create a new support.
 * With `client_support.id` → update that support.
 */
export async function updatePosClientSupport({ sessionCode, ss, th, tc, code, client_support }) {
  const session_code = String(sessionCode || ss || '').trim()
  const key = encodeURIComponent(session_code)
  const support = buildClientSupportBody(client_support)
  if (!support) {
    return {
      ok: false,
      status: 422,
      error: 'client_support requires description, amount, and type',
    }
  }
  if (client_support?.id != null && client_support.id !== '') {
    support.id = client_support.id
  }
  const body = {
    ss: session_code,
    client_support: support,
  }
  if (th) body.th = String(th).trim()
  if (tc) body.tc = String(tc).trim()
  if (code) body.code = String(code).trim()

  const res = await fetch(url(`/pos/sessions/${key}/client_support`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, {
    401: 'Not authorized',
    403: 'Only the creating therapist can update client support',
    404: 'Session not found',
    422: data?.error || 'Client support is settled or invalid',
  })
}

/**
 * DELETE /pos/sessions/:ss/client_support
 * Pass `id` to delete a specific support; otherwise deletes the latest.
 * Auth: creator `th`, or admin `tc` / `code`.
 */
export async function deletePosClientSupport({ sessionCode, ss, th, tc, code, id }) {
  const session_code = String(sessionCode || ss || '').trim()
  const key = encodeURIComponent(session_code)
  const body = { ss: session_code }
  if (id != null && id !== '') body.id = id
  if (th) body.th = String(th).trim()
  if (tc) body.tc = String(tc).trim()
  if (code) body.code = String(code).trim()

  const res = await fetch(url(`/pos/sessions/${key}/client_support`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, {
    401: 'Not authorized',
    403: 'Only the creating therapist can delete client support',
    404: 'Session or client support not found',
    422: data?.error || 'Client support is settled',
  })
}

/**
 * PATCH /pos/sessions/:ss  (ss = session_code)
 * Optional top-level `client_support` creates or updates that session’s support.
 * Omit `client_support` to leave existing support unchanged.
 */
export async function updatePosSession({ sessionCode, ss, st, session, client_support }) {
  const key = encodeURIComponent(String(sessionCode || ss || '').trim())
  const { status: _omitStatus, ...sessionFields } = session || {}
  const body = {
    ss: String(sessionCode || ss || '').trim(),
    st: String(st || '').trim(),
    session: sessionFields,
  }
  if (client_support !== undefined) {
    const support = buildClientSupportBody(client_support)
    if (!support) {
      return {
        ok: false,
        status: 422,
        error: 'client_support requires description, amount, and type',
      }
    }
    body.client_support = support
  }
  const res = await fetch(url(`/pos/sessions/${key}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, {
    403: 'Only the creating therapist can update this session',
    404: 'Session not found',
    422: 'client_support requires description, amount, and type',
  })
}

/**
 * DELETE /pos/sessions/:ss  (session_code + admin code)
 * Path and body use `ss` (session_code), not numeric `id`.
 */
export async function deletePosSession({ sessionCode, ss: ssArg, code }) {
  const session_code = String(sessionCode || ssArg || '').trim()
  const ss = encodeURIComponent(session_code)
  const res = await fetch(url(`/pos/sessions/${ss}`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      ss: session_code,
      code: String(code || '').trim(),
    }),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, message: data?.message || 'Session deleted successfully' }
  return apiError(res, data, { 401: 'Invalid code', 404: 'Session not found' })
}

/**
 * PATCH or PUT /pos/sessions/:ss/comments
 * Replaces the session's comments array. Include existing comments to keep them.
 * `date_time` optional — API stores current time when omitted.
 * `resolved` optional — stored as false when omitted.
 */
export async function replacePosSessionComments({ sessionCode, comments, method = 'PATCH' }) {
  const ss = encodeURIComponent(String(sessionCode || '').trim())
  const list = (Array.isArray(comments) ? comments : []).map((c) => {
    const row = {
      name: String(c.name || '').trim(),
      comment: String(c.comment || '').trim(),
      resolved: !!c.resolved,
    }
    const dt = c.date_time || c.dateTime
    if (dt) row.date_time = dt
    return row
  })
  const res = await fetch(url(`/pos/sessions/${ss}/comments`), {
    method: method === 'PUT' ? 'PUT' : 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ comments: list }),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, { 404: 'Session not found' })
}

/**
 * PATCH or PUT /pos/sessions/:ss/comments/resolve
 * Mark one comment resolved/unresolved by 0-based index.
 */
export async function resolvePosSessionComment({
  sessionCode,
  index,
  resolved,
  method = 'PATCH',
}) {
  const ss = encodeURIComponent(String(sessionCode || '').trim())
  const res = await fetch(url(`/pos/sessions/${ss}/comments/resolve`), {
    method: method === 'PUT' ? 'PUT' : 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      index: Number(index),
      resolved: !!resolved,
    }),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, { 404: 'Session or comment not found' })
}

/**
 * PATCH /pos/sessions/:ss/status
 * `completed` / `disputed` require admin `tc` only (th/code → 401).
 * Other statuses: admin `tc` or session creator `th`.
 * `disputed` sets session_history.completed false and sticky disputed true;
 * `completed` sets session_history.completed true.
 * `completed` is rejected while the session has an unresolved dispute.
 */
export async function setPosSessionStatus({ sessionCode, th, tc, status }) {
  const ss = encodeURIComponent(String(sessionCode || '').trim())
  const normalized = String(status || '').trim().toLowerCase()
  const body = { status: normalized }
  const adminOnly = normalized === 'completed' || normalized === 'disputed'
  if (tc) body.tc = String(tc).trim()
  else if (!adminOnly && th) body.th = String(th).trim()

  const res = await fetch(url(`/pos/sessions/${ss}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, {
    401: 'Not authorized — completed and disputed require admin code',
    403: 'Only the creating therapist or admin can set status',
    404: 'Therapist or session not found',
    422: 'Cannot complete a session while a dispute is unresolved',
  })
}

/**
 * PATCH or PUT /pos/sessions/:ss/verify_payment
 * Auth: admin `tc` (or `code` as admin), or creator `th` (or `code` as creator).
 */
export async function verifyPosSessionPayment({ sessionCode, tc, th, code, method = 'PATCH' }) {
  const ss = encodeURIComponent(String(sessionCode || '').trim())
  const body = {}
  if (tc) body.tc = String(tc).trim()
  else if (th) body.th = String(th).trim()
  else if (code) body.code = String(code).trim()

  const res = await fetch(url(`/pos/sessions/${ss}/verify_payment`), {
    method: method === 'PUT' ? 'PUT' : 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, {
    401: 'Not authorized',
    404: 'Session not found',
  })
}

/**
 * PATCH or PUT /pos/sessions/:ss/times
 * Times are top-level `HH:MM:SS`. Start alone → status started.
 * Both times → status ended + duration (seconds).
 */
export async function setPosSessionTimes({ sessionCode, start_time, end_time, method = 'PATCH' }) {
  const ss = encodeURIComponent(String(sessionCode || '').trim())
  const body = {}
  const start = toTimeOfDay(start_time)
  const end = toTimeOfDay(end_time)
  if (start) body.start_time = start
  if (end) body.end_time = end

  const res = await fetch(url(`/pos/sessions/${ss}/times`), {
    method: method === 'PUT' ? 'PUT' : 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, session: data }
  return apiError(res, data, { 404: 'Session not found' })
}

/** Auth for payment_methods: admin `tc`, creator `th`, or either as `code`. */
function appendPaymentAuth(target, { tc, th, code } = {}) {
  if (tc) target.append ? target.append('tc', String(tc).trim()) : (target.tc = String(tc).trim())
  else if (th) target.append ? target.append('th', String(th).trim()) : (target.th = String(th).trim())
  else if (code) {
    const c = String(code).trim()
    if (target.append) target.append('code', c)
    else target.code = c
  }
}

/**
 * POST /pos/payment_methods  (multipart form data)
 * Auth: `tc`/`code` (admin) or `th`/`code` (session creator).
 * Optional `receipt` file → ImgBB; response includes payment_url[].
 * Do not set Content-Type — browser sets multipart boundary.
 */
export async function createPosPaymentMethod({
  session_code,
  payment_method,
  receipt,
  tc,
  th,
  code,
}) {
  const body = new FormData()
  body.append('session_code', String(session_code || '').trim())
  body.append(
    'payment_method[source]',
    String(payment_method.source || '').trim().toLowerCase(),
  )
  body.append(
    'payment_method[type]',
    String(payment_method.type || '').trim().toLowerCase(),
  )
  body.append('payment_method[amount]', String(parseDecimal(payment_method.amount)))
  body.append(
    'payment_method[status]',
    String(payment_method.status || 'pending').trim().toLowerCase() || 'pending',
  )
  appendPaymentAuth(body, { tc, th, code })
  if (receipt) body.append('receipt', receipt)

  const res = await fetch(url('/pos/payment_methods'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
  })
  const data = await readJson(res)
  if (res.status === 201) return { ok: true, paymentMethod: data }
  return apiError(res, data, {
    400: 'payment_method is required',
    401: 'Not authorized',
    404: 'Session not found',
  })
}

/**
 * PATCH /pos/payment_methods/:id  (multipart form data)
 * Auth: `tc`/`code` (admin) or `th`/`code` (session creator).
 * Optional `receipt` file → ImgBB.
 */
export async function updatePosPaymentMethod({ id, payment_method, receipt, tc, th, code }) {
  const body = new FormData()
  if (payment_method.source != null) {
    body.append(
      'payment_method[source]',
      String(payment_method.source).trim().toLowerCase(),
    )
  }
  if (payment_method.type != null) {
    body.append(
      'payment_method[type]',
      String(payment_method.type).trim().toLowerCase(),
    )
  }
  if (payment_method.amount != null && payment_method.amount !== '') {
    body.append('payment_method[amount]', String(parseDecimal(payment_method.amount)))
  }
  if (payment_method.status != null) {
    body.append(
      'payment_method[status]',
      String(payment_method.status).trim().toLowerCase(),
    )
  }
  appendPaymentAuth(body, { tc, th, code })
  if (receipt) body.append('receipt', receipt)

  const res = await fetch(url(`/pos/payment_methods/${id}`), {
    method: 'PATCH',
    headers: { Accept: 'application/json' },
    body,
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, paymentMethod: data }
  return apiError(res, data, {
    401: 'Not authorized',
    404: 'Payment method not found',
  })
}

/**
 * DELETE /pos/payment_methods/:id
 * Creator (`th`/`code`): soft-delete (deleted_at). Admin (`tc`/`code`): hard-delete + del_url(s).
 */
export async function deletePosPaymentMethod({ id, tc, th, code }) {
  const body = {}
  appendPaymentAuth(body, { tc, th, code })

  const res = await fetch(url(`/pos/payment_methods/${id}`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) {
    const delUrls = Array.isArray(data?.del_urls)
      ? data.del_urls.filter(Boolean)
      : data?.del_url
        ? [data.del_url]
        : []
    return {
      ok: true,
      message: data?.message || 'Payment method deleted successfully',
      delUrl: data?.del_url || delUrls[0] || '',
      delUrls,
    }
  }
  return apiError(res, data, {
    401: 'Not authorized',
    404: 'Payment method not found',
  })
}

export function normalizeTherapist(apiTherapist) {
  return {
    id: apiTherapist.id,
    workName: apiTherapist.work_name || apiTherapist.name || '',
    code: apiTherapist.code || '',
    active: apiTherapist.active !== false,
    avatar: apiTherapist.avatar ?? null,
    url: apiTherapist.url ?? null,
    raw: apiTherapist,
  }
}

/**
 * GET /pos/therapists
 * Optional: active=true|false
 */
export async function listPosTherapists({ active } = {}) {
  const params = new URLSearchParams()
  if (active === true || active === false) params.set('active', String(active))
  const qs = params.toString()
  const res = await fetch(url(`/pos/therapists${qs ? `?${qs}` : ''}`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(res)
  if (res.status === 200) {
    return {
      ok: true,
      therapists: (Array.isArray(data) ? data : []).map(normalizeTherapist),
    }
  }
  return { ...apiError(res, data), therapists: [] }
}

/**
 * GET /pos/therapists/:code
 */
export async function getPosTherapist(code) {
  const c = encodeURIComponent(String(code || '').trim())
  const res = await fetch(url(`/pos/therapists/${c}`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(res)
  if (res.status === 200) return { ok: true, therapist: normalizeTherapist(data) }
  return apiError(res, data, { 404: 'Therapist not found' })
}

/**
 * POST /pos/session_therapists
 * `name` = therapist work_name, `ss` = session code.
 * Auth: admin `tc`, or session creator `th`.
 */
export async function addPosSessionTherapist({ tc, th, ss, name, role = 'lead' }) {
  const body = {
    ss: String(ss || '').trim(),
    name: String(name || '').trim(),
    session_therapist: {
      role: String(role || 'lead').trim().toLowerCase(),
    },
  }
  if (tc) body.tc = String(tc).trim()
  else if (th) body.th = String(th).trim()

  const res = await fetch(url('/pos/session_therapists'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 201) return { ok: true, sessionTherapist: data }
  return apiError(res, data, {
    401: 'Not authorized',
    404: 'Session not found',
  })
}

/**
 * DELETE /pos/session_therapists
 * `name` = therapist work_name. Auth: admin `tc` or session creator `th`.
 * 422 if that therapist already has a tip amount.
 */
export async function removePosSessionTherapist({ ss, name, tc, th }) {
  const body = {
    ss: String(ss || '').trim(),
    name: String(name || '').trim(),
  }
  if (tc) body.tc = String(tc).trim()
  else if (th) body.th = String(th).trim()

  const res = await fetch(url('/pos/session_therapists'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) {
    return { ok: true, message: data?.message || 'Session therapist deleted successfully' }
  }
  return apiError(res, data, {
    401: 'Not authorized',
    404: 'Session or therapist not found',
    422: data?.error || 'Session therapist has tip amount',
  })
}

/**
 * POST /pos/session_therapists/tip
 * One call per therapist. Admin auth: `tc` or `admin_code`.
 * Response includes tip split fields; UI only needs name, tip_amount, tip_balance.
 */
export async function tipPosSessionTherapist({ ss, name, tip_amount, tc, admin_code }) {
  const body = {
    ss: String(ss || '').trim(),
    name: String(name || '').trim(),
    tip_amount: parseDecimal(tip_amount),
  }
  if (tc) body.tc = String(tc).trim()
  else if (admin_code) body.admin_code = String(admin_code).trim()

  const res = await fetch(url('/pos/session_therapists/tip'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 200) {
    return {
      ok: true,
      tip: {
        name: data?.name || name,
        tipAmount: parseDecimal(data?.tip_amount, null),
        tipBalance: parseDecimal(data?.tip_balance, null),
      },
    }
  }
  return apiError(res, data, {
    400: data?.error || 'Invalid tip request',
    401: 'Invalid admin code',
    404: 'Session or therapist not found',
  })
}

/**
 * POST /pos/admin_notes
 * `st` = writer therapist code. At least one of `phone`, `ss`, or `th`.
 */
export async function createPosAdminNote({ st, phone, ss, th, admin_note }) {
  const body = {
    st: String(st || '').trim(),
    admin_note: {
      body: String(admin_note?.body || '').trim(),
      status: String(admin_note?.status || 'open').trim().toLowerCase() || 'open',
    },
  }
  if (phone) body.phone = String(phone).trim()
  if (ss) body.ss = String(ss).trim()
  if (th) body.th = String(th).trim()

  const res = await fetch(url('/pos/admin_notes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res)
  if (res.status === 201) return { ok: true, adminNote: data }
  return apiError(res, data, {
    404: 'Client, session, or therapist not found',
    422: 'Send at least one of phone, ss, or th',
  })
}

export function normalizeDispute(raw) {
  if (!raw || typeof raw !== 'object') return null
  const resolution = raw.resolution && typeof raw.resolution === 'object' ? raw.resolution : {}
  const thread = Array.isArray(raw.thread)
    ? raw.thread.map((entry) => ({
      name: String(entry?.name || '').trim(),
      text: String(entry?.text || '').trim(),
      datetime: entry?.datetime || entry?.date_time || '',
      imageUrl: String(entry?.image_url || '').trim(),
    }))
    : []
  return {
    id: raw.id,
    description: String(raw.description || '').trim(),
    resolved: !!raw.resolved,
    resolution: {
      text: String(resolution.text || '').trim(),
      imageUrls: Array.isArray(resolution.image_urls) ? resolution.image_urls.filter(Boolean) : [],
    },
    thread,
    assignedStaff: Array.isArray(raw.assigned_staff) ? raw.assigned_staff : [],
    sessionCode: raw.session_code || '',
    clientName: raw.client_name || '',
    createdAt: raw.created_at || '',
  }
}

async function sendDispute(path, { method, json, form }) {
  const res = await fetch(url(path), {
    method,
    headers: form
      ? { Accept: 'application/json' }
      : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: form || JSON.stringify(json),
  })
  const data = await readJson(res)
  if (res.status === 200 || res.status === 201) return { ok: true, dispute: normalizeDispute(data) }
  return apiError(res, data)
}

export function createPosDispute({ code, ss, description, assignedStaff = [] }) {
  return sendDispute('/pos/disputes', {
    method: 'POST',
    json: {
      code: String(code || '').trim(),
      ss: String(ss || '').trim(),
      description: String(description || '').trim(),
      assigned_staff: assignedStaff,
    },
  })
}

export function updatePosDispute({ id, code, description }) {
  return sendDispute(`/pos/disputes/${id}`, {
    method: 'PATCH',
    json: {
      code: String(code || '').trim(),
      description: String(description || '').trim(),
    },
  })
}

export function resolvePosDispute({ id, code, text, imageUrls = [], images = [] }) {
  if (images.length) {
    const form = new FormData()
    form.append('code', String(code || '').trim())
    form.append('resolution[text]', String(text || ''))
    imageUrls.forEach((url) => form.append('resolution[image_urls][]', url))
    images.forEach((file) => form.append('images[]', file))
    return sendDispute(`/pos/disputes/${id}/resolve`, { method: 'PATCH', form })
  }
  return sendDispute(`/pos/disputes/${id}/resolve`, {
    method: 'PATCH',
    json: {
      code: String(code || '').trim(),
      resolution: { text: String(text || ''), image_urls: imageUrls },
    },
  })
}

export function addPosDisputeThread({ id, th, name, text, image }) {
  if (image) {
    const form = new FormData()
    form.append('th', String(th || '').trim())
    form.append('thread[name]', String(name || '').trim())
    form.append('thread[text]', String(text || '').trim())
    form.append('image', image)
    return sendDispute(`/pos/disputes/${id}/thread`, { method: 'POST', form })
  }
  return sendDispute(`/pos/disputes/${id}/thread`, {
    method: 'POST',
    json: {
      th: String(th || '').trim(),
      thread: { name: String(name || '').trim(), text: String(text || '').trim() },
    },
  })
}

export function updatePosDisputeThread({ id, index, code, text }) {
  return sendDispute(`/pos/disputes/${id}/thread/${index}`, {
    method: 'PATCH',
    json: {
      code: String(code || '').trim(),
      thread: { text: String(text || '').trim() },
    },
  })
}

export function deletePosDisputeThread({ id, index, code }) {
  return sendDispute(`/pos/disputes/${id}/thread/${index}`, {
    method: 'DELETE',
    json: { code: String(code || '').trim() },
  })
}

export { parseOtherPhones, mapSex, API_BASE }
