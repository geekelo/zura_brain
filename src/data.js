/** Demo clients & bookings for Front Desk (frontend only). */

export const therapists = ['Sara', 'Amina', 'Noor', 'Fatima', 'Zain']
export const sessionTypes = ['Massage', 'Facial', 'Body Scrub', 'Hot Stone', 'Aromatherapy']
export const handsOptions = ['1', '2', '4']

/** Front desk staff unique codes — used to attribute saves to a person */
export const staffDirectory = [
  { code: 'FD-1001', name: 'Hina' },
  { code: 'FD-1002', name: 'Bilal' },
  { code: 'FD-1003', name: 'Sana' },
  { code: 'FD-1004', name: 'Usman' },
]

export const clients = [
  {
    id: 'c1',
    name: 'Imran Khan',
    phone: '+92 348 0123 784',
    phoneDigits: '923480123784',
    initials: 'IK',
    badge: 'Regular Client',
    sex: 'M',
    cycleCurrent: 2,
    cycleTotal: 4,
    totalSessions: 6,
    completed: 4,
    upcoming: 2,
  },
  {
    id: 'c2',
    name: 'Ayesha Malik',
    phone: '+92 300 555 2211',
    phoneDigits: '923005552211',
    initials: 'AM',
    badge: 'VIP',
    sex: 'F',
    cycleCurrent: 3,
    cycleTotal: 4,
    totalSessions: 11,
    completed: 9,
    upcoming: 2,
  },
  {
    id: 'c3',
    name: 'Omar Farooq',
    phone: '+92 321 777 8899',
    phoneDigits: '923217778899',
    initials: 'OF',
    badge: 'New Client',
    sex: 'M',
    cycleCurrent: 0,
    cycleTotal: 4,
    totalSessions: 0,
    completed: 0,
    upcoming: 1,
  },
]

/** Unused / booked sessions keyed by client id */
export const bookedByClient = {
  c1: [
    {
      id: 'b1',
      date: '2026-10-08',
      sessionType: 'Massage',
      cycle: '3 / 4',
      amount: 4500,
      status: 'Booked',
      therapists: ['Sara'],
      hands: '2',
      sex: 'M',
      bonus: 0,
      lunez: 0,
    },
    {
      id: 'b2',
      date: '2026-10-12',
      sessionType: 'Facial',
      cycle: '4 / 4',
      amount: 3200,
      status: 'Booked',
      therapists: ['Amina'],
      hands: '1',
      sex: 'M',
      bonus: 0,
      lunez: 0,
    },
  ],
  c2: [
    {
      id: 'b3',
      date: '2026-10-07',
      sessionType: 'Hot Stone',
      cycle: '4 / 4',
      amount: 5500,
      status: 'Booked',
      therapists: ['Noor', 'Fatima'],
      hands: '4',
      sex: 'F',
      bonus: 200,
      lunez: 1,
    },
  ],
  c3: [
    {
      id: 'b4',
      date: '2026-10-09',
      sessionType: 'Massage',
      cycle: '1 / 4',
      amount: 4000,
      status: 'Booked',
      therapists: ['Zain'],
      hands: '2',
      sex: 'M',
      bonus: 0,
      lunez: 0,
    },
  ],
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
}

function daysAgo(d, hour = 11) {
  const date = new Date()
  date.setDate(date.getDate() - d)
  date.setHours(hour, 30, 0, 0)
  return date.toISOString()
}

/** Seed saved sessions (some older than 36h to demo edit lock) */
export const initialSavedSessions = [
  {
    id: 's1',
    clientId: 'c1',
    clientName: 'Imran Khan',
    dateTime: hoursAgo(2),
    sessionType: 'Massage',
    cycle: '2 / 4',
    amount: 4500,
    settled: true,
    bonus: 0,
    lunez: 0,
    therapists: ['Sara'],
    hands: '2',
    sex: 'M',
    comments: '',
    status: 'Pending',
    source: 'new',
    staffCode: 'FD-1001',
    staffName: 'Hina',
  },
  {
    id: 's2',
    clientId: 'c2',
    clientName: 'Ayesha Malik',
    dateTime: hoursAgo(5),
    sessionType: 'Facial',
    cycle: '3 / 4',
    amount: 3200,
    settled: false,
    bonus: 100,
    lunez: 0,
    therapists: ['Amina'],
    hands: '1',
    sex: 'F',
    comments: '',
    status: 'Pending',
    source: 'new',
    staffCode: 'FD-1002',
    staffName: 'Bilal',
  },
  {
    id: 's3',
    clientId: 'c1',
    clientName: 'Imran Khan',
    dateTime: daysAgo(1, 14),
    sessionType: 'Body Scrub',
    cycle: '1 / 4',
    amount: 3800,
    settled: true,
    bonus: 0,
    lunez: 1,
    therapists: ['Noor'],
    hands: '2',
    sex: 'M',
    comments: '',
    status: 'Completed',
    source: 'new',
    staffCode: 'FD-1001',
    staffName: 'Hina',
  },
  {
    id: 's4',
    clientId: 'c2',
    clientName: 'Ayesha Malik',
    dateTime: daysAgo(2, 10),
    sessionType: 'Aromatherapy',
    cycle: '2 / 4',
    amount: 5000,
    settled: true,
    bonus: 0,
    lunez: 0,
    therapists: ['Fatima', 'Sara'],
    hands: '4',
    sex: 'F',
    comments: '',
    status: 'Completed',
    source: 'booked',
    staffCode: 'FD-1003',
    staffName: 'Sana',
  },
]
