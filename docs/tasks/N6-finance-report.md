# N6 — Finance orchestration report

**Branch:** merged via `feat/n5-through-n7`  
**Issue:** #8  
**Status:** ✅ Merged to `main`

## Delivered

### Prisma (`20260701230000_n6_integration_outbox`)

- `IntegrationOutbox` + `OutboxStatus` enum

### gRPC client (full surface)

- Escrow, PaymentOrder, Wallet, Withdrawal services
- Metadata + proto `RequestContext` per finance contract

### Transactional outbox

- `IntegrationOutboxService` — insert + BullMQ enqueue
- `FinanceOutboxProcessor` — queue `finance-outbox`, job `process-outbox-row`
- Backoff: 1m → 5m → 15m → 1h (max 10 attempts)
- Side effects: `finance_escrow_id`, `payment_order_id`, `payment_method` on shipment
- Admin replay: `POST /admin/integration-outbox/:id/replay` (SUPER_ADMIN)

### FinanceOrchestrator (try-sync-first, outbox-on-fail)

| Command                            | Trigger                               |
| ---------------------------------- | ------------------------------------- |
| CreateEscrow                       | Accept shipment offer                 |
| CreatePaymentOrder / PayFromWallet | `POST /payments`                      |
| MarkDelivered                      | Carrier sets DELIVERED                |
| FreezeEscrow                       | Open dispute                          |
| ReleaseEscrow                      | Sender CONFIRMED or auto-release cron |
| RefundEscrow                       | Admin dispute resolve REFUND          |
| CreateWithdrawal                   | `POST /payments/withdrawals`          |
| Process/RejectWithdrawal           | Admin endpoints                       |

### HTTP

- `POST /payments` — Zibal redirect or wallet pay
- `GET /users/me/wallet` + `/transactions` — finance proxy
- `POST /payments/withdrawals`, `GET /payments/withdrawals`
- Admin: dispute resolve, withdrawal process/reject, outbox replay

### Cron jobs

- `EscrowJobsService.pollFundedEscrows` — ACCEPTED → PAID when escrow FUNDED/HELD
- `EscrowJobsService.autoReleaseEscrow` — DELIVERED → CONFIRMED + ReleaseEscrow

### Config

- `FRONTEND_URL`, `OUTBOX_MAX_ATTEMPTS`

## Test plan

- [x] `make verify` (71 unit tests)
- [ ] Accept offer → escrow created (or outbox PENDING if finance down)
- [ ] `POST /payments` → redirect URL
- [ ] Wallet proxy with finance running
- [ ] Admin dispute resolve RELEASE/REFUND
- [ ] Kill finance → outbox row → restart → DONE

## Merge order

1. Merge #25 (N4) → #26 (N5) → this PR
2. Rebase onto `main` before final merge

## Deferred (post-rewrite)

- Treasury / reconciliation admin (finance-only ops)
- E2E against Zibal sandbox
