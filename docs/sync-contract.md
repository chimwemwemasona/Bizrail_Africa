# Sync contract

The Phase 1 sync service is exposed through authenticated `/api/workspace/push` and `/api/workspace/pull` routes. A hashed device credential supplies its `TrustedDeviceContext`; enrolment and administration require an online session. Tenant, actor and device identity never come from the event body. See [local acceptance](phase-1-acceptance.md) for the development-only accounting scope.

## Push

`SyncService.push(context, events)` accepts up to 100 events, each at most 64 KiB serialized. Each envelope contains `id`, `schemaVersion: 1`, `sequence`, `grantId`, `capturedAt`, `kind`, `payload` and `dependsOn`. Tenant/actor/device fields are forbidden in the envelope; they come from server context. Supported kind names are sale, quotation, cash receipt, purchase and expense.

Only registered trusted domain handlers can accept a kind. The workspace handler implements all five workflows using server-chosen development account mappings; it never accepts arbitrary client journal lines. An unregistered kind is rejected with `unsupported_workflow`. Handlers validate domain payloads, versions and stock, and perform all source, stock and ledger writes through the transaction's PostgreSQL client. `LedgerRepository.postInTransaction` participates in that transaction. Handlers must not commit, use a separate connection for effects or perform external calls; delivery belongs after commit through the durable outbox.

Each event gets a separate transaction. Canonical hashes, operation IDs and device sequences prevent changed-content reuse. The server checks that the actor/device exists and that the grant belongs to that exact actor and device. Capture must fall within the recorded grant and not in the server's future; the grant must also remain valid at upload validation. Disabled actors, revoked devices and expired/invalid capture windows produce preserved quarantine outcomes for known grants.

Responses contain `id`, `state`, `reason`, `cursor` and `result`:

| State       | Client action                                                                    |
| ----------- | -------------------------------------------------------------------------------- |
| accepted    | Store the stable receipt; stop retrying this event.                              |
| waiting     | Keep pending and retry after dependencies arrive.                                |
| rejected    | Preserve the event and display the reason.                                       |
| conflict    | Preserve the original and show the conflict; never overwrite financial history.  |
| quarantined | Preserve for authorised review; grant renewal does not approve it.               |
| retry       | Keep pending and retry later; no terminal outcome was committed by this attempt. |

Identical retries return the original final receipt, including after device revocation, without performing new effects. Waiting events are reevaluated on resubmission; there is no background dependency resolver yet. Missing dependencies wait; dependencies with unsuccessful final outcomes conflict. Self-dependencies are rejected. Longer dependency cycles remain waiting and require later user-facing resolution.

Domain handlers may throw `DomainFailure` for invalid transactions, version conflicts or duplicate sources. A savepoint rolls back their writes before storing the failure. Unexpected failures roll back the entire event and return a generic retry result. Deferred ledger constraints are checked before recording acceptance. Journal, outbox, domain effects, sync receipt and cursor commit atomically.

## Pull

`pull(context, after, limit)` returns accepted envelopes and receipts belonging to the business, up to 100 per page, with `cursor` and `hasMore`. It requires an active actor/device. This is a business-level feed for the current workspace roles; the full Phase 2 role system will require role-specific filtering.

Cursors are decimal strings, not JavaScript numbers or outbox IDs. A transactional per-business counter and shared business lock serialize acceptance and revocation. Pull orders by the numeric database cursor so values such as 10 follow 9, not 1. A failed transaction rolls back its counter update. Clients persist a cursor only after safely applying the page.

## Device authority and client integration

Trusted provisioning must explicitly give an actor `can_manage_devices` before they can revoke a device. Being active alone is insufficient. This narrow capability is not the full Phase 2 role system. Offline grants are immutable and at most 24 hours. Enrolment timestamps use millisecond precision to match transport timestamps.

The IndexedDB queue stores the server grant ID with each captured event, sends only transport fields and retries waiting/transient outcomes. Renewals never replace grants on existing events. Legacy events without a grant remain preserved for review. Web Locks coordinate tabs. Accepted outcomes and the authoritative snapshot are saved together before advancing the local cursor, preventing lost acknowledgements from duplicating or dropping projected effects.

An independent manager can reject quarantined work or release it through an immutable stored review and a new idempotent operation. Original evidence and capture time remain intact. A released dependency resolves through its replacement outcome. Only the authenticated review service can resume an existing release after its review grant expires; ordinary device uploads cannot bypass grant expiry.

The PostgreSQL suite exercises internal atomicity and the actual development merchant handler, source versions, stock, authentication and review. Tests use an isolated temporary native PostgreSQL cluster. Browser acceptance additionally covers the UI, real IndexedDB, offline service worker, lost acknowledgements and quarantine/review. Docker and Redis are not needed for this local persistence boundary.
