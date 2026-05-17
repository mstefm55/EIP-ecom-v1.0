-- 0019_object_link.sql
-- Core backbone: universal linking table (graph edges)
-- Links any object to any object, with semantic relation_type.
-- Used for: service_object -> info_record (INPUT/OUTPUT/EVIDENCE),
--          task -> info_record (ATTACHMENT),
--          material_lot -> info_record (LAB_RESULT), etc.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS eip_core.object_link (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,

  -- Source object
  src_kind       text NOT NULL,   -- e.g. 'service_object','task','agent','asset','material_lot','info_record'
  src_id         uuid NOT NULL,

  -- Target object
  dst_kind       text NOT NULL,
  dst_id         uuid NOT NULL,

  relation_type  text NOT NULL,   -- e.g. 'INPUT','OUTPUT','EVIDENCE','ATTACHMENT','RESULT_OF','REFERS_TO'
  sort_order     integer NOT NULL DEFAULT 100,

  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_active      boolean NOT NULL DEFAULT true,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Prevent exact duplicates (same edge semantics)
  CONSTRAINT object_link_no_dupe UNIQUE (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
);

ALTER TABLE eip_core.object_link
  ADD CONSTRAINT object_link_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

-- Fast traversal
CREATE INDEX IF NOT EXISTS object_link_src_idx
  ON eip_core.object_link (tenant_id, src_kind, src_id, is_active);

CREATE INDEX IF NOT EXISTS object_link_dst_idx
  ON eip_core.object_link (tenant_id, dst_kind, dst_id, is_active);

CREATE INDEX IF NOT EXISTS object_link_relation_idx
  ON eip_core.object_link (tenant_id, relation_type, is_active);

CREATE INDEX IF NOT EXISTS object_link_attrs_gin
  ON eip_core.object_link USING gin (attrs);

COMMIT;
