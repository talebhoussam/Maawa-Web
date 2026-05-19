# Runbook: Ban / Unban a User

## When to ban

- Confirmed fraud (fake NIN, fake reviews, identity theft)
- Repeated harassment or threats reported by other users
- Multiple unresolved disputes where the user is at fault
- Court order

## Process

1. Open admin panel → Users → find the user → "Ban".
2. Or via API:

   ```bash
   curl -X POST https://maawa.dz/api/admin/users/ban \
     -H "Cookie: __session=<your-session>" \
     -H "Content-Type: application/json" \
     -d '{
       "uid": "<their-uid>",
       "reason": "Confirmed fake NIN, ticket #1234"
     }'
   ```

3. The endpoint:
   - Disables the Firebase Auth account (`disabled: true`)
   - Revokes all current refresh tokens (forces immediate logout everywhere)
   - Sets `users/{uid}.banned = true`
   - Writes an audit log entry

4. **Active missions**: ban does NOT auto-resolve in-flight missions. Manually:
   - For each pending/active mission they're a client of: refund or reassign.
   - For each they're an artisan on: reassign via `/api/admin/missions/assign`.

## Unban

Same endpoint with `unban: true`:

```json
{ "uid": "<their-uid>", "reason": "Resolved — false positive", "unban": true }
```

The user can sign in again. They'll need to reset their password if they've forgotten it (banning doesn't delete their auth record, just disables it).

## Edge cases

- **Cannot ban yourself**: the API rejects this. If you need to disable your own admin account, have another super-admin do it.
- **Banning a super-admin**: only another super-admin can do this. The endpoint does not check the target's role; it just refuses self-bans. Adding a "no demote-and-ban without two super-admins" rule is on the roadmap if collusion becomes a concern.
- **User with funds in escrow**: ban the user but DO NOT release/refund missions automatically. Each financial action needs explicit admin intent.
