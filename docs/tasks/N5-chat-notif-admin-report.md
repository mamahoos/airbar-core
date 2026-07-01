# N5 — Chat, Notifications, Admin, Stats report

**Branch:** merged via `feat/n5-through-n7`  
**Issue:** #7  
**Status:** ✅ Merged to `main`

## Delivered

### Prisma (`20260701220000_n5_chat_notif_admin`)

- `Chat`, `ChatMessage`, `Notification`, `Review`, `SystemConfig`
- `NotificationType` enum (PUSH, SMS, EMAIL)

### Notifications

- In-app CRUD: list, mark read, mark all read, delete
- `NotificationService` with dev push sender
- Marketplace hooks: new match, shipment accepted

### Chat

- One thread per shipment; create on assign, deactivate on cancel/reject
- List chats, messages (with read receipts), send message
- Redis `chat:{id}` pub/sub on send

### Stats (public)

- `GET /stats` — platform aggregates
- `GET /stats/popular-routes`
- `GET /stats/testimonials`

### Admin (non-financial — N5 scope)

| Area      | Endpoints                                         |
| --------- | ------------------------------------------------- |
| Dashboard | `GET /admin/dashboard` (no Payment/Payout tables) |
| Users     | list, detail, ban, unban, role (SUPER_ADMIN)      |
| Shipments | paginated list                                    |
| Disputes  | list + resolve via N6 finance gRPC                |
| KYC       | pending documents queue                           |
| Logs      | activity logs with filters                        |
| Config    | get/update (update = SUPER_ADMIN)                 |
| Pricing   | list, create, update rules                        |

**Intentionally omitted (N6):** payments list, payouts, dispute resolve, shipment refund, wallet/escrow.

### Deferred (post-rewrite)

- External push via notification microservice URL

## Test plan

- [x] `make verify`
- [ ] Assign shipment → chat created → send message
- [ ] Admin JWT: dashboard, ban/unban, pricing rule CRUD
- [ ] Public stats without auth

## Merge order

1. Merge PR #25 (N4)
2. Rebase `feat/n5-chat-notif-admin-stats` on `main`
3. Open PR → `Closes #7`
