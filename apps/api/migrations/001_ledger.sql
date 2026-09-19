-- Apply atomically through the migration runner. Amounts are signed ZMW ngwee:
-- positive debit, negative credit. Account policy awaits accountant review.
CREATE TABLE businesses (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  currency text NOT NULL DEFAULT 'ZMW' CHECK (currency = 'ZMW'),
  timezone text NOT NULL DEFAULT 'Africa/Lusaka' CHECK (timezone = 'Africa/Lusaka'),
  branch_name text NOT NULL DEFAULT 'Main' CHECK (length(trim(branch_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  tenant_id uuid NOT NULL REFERENCES businesses(id),
  id uuid NOT NULL,
  code text NOT NULL CHECK (length(code) BETWEEN 1 AND 30),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('asset','liability','equity','income','expense')),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,code)
);

CREATE TABLE journals (
  tenant_id uuid NOT NULL REFERENCES businesses(id),
  id uuid NOT NULL,
  operation_id uuid NOT NULL,
  source_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,operation_id),
  UNIQUE (tenant_id,source_id)
);

CREATE TABLE journal_lines (
  tenant_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  line_no smallint NOT NULL CHECK (line_no BETWEEN 1 AND 100),
  account_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0 AND abs(amount_minor::numeric) <= 999999999999999),
  PRIMARY KEY (tenant_id,journal_id,line_no),
  FOREIGN KEY (tenant_id,journal_id) REFERENCES journals(tenant_id,id),
  FOREIGN KEY (tenant_id,account_id) REFERENCES accounts(tenant_id,id)
);
CREATE INDEX journal_lines_account ON journal_lines(tenant_id,account_id);

CREATE TABLE outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  topic text NOT NULL DEFAULT 'ledger.journal-posted.v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  FOREIGN KEY (tenant_id,journal_id) REFERENCES journals(tenant_id,id),
  UNIQUE (tenant_id,journal_id,topic)
);
CREATE INDEX outbox_pending ON outbox(id) WHERE delivered_at IS NULL;

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger records are append-only; use a compensating journal';
END;
$$;
CREATE TRIGGER journals_immutable BEFORE UPDATE OR DELETE ON journals
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER lines_immutable BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER accounts_immutable BEFORE UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER journals_no_truncate BEFORE TRUNCATE ON journals
EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER lines_no_truncate BEFORE TRUNCATE ON journal_lines
EXECUTE FUNCTION reject_ledger_mutation();

CREATE FUNCTION validate_new_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM journals WHERE tenant_id=NEW.tenant_id AND id=NEW.journal_id
                 AND created_xid=pg_current_xact_id()) THEN
    RAISE EXCEPTION 'Cannot append lines to a committed journal';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lines_same_transaction BEFORE INSERT ON journal_lines
FOR EACH ROW EXECUTE FUNCTION validate_new_line();

CREATE FUNCTION enforce_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line_count integer; balance numeric;
BEGIN
  SELECT count(*), coalesce(sum(amount_minor),0) INTO line_count,balance
  FROM journal_lines WHERE tenant_id=NEW.tenant_id AND journal_id=NEW.id;
  IF line_count < 2 OR balance <> 0 THEN
    RAISE EXCEPTION 'Journal must contain at least two lines and balance to zero';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER journal_balance AFTER INSERT ON journals
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_balanced_journal();

CREATE FUNCTION queue_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO outbox(tenant_id,journal_id) VALUES (NEW.tenant_id,NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER journal_outbox AFTER INSERT ON journals FOR EACH ROW EXECUTE FUNCTION queue_journal();
