# Internal sync contract

The Phase 1 sync service is an internal server component, not an HTTP endpoint. Authenticated online sessions, business permissions and device credentials must supply its `TrustedDeviceContext`. Never construct that context from a request body or expose the service without those checks.

## Push

`SyncService.push(context, events)` accepts up to 100 events, each at most 64 KiB serialized. Each envelope contains `id`, `schemaVersion: 1`, `sequence`, `grantId`, `capturedAt`, `kind`, `payload` and `dependsOn`. Tenant/actor/device fields are forbidden in the envelope; they come from server context. Supported kind names are sale, quotation, cash receipt, purchase and expense.

Only registered trusted domain handlers can accept a kind. The service does not interpret arbitrary client journal lines or implement merchant posting policies. An unregistered kind is rejected with `unsupported_workflow`. Handlers receive the transaction's PostgreSQL client and must validate their domain payload, version and permissions, choose approved server-side account mappings, and perform all source, stock and ledger writes through that client. Use `LedgerRepository.postInTransaction` for ledger posting. Handlers must not commit, use a separate connection for effects or perform external calls; external delivery belongs after commit through the durable outbox.

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

`pull(context, after, limit)` returns accepted envelopes and receipts belonging to the business, up to 100 per page, with `cursor` and `hasMore`. It requires an active actor/device. This is a business-level internal feed; role-specific filtering must be added before exposing it to differently privileged users.

Cursors are decimal strings, not JavaScript numbers or outbox IDs. A transactional per-business counter and shared business lock serialize acceptance and revocation. Pull orders by the numeric database cursor so values such as 10 follow 9, not 1. A failed transaction rolls back its counter update. Clients persist a cursor only after safely applying the page.

## Device authority and remaining integration

Trusted provisioning must explicitly give an actor `can_manage_devices` before they can revoke a device. Being active alone is insufficient. This narrow capability is not the full Phase 2 role system. Offline grants are immutable and at most 24 hours. Enrolment timestamps use millisecond precision to match transport timestamps.

The existing IndexedDB queue still needs a versioned integration that stores the server grant ID with each captured event, sends only transport fields and handles waiting/retry responses. Existing queued work must never be silently assigned to a newly renewed grant. Authenticated enrolment, approved business handlers, stock projections, UI capture, review actions and browser offline acceptance remain pending.

The PostgreSQL integration suite uses synthetic businesses and a synthetic server-chosen balanced posting handler to verify atomicity. Those fixtures are not an approved chart of accounts or completed sale workflow. Tests use an isolated temporary native PostgreSQL cluster; Docker and Redis are not needed for this sync persistence boundary.
