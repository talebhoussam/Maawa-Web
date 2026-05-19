# Runbook: Payment Dispute

A client claims they paid but the system shows otherwise, or vice versa.

## Quick reference: state machine

```
none → pending_office → confirmed → in_progress → completed → released
                              ↓                                   ↓
                          refunded ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
```

## Diagnosis

1. **Find the mission**: in admin panel or via:
   ```bash
   # In Firebase Console > Firestore > missions/{missionId}
   # Look at: status, paidAt, paidVia, paidReference, paidAmount, releasedAt, refundedAt
   ```
2. **Find the audit trail**: query `audit_logs` where `target == missionId`. This shows every privileged action (with admin actor, timestamp, and meta).
3. **Find related transactions**: `transactions` where `missionId == X`. There will be one entry per state transition that involves money.

## Common scenarios

### "I paid but the artisan won't start the job"

1. Verify in admin: status should be `confirmed` if payment was recorded.
2. If status is still `pending_office`:
   - Did the office actually receive the payment? Check the receipt/CCP slip ref.
   - If yes, an admin needs to call `POST /api/safepay/confirm-payment` with the missing reference.
   - If no, contact the client to resolve.
3. If status is `confirmed` but no artisan assigned: call `POST /api/admin/missions/assign`.

### "The amount on file doesn't match what I paid"

1. Get the actual paid amount from the office records (CCP slip, bank deposit, etc.).
2. Get `mission.amount` from Firestore.
3. If they differ:
   - **Client paid more**: refund the difference via `POST /api/safepay/refund` with `amount=<difference>`.
   - **Client paid less**: do not confirm. Contact client to top up. Mission stays in `pending_office`.

### "I want a refund"

| Mission state | Action |
|---|---|
| `confirmed` (artisan not started) | Full refund via `/api/safepay/refund` with `reason=client_cancel` |
| `in_progress` | Negotiate. If artisan agrees, partial refund via `/api/safepay/refund` with `amount=X reason=other` |
| `completed` (released) | Cannot refund automatically. Open a dispute, manually credit Maawa Coins as compensation |
| `released` | Same — money is with the artisan. Recover from artisan's payable balance manually |

## After resolution

- Verify the audit log captured your action: `audit_logs` should have a new row with your admin UID.
- Notify both parties (in-app notification + SMS).
- Update the dispute ticket with the resolution.

## Escalation

For amounts > 100,000 DZD or any case involving fraud allegations:
1. Do not auto-resolve. Mark the mission as `disputed` (manual Firestore edit allowed for admins).
2. Email `legal@maawa.dz` with the mission ID and a summary.
3. Wait for legal sign-off before any refund/release.
