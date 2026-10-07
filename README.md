# Zura Brain — Front Desk

Single-screen front desk UI for spa session handling. No sidebar. Search an existing client, add or pull booked sessions for the day, send notes to admin, and review saved sessions by date.

## What it does

1. **Search** — find a client by name or phone, or **Create Client** beside search
2. **Client** — see cycle + history, then:
   - **Add Session** — form with cycle auto-filled to the next number
   - **View Booked Sessions** — unused bookings; **Add to Session** saves them for today
   - **Send Note to Admin** — drop a ticket / request (e.g. update phone)
3. **Saved Sessions** — Today (default), Yesterday, or Pick Date. **Edit** is hidden after 36 hours. **Complete Client** marks the visit done.

## Staff codes (demo)

Saves require a valid staff unique code so admin can see who acted:

| Code    | Name  |
| ------- | ----- |
| FD-1001 | Hina  |
| FD-1002 | Bilal |
| FD-1003 | Sana  |
| FD-1004 | Usman |

## Demo clients

| Name         | Phone (search tip) |
| ------------ | ------------------ |
| Imran Khan   | `348` or `Imran`   |
| Ayesha Malik | `555` or `Ayesha`  |
| Omar Farooq  | `777` or `Omar`    |

## Requirements

Node.js **20+**

```bash
nvm use 22   # if needed
npm install
npm run dev
```

## Stack

React 19 + Vite 8 · plain CSS · frontend-only demo data in `src/data.js`
