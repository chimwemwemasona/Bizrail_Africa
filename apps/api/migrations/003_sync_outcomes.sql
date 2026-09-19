-- Preserve a stable receipt so a lost acknowledgement can be replayed exactly.
ALTER TABLE sync_events ADD COLUMN result jsonb;

-- A grant must belong to this exact actor/device, not just the same business.
ALTER TABLE offline_grants ADD CONSTRAINT grant_device_identity
  UNIQUE (tenant_id,id,actor_id,device_id);
ALTER TABLE sync_events ADD CONSTRAINT event_grant_device
  FOREIGN KEY (tenant_id,grant_id,actor_id,device_id)
  REFERENCES offline_grants(tenant_id,id,actor_id,device_id);

-- Trusted provisioning sets this capability. Merely being active cannot revoke devices.
ALTER TABLE business_actors ADD COLUMN can_manage_devices boolean NOT NULL DEFAULT false;
