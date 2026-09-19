CREATE FUNCTION guard_source_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.kind <> 'quotation' THEN
    RAISE EXCEPTION 'Financial source documents are immutable';
  END IF;
  IF (NEW.tenant_id,NEW.id,NEW.kind,NEW.journal_id) IS DISTINCT FROM (OLD.tenant_id,OLD.id,OLD.kind,OLD.journal_id)
     OR NEW.version <> OLD.version+1 THEN
    RAISE EXCEPTION 'Quotation identity is immutable and versions must advance once';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER source_documents_guard BEFORE UPDATE OR DELETE ON source_documents
FOR EACH ROW EXECUTE FUNCTION guard_source_document();
