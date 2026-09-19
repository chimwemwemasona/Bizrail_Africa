CREATE TABLE staff_credentials (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  FOREIGN KEY (tenant_id,actor_id) REFERENCES business_actors(tenant_id,id)
);
CREATE TABLE online_sessions (
  token_hash text PRIMARY KEY,
  credential_id uuid NOT NULL REFERENCES staff_credentials(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '12 hours'
);
CREATE TABLE login_attempts (
  key text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE device_credentials (
  token_hash text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  device_id uuid NOT NULL,
  FOREIGN KEY (tenant_id,device_id,actor_id) REFERENCES devices(tenant_id,id,actor_id)
);
CREATE TABLE products (
  tenant_id uuid NOT NULL REFERENCES businesses(id),
  id uuid NOT NULL,
  name text NOT NULL,
  price_minor bigint NOT NULL CHECK(price_minor>0),
  quantity integer NOT NULL DEFAULT 0 CHECK(quantity>=0),
  value_minor bigint NOT NULL DEFAULT 0 CHECK(value_minor>=0),
  version integer NOT NULL DEFAULT 1,
  PRIMARY KEY(tenant_id,id)
);
CREATE TABLE source_documents (
  tenant_id uuid NOT NULL REFERENCES businesses(id),
  id uuid NOT NULL,
  kind text NOT NULL,
  version integer NOT NULL CHECK(version>0),
  payload jsonb NOT NULL,
  total_minor bigint NOT NULL CHECK(total_minor>0),
  journal_id uuid,
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id)
);
CREATE TABLE document_history (
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  version integer NOT NULL,
  event_id uuid NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY(tenant_id,document_id,version),
  FOREIGN KEY(tenant_id,document_id) REFERENCES source_documents(tenant_id,id)
);
CREATE TRIGGER document_history_immutable BEFORE UPDATE OR DELETE ON document_history
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TABLE stock_movements (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK(quantity<>0),
  value_minor bigint NOT NULL,
  PRIMARY KEY(tenant_id,event_id,product_id),
  FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE TRIGGER stock_movements_immutable BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TABLE sync_reviews (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK(decision IN ('reject','release')),
  reason text NOT NULL CHECK(length(trim(reason))>0),
  context jsonb,
  envelope jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,event_id),
  FOREIGN KEY(tenant_id,event_id) REFERENCES sync_events(tenant_id,id),
  FOREIGN KEY(tenant_id,reviewer_id) REFERENCES business_actors(tenant_id,id)
);
CREATE TRIGGER reviews_immutable BEFORE UPDATE OR DELETE ON sync_reviews
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
-- A durable local delivery target. Redis may accelerate delivery but is never authoritative.
CREATE TABLE delivered_events (
  outbox_id bigint PRIMARY KEY REFERENCES outbox(id),
  tenant_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id)
);
