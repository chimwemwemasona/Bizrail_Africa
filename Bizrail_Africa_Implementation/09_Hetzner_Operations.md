> **Current execution scope — 2026-09-13:** Develop and verify locally on the laptop. Hetzner provisioning, deployment and production operations are deferred and do not block local groundwork. Retain hosting requirements below for the future deployment phase. Dependencies are installed and Phase 1 local implementation is in progress; see [groundwork status](../docs/groundwork-status.md) and [Phase 1 evidence](../docs/phase-1-progress.md). This note governs the current work scope; no feature or production acceptance gate is marked complete.

> Version 2.0: applies to the research SME OS. Server backups cover accepted records; unsynced PWA records remain device-local. Payment initiation is release two.

# Hetzner Ubuntu operations checklist

Applies across Phases 01, 06, 07 and 08. All hosts, capacities and paths below are a proposed implementation baseline. Size from measured load; do not treat this as a purchasing commitment.

## Pilot topology

| Component | Placement | Responsibility |
| --- | --- | --- |
| app-01 | Ubuntu Hetzner server | Nginx, app runtime, workers, scheduler, private uploads/PDFs, malware scanner |
| db-01 | Separate Ubuntu Hetzner server | PostgreSQL and database backup/log archival; reachable only from authorised private clients |
| Redis | app-01 initially, private binding | Queue delivery/cache; durable outbox and financial truth remain in PostgreSQL |
| stage-01 | Separate Ubuntu Hetzner server/environment | Synthetic data, sandbox partner, staging database and storage |
| Backup target | Hetzner Storage Box via SSH | Encrypted versioned database/file backups; no runtime file-serving dependency |
| Monitoring | Separate host/service from app-01 | External uptime checks, alerts and protected dashboards |

This initial topology has single points of failure in app-01 and db-01. Recovery targets must be demonstrated; it is not high availability. A second application server requires a separately designed shared private file service or controlled replication/failover. Do not round-robin requests across independent local upload directories.

## H01 — Host and access baseline

- [ ] Select a supported Ubuntu LTS image and pin package/runtime versions; record host inventory and patch owner.
- [ ] Create named non-root administrative users, SSH keys and tested sudo access; require MFA for the Hetzner account.
- [ ] Test console/rescue and a second SSH session before disabling password/root SSH login.
- [ ] Permit public HTTPS, HTTP redirect/certificate validation as needed, and restricted administration only; cover IPv4 and IPv6.
- [ ] Restrict PostgreSQL, Redis, application internal ports and dashboards to intended local/private clients. Verify externally from a separate host.
- [ ] Configure private networking, time synchronisation, security updates, log rotation and planned reboot handling.
- [ ] Verify Docker port publishing/firewall behaviour if containers are chosen; do not assume a host firewall alone blocks published ports.
- [ ] Configure TLS renewal and expiry alerts; HTTPS-only secure application cookies.

## H02 — Persistent private storage

| Path | Purpose | Rules |
| --- | --- | --- |
| `/srv/bizrail/private/quarantine` | New uploads | No downloads; scanner-only processing; quota and expiry |
| `/srv/bizrail/private/accepted` | Accepted evidence and PDFs | Private, versioned, immutable to normal users, backed up |
| `/srv/bizrail/private/exports` | Temporary generated reports | Authorised download, expiry and cleanup |
| `/srv/bizrail/releases` | Versioned app builds | No persistent financial data or uploads |
| `/etc/bizrail` | Restricted runtime configuration | Least privilege; encrypted recovery copy; no git secrets |

- [ ] Mount persistent storage outside release directories; make services fail safely if the expected mount is missing.
- [ ] Use random storage IDs and database tenant/resource ownership; never turn a user filename into a filesystem path.
- [ ] Implement storage behind a local-filesystem interface, with no S3 SDK, bucket variables, presigned S3 URL or MinIO requirement.
- [ ] Enforce file types, size and per-record limits; quarantine, scan and hash before acceptance.
- [ ] Authorise each download in the application, then stream or use an Nginx `internal` location; expire tokens within five minutes and bind access to the required grant.
- [ ] Prevent script execution in all upload locations; keep temporary files out of public roots.
- [ ] Configure encryption at rest for database, accepted files and secrets. Document reboot/unlock and offline key recovery; verify no unsupported provider-encryption assumption.
- [ ] Alert on disk and inode consumption, failed mounts, scanner failure, and growing quarantine/export directories.
- [ ] Test missing disk, full disk, interrupted upload, traversal attempts, unauthorised download and redeploy persistence.

## H03 — Backups and recovery

Hetzner server backups/snapshots exclude attached Volumes. Explicitly back up every accepted-file and database data location. [Hetzner backup scope](https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/)

Hetzner Storage Box supports SSH-based rsync/Borg access. Use an encrypted Borg repository over SSH with a compatible pinned client/server version, rather than object storage. [Hetzner SSH and Borg documentation](https://docs.hetzner.com/storage/storage-box/access/access-ssh-rsync-borg/)

- [ ] Enable the required Storage Box SSH access, pin the host key and configure a dedicated restricted backup identity. Keep administration/pruning credentials separate from application credentials.
- [ ] Schedule database-aware consistent base backups plus continuous or frequent WAL transfer, with checksum and uninterrupted log-chain validation. Never copy a running database data directory as the only backup method.
- [ ] Set and measure backup/log-transfer intervals so the last recoverable off-host point is at most 15 minutes old. Alert before lag exceeds the target.
- [ ] Back up accepted documents and their metadata often enough to meet the same 15-minute target; daily-only file backups fail this requirement.
- [ ] Include encrypted configuration, deployment manifests and required key-recovery instructions; keep decryption keys separately recoverable.
- [ ] Retain at least 35 days of backups as the proposed SRS baseline until the approved policy changes it. Keep application financial/audit retention separate from backup retention.
- [ ] Use versioned backups and protected snapshots/permissions where supported; verify actual delete protections. A plain mirror alone propagates accidental deletion.
- [ ] Capture file inventories/hashes and database restore checkpoints. On recovery detect missing/orphaned documents, retain audit evidence and reconcile rather than silently serving inconsistent records.
- [ ] Test a fresh-server database point-in-time restore plus accepted-file restore; verify tenant counts, invoice totals, allocation invariants and file hashes.
- [ ] Verify restored jobs cannot resend fiscal submissions or business postings with new references; reconcile provider evidence for the recovery gap before reopening normal fiscal processing.
- [ ] Measure total recovery time ≤4 hours, including provisioning, restore, keys, DNS/routing and validation. Record backup size and observed transfer speed.
- [ ] Retest restores after material schema/storage changes and at a documented recurring interval; check backup freshness daily.

A second independent encrypted copy is a later resilience option. Select a non-AWS destination if adopted. A backup is not a standby server and does not by itself provide automatic failover.

## H04 — Service lifecycle and deployment

- [ ] Supervise workers and scheduler using systemd or the selected container process supervisor; prevent unintended duplicate schedules.
- [ ] Keep HTTP health checks distinct from database, queue and partner health; sanitise diagnostic output.
- [ ] Store the outbox transactionally; queue recovery rebuilds pending work from durable records after Redis loss.
- [ ] Deploy versioned artifacts, run compatible migrations, drain/restart workers and run smoke tests.
- [ ] Rehearse code rollback without rolling the financial database backward; retain transaction history accumulated after deployment.
- [ ] Keep releases and package logs bounded so they cannot consume database/file capacity.
- [ ] Document partner outage handling: queue new fiscal submissions safely, preserve callbacks/enquiries, investigate uncertain outcomes.

## H05 — Production readiness evidence

- [ ] External port-scan result and access review attached.
- [ ] TLS renewal, disk, backup, queue and callback alerts reach the named on-call.
- [ ] Load test meets SRS limits on the selected server sizes.
- [ ] Restore evidence proves RPO/RTO, including documents and keys.
- [ ] Hosting region/data-transfer/privacy decisions approved before live pilot.
- [ ] Runbook owner, patch window, incident contacts and escalation path recorded.

Evidence links: —  |  Operations reviewer: TBD  |  Review date: —

## PWA and fiscal operations

- [ ] Monitor sync conflicts, unsynced-device age and fiscal queue/unknown states.
- [ ] Restore PostgreSQL from a consistent base backup and complete WAL archive; verify a point-in-time recovery.
- [ ] Host PWA and APIs over HTTPS; deploy service-worker upgrades without clearing queued device events.
- [ ] Reconcile fiscal references after restore before retrying uncertain submissions.
