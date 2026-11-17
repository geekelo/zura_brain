# Zura Brain — Front Desk

Single-screen front desk UI for spa session handling.

## API

All POS routes are under `/pos`. Default API base: `https://zura-brain-api.fly.dev` (`VITE_API_BASE_URL`). Dev can also proxy via `VITE_PROXY_TARGET`.

| Action | Method |
| --- | --- |
| Search clients | `GET /pos/clients?search=` (min 3 chars; name/phone) — Scan QR fills phone into search |
| Create client | `POST /pos/clients` `{ code, client }` (no preferences) |
| Client preferences | `PATCH`/`PUT` `/pos/clients/preferences` `{ phone, client_preferences }` (no admin code) |
| List sessions | `GET /pos/sessions` — `?phone=` returns that client's sessions by cycle (`404` if unknown) |
| Create session | `POST /pos/sessions` `{ st, client_phone, session, client_support? }` |
| Update session | `PATCH /pos/sessions/:ss` `{ st, session, client_support? }` — support create/update via `type` |
| Status | `PATCH /pos/sessions/:ss/status` `{ th\|tc, status }` — `completed`/`disputed` need admin `tc` only |
| Times | `PATCH`/`PUT` `/pos/sessions/:ss/times` `{ start_time, end_time? }` as `HH:MM:SS` |
| Verify payment | `PATCH`/`PUT` `/pos/sessions/:ss/verify_payment` `{ tc\|th }` |
| Comments | `PATCH`/`PUT` `/pos/sessions/:ss/comments` `{ comments: [{ name, comment, date_time?, resolved? }] }` replaces list |
| Resolve comment | `PATCH`/`PUT` `/pos/sessions/:ss/comments/resolve` `{ index, resolved }` |
| Delete session | `DELETE /pos/sessions/:ss` `{ code }` (admin) |
| Create payment | `POST /pos/payment_methods` multipart: `session_code`, `tc\|th\|code`, `payment_method[...]`, optional `receipt` |
| Update payment | `PATCH /pos/payment_methods/:id` multipart: `tc\|th\|code`, `payment_method[...]`, optional `receipt` |
| Delete payment | `DELETE /pos/payment_methods/:id` `{ tc\|th\|code }` — creator soft-deletes; admin hard-deletes (+ `del_url`) |
| List therapists | `GET /pos/therapists` (`?active=true\|false`) |
| Get therapist | `GET /pos/therapists/:code` |
| Assign therapist | `POST /pos/session_therapists` `{ tc\|th, ss, name, session_therapist.role }` |
| Remove therapist | `DELETE /pos/session_therapists` `{ tc\|th, ss, name }` (422 if tipped) |
| Tip therapist | `POST /pos/session_therapists/tip` `{ ss, name, tip_amount, tc\|admin_code }` (once per therapist) |
| Create admin note | `POST /pos/admin_notes` `{ st, phone\|ss\|th, admin_note: { body, status } }` |

`ss` = session code. `st` / `th` = therapist codes. Admin `tc` / delete `code` defaults to `123456`.

Payment `source`: `pos` | `kuda` | `delight olga` | `cash` | `moniepoint` | `other`.  
Payment `type`: `massage` | `lunez` | `other`.  
Payment `status`: `pending` (default on create) | `ok` | `refunded` | `nonrefunded`. Amount must be greater than 0.  
`payment_url[]` entries: `{ img_url, del_url, date_time }` (empty array when none).

Client preferences: **Preferences** on the client card (no admin code).  
**View sessions** loads `GET /pos/sessions?phone=` for that client (by cycle; `404` if unknown).  
**WhatsApp** opens a pre-filled chat to the client phone (visit thanks ± tip ask, or tip thanks).  
Client card includes a **Zura Spa–framed phone QR** (enlarge / download / send via WhatsApp).  
Other client field edits need admin `code`/`tc` — use **Request client edit** (admin note).  
Session notes: **Manage → Admin note**.

Use **Manage → Update** for session edits; optional **Client support** (`description`, `amount`, `type`: `payin`\|`payout`, optional `notes`).  
Omit support on update to leave the existing record unchanged.  
Sanction and client-support account ledgers live in the **zura_brain_admin** app.

## Requirements

Node.js **20+**

```bash
nvm use 22
npm install
npm run dev
```
