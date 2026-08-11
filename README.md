# TaskPlate

A project management UI with Projects, Reminders, and Notes views. Built as a high-fidelity recreation of a light, pastel dashboard design.

## Screens

- **Projects** — Grid of pastel project cards with filters, sort, and a new-project dropzone
- **Reminders** — Status tabs, date-grouped tasks, and a right rail (overview, calendar, quick filters)
- **Notes** — Project detail with pinned notes, all notes, labels, and a take-a-note bar

Click a project card to open Notes. Use the sidebar to switch between Projects and Reminders.

## Stack

- React 19
- Vite 8
- Plain CSS (no UI library)

## Requirements

Node.js **20+** (Vite 8 needs Node 20 or later).

```bash
nvm use 22   # if you use nvm
```

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start the dev server     |
| `npm run build` | Production build         |
| `npm run preview` | Preview the production build |
| `npm run lint`  | Run ESLint               |

## Project structure

```
src/
  App.jsx              # Shell + view routing
  data.js              # Demo content
  components/          # Sidebar, TopBar, avatars, icons
  views/               # Projects, Reminders, Notes
```
