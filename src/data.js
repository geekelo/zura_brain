export const accounts = [
  {
    id: 'emily',
    name: 'Emily Chen',
    email: 'emily@studio.co',
    avatar: 'https://i.pravatar.cc/80?img=47',
    active: true,
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    email: 'alex@studio.co',
    avatar: 'https://i.pravatar.cc/80?img=12',
    active: false,
  },
]

export const projects = [
  {
    id: 'brand-refresh',
    name: 'Brand Refresh',
    notes: 24,
    tasks: 18,
    color: 'yellow',
    updated: 'Updated 2h ago',
    members: [
      { type: 'img', src: 'https://i.pravatar.cc/40?img=47' },
      { type: 'img', src: 'https://i.pravatar.cc/40?img=12' },
      { type: 'initials', text: 'AR', bg: '#c4b5fd', color: '#5b21b6' },
    ],
  },
  {
    id: 'client-work',
    name: 'Client Work',
    notes: 12,
    tasks: 9,
    color: 'purple',
    updated: 'Updated yesterday',
    members: [
      { type: 'img', src: 'https://i.pravatar.cc/40?img=32' },
      { type: 'initials', text: 'JM', bg: '#fde68a', color: '#92400e' },
    ],
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar',
    notes: 31,
    tasks: 14,
    color: 'blue',
    updated: 'Updated 3d ago',
    members: [
      { type: 'img', src: 'https://i.pravatar.cc/40?img=47' },
      { type: 'img', src: 'https://i.pravatar.cc/40?img=5' },
      { type: 'initials', text: 'EC', bg: '#93c5fd', color: '#1e40af' },
    ],
  },
  {
    id: 'personal-goals',
    name: 'Personal Goals',
    notes: 8,
    tasks: 5,
    color: 'green',
    updated: 'Updated 1w ago',
    members: [{ type: 'img', src: 'https://i.pravatar.cc/40?img=47' }],
  },
  {
    id: 'event-plan',
    name: 'Event Plan',
    notes: 16,
    tasks: 11,
    color: 'red',
    updated: 'Updated 4h ago',
    members: [
      { type: 'img', src: 'https://i.pravatar.cc/40?img=12' },
      { type: 'initials', text: 'AK', bg: '#fca5a5', color: '#991b1b' },
      { type: 'img', src: 'https://i.pravatar.cc/40?img=20' },
    ],
  },
  {
    id: 'product-roadmap',
    name: 'Product Roadmap',
    notes: 22,
    tasks: 27,
    color: 'teal',
    updated: 'Updated 5d ago',
    members: [
      { type: 'img', src: 'https://i.pravatar.cc/40?img=12' },
      { type: 'img', src: 'https://i.pravatar.cc/40?img=47' },
      { type: 'initials', text: 'SR', bg: '#99f6e4', color: '#115e59' },
    ],
  },
]

export const reminderTabs = [
  { id: 'today', label: 'Today', count: 5, color: 'yellow' },
  { id: 'upcoming', label: 'Upcoming', count: 7, color: 'purple' },
  { id: 'overdue', label: 'Overdue', count: 2, color: 'red' },
  { id: 'completed', label: 'Completed', count: 18, color: 'green' },
]

export const reminderGroups = [
  {
    id: 'today',
    title: 'Today',
    date: 'May 10',
    count: 5,
    items: [
      {
        id: 1,
        title: 'Client follow-up',
        time: 'Today, 10:00 AM',
        tag: 'Client Work',
        tagColor: 'purple',
        accent: 'yellow',
        overdue: false,
        assignees: [
          { type: 'img', src: 'https://i.pravatar.cc/40?img=12' },
          { type: 'img', src: 'https://i.pravatar.cc/40?img=47' },
          { type: 'more', text: '+1' },
        ],
      },
      {
        id: 2,
        title: 'Review homepage mockup',
        time: 'Today, 2:00 PM',
        tag: 'Content Calendar',
        tagColor: 'blue',
        accent: 'blue',
        overdue: false,
        assignees: [{ type: 'initials', text: 'EC', bg: '#93c5fd', color: '#1e40af' }],
      },
    ],
  },
  {
    id: 'tomorrow',
    title: 'Tomorrow',
    date: 'May 11',
    count: 1,
    items: [
      {
        id: 3,
        title: 'Schedule launch meeting',
        time: 'Tomorrow, 11:00 AM',
        tag: 'Event Plan',
        tagColor: 'green',
        accent: 'green',
        overdue: false,
        assignees: [
          { type: 'initials', text: 'AR', bg: '#c4b5fd', color: '#5b21b6' },
          { type: 'initials', text: 'JM', bg: '#fde68a', color: '#92400e' },
          { type: 'more', text: '+1' },
        ],
      },
    ],
  },
  {
    id: 'week',
    title: 'This Week',
    date: null,
    count: 2,
    items: [
      {
        id: 4,
        title: 'Pay vendor invoice',
        time: 'May 13 (Tue), 9:00 AM',
        tag: 'Brand Refresh',
        tagColor: 'orange',
        accent: 'orange',
        overdue: false,
        assignees: [{ type: 'initials', text: 'AK', bg: '#fdba74', color: '#9a3412' }],
      },
      {
        id: 5,
        title: 'Send content calendar draft',
        time: 'May 14 (Wed), 4:00 PM',
        tag: 'Content Calendar',
        tagColor: 'blue',
        accent: 'blue',
        overdue: false,
        assignees: [{ type: 'initials', text: 'EC', bg: '#93c5fd', color: '#1e40af' }],
      },
    ],
  },
  {
    id: 'overdue',
    title: 'Overdue',
    date: null,
    count: 1,
    items: [
      {
        id: 6,
        title: 'Update product roadmap',
        time: 'May 8 (Thu), 3:00 PM',
        tag: 'Product Roadmap',
        tagColor: 'teal',
        accent: 'red',
        overdue: true,
        assignees: [
          { type: 'img', src: 'https://i.pravatar.cc/40?img=12' },
          { type: 'initials', text: 'AK', bg: '#fdba74', color: '#9a3412' },
        ],
      },
    ],
  },
]

export const overviewStats = [
  { id: 'today', label: 'Today', value: 5, color: 'yellow' },
  { id: 'week', label: 'This Week', value: 7, color: 'purple' },
  { id: 'done', label: 'Completed', value: 18, color: 'green' },
]

export const quickFilters = [
  { id: 'assigned', label: 'Assigned to me', count: 9 },
  { id: 'nodate', label: 'No date', count: 3 },
  { id: 'priority', label: 'High priority', count: 4 },
]

export const labels = [
  { id: 'ideas', name: 'Ideas', color: 'blue' },
  { id: 'ui', name: 'UI', color: 'purple' },
  { id: 'urgent', name: 'Urgent', color: 'red' },
  { id: 'research', name: 'Research', color: 'green' },
]

export const pinnedNotes = [
  {
    id: 'p1',
    title: 'Brand mission & values',
    tint: 'yellow',
    tag: 'Strategy',
    tagColor: 'yellow',
    date: 'May 10',
    type: 'text',
    body: 'We help teams turn scattered ideas into clear, shippable work — without the chaos.',
    members: [
      { type: 'img', src: 'https://i.pravatar.cc/40?img=47' },
      { type: 'img', src: 'https://i.pravatar.cc/40?img=12' },
    ],
  },
  {
    id: 'p2',
    title: 'Brand personality',
    tint: 'purple',
    tag: 'Identity',
    tagColor: 'purple',
    date: 'May 8',
    type: 'bullets',
    items: ['Clear', 'Optimistic', 'Reliable', 'Playful (sparingly)'],
  },
  {
    id: 'p3',
    title: 'Color palette',
    tint: 'green',
    tag: 'Design',
    tagColor: 'green',
    date: 'May 6',
    type: 'swatches',
    swatches: ['#F2C94C', '#1E293B', '#8B5CF6', '#22C55E', '#F8F4EC'],
  },
  {
    id: 'p4',
    title: 'Logo concepts',
    tint: 'blue',
    tag: 'Branding',
    tagColor: 'blue',
    date: 'May 5',
    type: 'logo',
  },
]

export const allNotes = [
  {
    id: 'n1',
    title: 'Brainstorm: Tagline ideas',
    tag: 'Ideas',
    tagColor: 'blue',
    date: 'Today',
    type: 'checklist',
    items: [
      { text: 'Clarity over clutter', done: false },
      { text: 'Your work, plated', done: false },
      { text: 'Projects that stick', done: false },
      { text: 'Think. Plan. Plate.', done: false },
    ],
  },
  {
    id: 'n2',
    title: 'Moodboard',
    tag: 'Moodboard',
    tagColor: 'orange',
    date: 'Yesterday',
    type: 'moodboard',
    images: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=200&h=140&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=140&fit=crop',
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=200&h=140&fit=crop',
      'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=200&h=140&fit=crop',
    ],
  },
  {
    id: 'n3',
    title: 'Typography options',
    tag: 'Design',
    tagColor: 'green',
    date: 'May 12',
    type: 'type',
  },
  {
    id: 'n4',
    title: 'Stakeholder feedback',
    tag: 'Feedback',
    tagColor: 'purple',
    date: 'May 11',
    type: 'checklist',
    items: [
      { text: 'Simplify icon set', done: true },
      { text: 'Warm up yellow accent', done: true },
      { text: 'Add empty states', done: false },
      { text: 'Tighten spacing scale', done: false },
    ],
  },
  {
    id: 'n5',
    title: 'Competitive analysis',
    tag: 'Research',
    tagColor: 'green',
    date: 'May 10',
    type: 'bullets',
    items: [
      'Notion: flexible, dense',
      'Asana: task-first',
      'Linear: speed & polish',
      'Opportunity: softer, calmer UX',
    ],
  },
  {
    id: 'n6',
    title: 'Action items',
    tag: 'Urgent',
    tagColor: 'red',
    date: 'May 9',
    type: 'checklist',
    members: [
      { type: 'img', src: 'https://i.pravatar.cc/40?img=47' },
      { type: 'initials', text: 'AR', bg: '#c4b5fd', color: '#5b21b6' },
    ],
    items: [
      { text: 'Finalize logo lockup', done: false },
      { text: 'Export color tokens', done: false },
      { text: 'Share v2 with client', done: false },
    ],
  },
  {
    id: 'n7',
    title: 'Brand guidelines outline',
    tag: 'Docs',
    tagColor: 'purple',
    date: 'May 9',
    type: 'bullets',
    items: [
      'Voice & tone',
      'Logo usage',
      'Color & type',
      'UI patterns',
    ],
  },
  {
    id: 'n8',
    title: 'Design review — May 9',
    tag: 'Meeting',
    tagColor: 'blue',
    date: 'May 9',
    type: 'text',
    body: 'Aligned on softer pastels, larger cards, and a calmer sidebar. Next: ship Projects grid + Notes.',
    members: [{ type: 'img', src: 'https://i.pravatar.cc/40?img=32' }],
  },
]
