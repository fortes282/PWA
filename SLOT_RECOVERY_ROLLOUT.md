# Slot Recovery Rollout

## Evals Matrix

- Functional
  - Cancellation event from `appointments` creates one `slot_recovery_events` row (no duplicates for repeated trigger).
  - Cancellation event from `bookings_v2` creates recovery event with correct `slot_id`.
  - `runSlotRecoveryEngine` creates exactly one active offer per event cycle.
  - Offer accept updates event to `FILLED` and increments `client_recovery_profiles.recovery_score`.
  - Scoring rule: full-price acceptance within 48h gives more points than discounted last-minute.

- Safety
  - Dedupe by `(source_model, source_id)` blocks duplicate events.
  - Dedupe by `(event_id, client_id)` blocks repeated active offers to one client.
  - Cooldown (`SLOT_RECOVERY_CLIENT_COOLDOWN_HOURS`) suppresses rapid repeat outreach.
  - Daily cap (`SLOT_RECOVERY_MAX_OFFERS_PER_CLIENT_DAY`) enforces anti-spam.
  - Event cap (`SLOT_RECOVERY_MAX_OFFERS_PER_EVENT`) prevents unbounded retries.

- Recovery
  - Expired `OFFERED` entry transitions back to `PENDING` and requeues next candidate.
  - Scheduler restart resumes from `slot_recovery_queue` persistent state.
  - External channel failure (`email/sms/push`) keeps in-app notification audit and marks failed offer.

- Regression
  - Existing waitlist routes still return expected statuses.
  - Existing cancellation flows still complete with unchanged HTTP contracts.

## Rollout Plan

1. Staging deploy with `SLOT_RECOVERY_ENABLED=false` and DB migration auto-create only.
2. Enable dry-run in staging:
   - `SLOT_RECOVERY_ENABLED=true`
   - `SLOT_RECOVERY_MODE=dry-run`
3. Validate admin dashboard counts, queue transitions, dedupe metrics.
4. Enable full mode on staging (`SLOT_RECOVERY_MODE=full-auto`) and run controlled load tests.
5. Production canary:
   - 10% traffic window or limited business hours only
   - Monitor duplicate-offer rate, acceptance-rate, channel failure rate
6. Full production rollout after 48h stable telemetry.

## Fallback and Incident Modes

- Kill switch: set `SLOT_RECOVERY_ENABLED=false`.
- Draft-only mode: set `SLOT_RECOVERY_MODE=dry-run`.
- Channel degradation:
  - push/email/sms fail -> in-app notification remains canonical fallback.
- Manual takeover:
  - Admin can stop engine and process pending events manually from `/admin/slot-recovery`.
