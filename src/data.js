/** Demo clients & bookings for Front Desk (frontend only). */

export const therapists = ['Sara', 'Amina', 'Noor', 'Fatima', 'Zain']
export const sessionTypes = ['Single', 'Couple', 'Bulk']
export const DEFAULT_MASSAGE_TYPE = 'Zura Massage'
export const massageTypes = [
  DEFAULT_MASSAGE_TYPE,
  'Lunez male',
  'Lunez female',
  'Localized',
  'Zura kids',
  'Zura prenatal',
  'Zura postnatal',
]

/** WhatsApp follow-up templates. `{honorific}` → Sir / Madam. */
export const whatsappTemplates = [
  {
    id: 'visit-tip',
    label: 'Appreciate visit + tip ask',
    description: 'Thank them for coming and invite a tip',
    body: `Hello {honorific}

Thank you for your visit to the Spa today.
We trust you enjoyed the Zura session.

Please feel free to book a Zura session. We'd be happy to give you that relaxation you deserve.

Would you care to be generous to the therapists who took your session today {honorific} ? If yes
3003446219
KUDA BANK
DELIGHT OLGA

🌿 ZURA SPA`,
  },
  {
    id: 'tip-thanks',
    label: 'Appreciate for tipping',
    description: 'Thank them after they tipped',
    body: `Thank you {honorific}, for appreciating the therapists who handled your session. They are truly grateful for your generosity.

We would also like to reassure you that at Zura Spa, we are committed to delivering the highest standard of service to every client, regardless of whether a tip is given or not. While tips are sincerely appreciated, they do not influence the quality of care or professionalism you receive. You can always be assured of our best service on every visit.

Thank you once again for your continued patronage and support.

~ZURA SPA`,
  },
  {
    id: 'visit',
    label: 'Appreciate visit',
    description: 'Thank them for coming — no tip ask',
    body: `Hello {honorific}

Thank you for your visit to the Spa today.
We trust you enjoyed the Zura session.

Please feel free to book a Zura session. We'd be happy to give you that relaxation you deserve.


🌿 ZURA SPA`,
  },
]

/** e.g. single → Single */
export function toSentenceCase(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
export const handsOptions = ['2', '4', '6']
export const DEFAULT_AMOUNT = 35000
export const amountOptions = [65000, 35000, 30000, 25000, 15000]
export const clientSupportDescriptions = ['car wash', 'purchase']
export const DEFAULT_CLIENT_SUPPORT_AMOUNT = 500
export const clientSupportTypes = [
  { value: 'payin', label: 'Pay in' },
  { value: 'payout', label: 'Pay out' },
]
export const DEFAULT_CLIENT_SUPPORT_TYPE = 'payout'
export const DEFAULT_LUNEZ_AMOUNT = 0
export const DEFAULT_LUNEZ_AMOUNT_YES = 10000
export const lunezAmountOptions = [10000, 20000, 30000, 40000, 50000, 60000]

/** Map API decimal amounts (e.g. "35000.0") onto a dropdown option value. */
export function amountSelectValue(value, fallback = DEFAULT_AMOUNT) {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(fallback)
  const match = amountOptions.find((a) => a === n)
  return String(match ?? n)
}

export function lunezAmountSelectValue(value, fallback = DEFAULT_LUNEZ_AMOUNT_YES) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return String(fallback)
  const match = lunezAmountOptions.find((a) => a === n)
  return String(match ?? n)
}
export const paymentSources = [
  'pos',
  'kuda',
  'delight olga',
  'cash',
  'moniepoint',
  'other',
]
export const paymentTypes = ['massage', 'lunez', 'tip', 'other']
/** API value → display label */
export const paymentStatuses = [
  { value: 'pending', label: 'Unconfirmed' },
  { value: 'ok', label: 'Confirmed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'nonrefunded', label: 'Not-refunded' },
]

export function paymentStatusLabel(status) {
  const key = String(status || '').toLowerCase()
  const found = paymentStatuses.find((s) => s.value === key)
  return found?.label || status || ''
}
export const sessionTherapistRoles = ['lead', 'assist', 'support', 'frontdesk']

/** Front desk staff unique codes — used to attribute saves to a person */
export const staffDirectory = [
  { code: 'FD-1001', name: 'Hina' },
  { code: 'FD-1002', name: 'Bilal' },
  { code: 'FD-1003', name: 'Sana' },
  { code: 'FD-1004', name: 'Usman' },
]

export const clients = [
  {
    name: 'Imran Khan',
    phone: '+92 348 0123 784',
    other_phones: '+92 300 111 2222',
    phoneDigits: '923480123784',
    initials: 'IK',
    badge: 'Adult',
    sex: 'M',
    cycle: 2,
    cycle_length: 4,
    cycleCurrent: 2,
    cycleTotal: 4,
    adult: true,
    created_by: 'FD-1001',
    totalSessions: 6,
    completedSessions: 3,
    pendingSessions: 1,
    disputedSessions: 1,
    ongoingSessions: 1,
  },
  {
    name: 'Ayesha Malik',
    phone: '+92 300 555 2211',
    other_phones: '',
    phoneDigits: '923005552211',
    initials: 'AM',
    badge: 'Adult',
    sex: 'F',
    cycle: 3,
    cycle_length: 4,
    cycleCurrent: 3,
    cycleTotal: 4,
    adult: true,
    created_by: 'FD-1002',
    totalSessions: 12,
    completedSessions: 10,
    pendingSessions: 1,
    disputedSessions: 0,
    ongoingSessions: 1,
  },
  {
    name: 'Omar Farooq',
    phone: '+92 321 777 8899',
    other_phones: '+92 321 111 0000',
    phoneDigits: '923217778899',
    initials: 'OF',
    badge: 'Adult',
    sex: 'M',
    cycle: 0,
    cycle_length: 4,
    cycleCurrent: 0,
    cycleTotal: 4,
    adult: true,
    created_by: 'FD-1003',
    totalSessions: 2,
    completedSessions: 1,
    pendingSessions: 1,
    disputedSessions: 0,
    ongoingSessions: 0,
  },
]

export const bookedByClient = {
  '923480123784': [
    {
      id: 'b1',
      sessionType: 'Massage',
      cycle: '3 / 4',
      amount: 4500,
      status: 'booked',
      therapists: ['Sara'],
      hands: '2',
      lunez: 0,
      dateTime: new Date().toISOString(),
    },
    {
      id: 'b2',
      sessionType: 'Facial',
      cycle: '4 / 4',
      amount: 3200,
      status: 'booked',
      therapists: ['Amina'],
      hands: '1',
      lunez: 0,
      dateTime: new Date().toISOString(),
    },
  ],
  '923005552211': [
    {
      id: 'b3',
      sessionType: 'Hot Stone',
      cycle: '4 / 4',
      amount: 5500,
      status: 'booked',
      therapists: ['Noor', 'Fatima'],
      hands: '4',
      lunez: 1,
      dateTime: new Date().toISOString(),
    },
  ],
  '923217778899': [
    {
      id: 'b4',
      sessionType: 'Massage',
      cycle: '1 / 4',
      amount: 4000,
      status: 'booked',
      therapists: ['Zain'],
      hands: '2',
      lunez: 0,
      dateTime: new Date().toISOString(),
    },
  ],
}

/** Seed saved sessions (some older than 36h to demo edit lock) */
export const seedSavedSessions = [
  {
    id: 's1',
    clientId: 'c1',
    clientName: 'Imran Khan',
    clientPhone: '+92 348 0123 784',
    dateTime: new Date().toISOString(),
    sessionType: 'Massage',
    cycle: '2 / 4',
    amount: 4500,
    settled: true,
    lunez: 0,
    therapists: ['Sara'],
    hands: '2',
    comments: [],
    status: 'completed',
    source: 'demo',
    sessionCode: '',
    staffCode: 'FD-1001',
    staffName: 'Hina',
  },
  {
    id: 's2',
    clientId: 'c2',
    clientName: 'Ayesha Malik',
    clientPhone: '+92 300 555 2211',
    dateTime: new Date(Date.now() - 86400000).toISOString(),
    sessionType: 'Facial',
    cycle: '3 / 4',
    amount: 3200,
    settled: false,
    lunez: 0,
    therapists: ['Amina'],
    hands: '1',
    comments: [],
    status: 'pending',
    source: 'demo',
    sessionCode: '',
    staffCode: 'FD-1002',
    staffName: 'Bilal',
  },
  {
    id: 's3',
    clientId: 'c1',
    clientName: 'Imran Khan',
    clientPhone: '+92 348 0123 784',
    dateTime: new Date(Date.now() - 2 * 86400000).toISOString(),
    sessionType: 'Body Scrub',
    cycle: '1 / 4',
    amount: 3800,
    settled: true,
    lunez: 1,
    therapists: ['Noor'],
    hands: '2',
    comments: [],
    status: 'completed',
    source: 'demo',
    sessionCode: '',
    staffCode: 'FD-1001',
    staffName: 'Hina',
  },
  {
    id: 's4',
    clientId: 'c3',
    clientName: 'Omar Farooq',
    clientPhone: '+92 321 777 8899',
    dateTime: new Date(Date.now() - 3 * 86400000).toISOString(),
    sessionType: 'Aromatherapy',
    cycle: '2 / 4',
    amount: 5000,
    settled: false,
    lunez: 0,
    therapists: ['Fatima', 'Sara'],
    hands: '4',
    comments: [],
    status: 'pending',
    source: 'demo',
    sessionCode: '',
    staffCode: 'FD-1003',
    staffName: 'Sana',
  },
]
