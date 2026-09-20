# Phase 1 local acceptance — 20 September 2026

Execution scope: native Windows PostgreSQL, a local NestJS API and an installable Next.js PWA. Docker is not required. Redis is explicitly disabled locally. The user authorised development accounting rules on 19 September; these are not accountant-approved rules for live trade.

## What now works through the UI

- Create a local test business with its own ZMW ledger, Main branch and sample catalogue. Sign in with a password and enrol an authenticated device.
- Capture sales, quotations, cash receipts, purchases and expenses online or offline. Product quantities are whole units. Sales/purchases/expenses offer cash or credit settlement. All money is represented in integer ngwee on the server.
- See immediate provisional stock, cash and account balances, with provisional versus server-accepted status. Quotations have no stock or ledger effect.
- Reopen the app offline with its authorised catalogue and device records intact. The service worker caches the public application shell/assets; authorised business data is in the tenant/actor/device-specific IndexedDB database, not the HTTP cache.
- Sync after reconnect, preserving waiting, rejected, conflicting and quarantined records. Retries retain the same operation, sequence and original grant. Accepted receipts and an authoritative snapshot are applied together locally.
- Inspect transaction source documents, quotation versions, the chart of accounts and read-only posted journals. UTC timestamps display in Africa/Lusaka.
- View lease expiry, last sync, pending count, storage warnings and recovery guidance. Export a private local copy without passwords or device credentials. Normal logout is blocked while unresolved work remains; when clear, it blocks racing capture, revokes the device, ends the session and clears its local database. Account switching retains unresolved work in its original scoped database.
- Revoke a device online. Its unaccepted uploads are quarantined without posting. A different authorised reviewer can inspect the original source, reject it or release it as a new, idempotent reviewed operation. Original quarantine and review evidence remain immutable. Reviewed posting retains the original transaction time. A refreshed online review can resume its stored approval after an old review lease expires.

## Browser evidence

`npm run test:browser` drives Chromium against the built application using synthetic workspaces. It checks:

1. Online account creation, sign-in, device enrolment and catalogue download.
2. Manifest, service worker and Chromium installability diagnostics.
3. Ten offline sales at K10 and two offline expenses at K5.
4. Offline reload and tab reopening: sales K100, expenses K10, stock 90 units and a balanced provisional ledger.
5. Deliberate response loss after the server commits the upload, followed by ten identical retries: no duplicated totals.
6. A second, mobile-sized device capturing while offline, server-side revocation, reconnect quarantine and preservation after another offline reload.
7. Independent review posting the additional K7 expense once, leaving the original quarantine evidence intact.
8. No browser page exceptions and no mobile horizontal overflow.

Artifacts are saved under `storage/acceptance/`: `browser-report.json`, `overview-desktop.png`, `offline-ledger.png` and `mobile-quarantine.png`. Desktop and mobile screenshots were visually inspected. These are Chromium network-offline tests; a human OS-level installation and physical device flight-mode matrix are not claimed.

## Data and authority controls

Sessions use random tokens stored as hashes, HTTP-only same-site cookies, a 30-minute idle timeout and a 12-hour absolute timeout. Five failed attempts in 15 minutes block further login attempts for that username. Mutating browser requests require a custom same-origin request header. Device credentials are independently random and hashed on the server. Sync derives tenant/actor/device context from the credential, never from request JSON.

Device grants are immutable and default to 24 hours. `OFFLINE_LEASE_MINUTES` can configure 1–1440 minutes. Revoked devices and disabled actors cannot post new work. Renewal does not change the grant on already captured events or automatically release quarantine. New capture can resume after a legitimate renewal while old expired work remains for review.

Each accepted event commits its source record, stock movement, balanced journal, outbox entry, sync receipt and per-business cursor atomically. Financial documents/journals and stock/document history are immutable. Quotation edits require the expected version. Dependency outcomes and tenant isolation are tested with native PostgreSQL.

The API uses `bizrail_runtime`, a non-superuser with no schema-creation or ledger-update/delete/truncate privileges. The owner connection is reserved for migrations. The development role still has business-wide access inside this dedicated database; this is not database row-level security or the full Phase 2 role system.

A PostgreSQL outbox worker copies pending notifications into an idempotent durable local delivery table and marks delivery in the same transaction. Restart/retry cannot duplicate the target record. This is local delivery evidence, not an external payment/fiscal adapter or a qualified Redis deployment.

## Development posting policy

The user explicitly accepted these provisional rules for testing:

| Transaction            | Debit              | Credit          | Stock effect                                                                      |
| ---------------------- | ------------------ | --------------- | --------------------------------------------------------------------------------- |
| Cash / credit sale     | Cash / Receivables | Sales           | Reduce units; move rounded weighted-average value from Inventory to Cost of sales |
| Cash / credit purchase | Inventory          | Cash / Payables | Add units and purchase value                                                      |
| Cash / credit expense  | Operating expenses | Cash / Payables | None                                                                              |
| Cash receipt           | Cash               | Receivables     | None                                                                              |
| Quotation              | None               | None            | None                                                                              |

New test businesses start with 100 sample units costing K6 and priced at K10, balanced against opening equity. No tax is calculated. Cash receipts are recorded against the receivables control account; invoice allocation and party statements belong to later-phase workflows. Do not treat these sample balances or posting rules as approved merchant accounts.

## Gates that remain external or deliberately deferred

- **D02:** accountant ratification of accounts, costing, tax eligibility, rounding and reporting periods before live trade.
- **D01 / D06:** approved Smart Invoice discovery and accountant/pilot recruitment; no external messages or commitments were made.
- **D05:** product/security ratification of the 24-hour policy, supported devices and recovery procedures. Chromium is the tested browser here.
- **F05:** Hetzner/Ubuntu deployment, private production documents, encrypted SSH backups, staging rebuild and a real Redis delivery/recovery qualification remain deferred by the local-only scope.
- The full Phase 1 exit gate requires those items and review against the referenced SRS, which is not present in the workspace. It is not marked complete solely because the local end-to-end application works.
