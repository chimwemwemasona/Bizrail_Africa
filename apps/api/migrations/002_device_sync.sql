-- Internal sync foundation. Online session/role enforcement must precede HTTP exposure.
CREATE TABLE business_actors (
  tenant_id uuid NOT NULL REFERENCES businesses(id),
  id uuid NOT NULL,
  disabled_at timestamptz,
  PRIMARY KEY (tenant_id,id)
);
CREATE TABLE devices (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  actor_id uuid NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,id,actor_id),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES business_actors(tenant_id,id)
);
CREATE TABLE offline_grants (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  actor_id uuid NOT NULL,
  device_id uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,device_id,actor_id) REFERENCES devices(tenant_id,id,actor_id),
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '24 hours')
);
CREATE TRIGGER grants_immutable BEFORE UPDATE OR DELETE ON offline_grants
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TABLE device_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES businesses(id),
  actor_id uuid NOT NULL,
  device_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('grant_issued','device_revoked')),
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES business_actors(tenant_id,id),
  FOREIGN KEY (tenant_id,device_id) REFERENCES devices(tenant_id,id)
);
CREATE TRIGGER device_audit_immutable BEFORE UPDATE OR DELETE ON device_audit
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

-- Lock this tenant counter before allocating a cursor; hold the lock to commit.
-- Unlike a sequence, this cannot expose cursor N+1 before N has committed.
CREATE TABLE sync_counters (
  tenant_id uuid PRIMARY KEY REFERENCES businesses(id),
  value bigint NOT NULL DEFAULT 0 CHECK (value >= 0)
);
CREATE TABLE sync_events (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  actor_id uuid NOT NULL,
  device_id uuid NOT NULL,
  device_sequence bigint NOT NULL CHECK (device_sequence > 0),
  grant_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  envelope jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('waiting','accepted','rejected','conflict','quarantined')),
  reason text,
  cursor bigint,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,device_id,device_sequence),
  UNIQUE (tenant_id,cursor),
  FOREIGN KEY (tenant_id,device_id,actor_id) REFERENCES devices(tenant_id,id,actor_id),
  FOREIGN KEY (tenant_id,grant_id) REFERENCES offline_grants(tenant_id,id),
  CHECK ((state = 'accepted') = (cursor IS NOT NULL))
);
CREATE INDEX sync_pending ON sync_events(tenant_id,device_id,state);

CREATE FUNCTION guard_sync_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Sync evidence cannot be deleted'; END IF;
  IF OLD.state <> 'waiting' THEN RAISE EXCEPTION 'Final sync outcomes are immutable'; END IF;
  IF (NEW.tenant_id,NEW.id,NEW.actor_id,NEW.device_id,NEW.device_sequence,NEW.grant_id,NEW.payload_hash,NEW.envelope,NEW.received_at)
     IS DISTINCT FROM
     (OLD.tenant_id,OLD.id,OLD.actor_id,OLD.device_id,OLD.device_sequence,OLD.grant_id,OLD.payload_hash,OLD.envelope,OLD.received_at) THEN
    RAISE EXCEPTION 'Sync source evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sync_evidence_immutable BEFORE UPDATE OR DELETE ON sync_events
FOR EACH ROW EXECUTE FUNCTION guard_sync_event();
