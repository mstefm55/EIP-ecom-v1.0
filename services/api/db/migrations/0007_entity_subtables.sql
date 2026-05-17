-- 0007_entity_subtables.sql
-- Purpose: Structured 1-to-many subtables for entities (agent table):
--   - addresses
--   - contacts
--   - bank accounts
-- Notes:
--   - We keep the core table name eip_core.agent for now (semantic: "entity")
--   - These are skeleton tables: stable, indexed, and extensible via jsonb attrs

BEGIN;

-- -----------------------------
-- Address
-- -----------------------------
CREATE TABLE IF NOT EXISTS eip_core.entity_address (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  entity_id     uuid NOT NULL REFERENCES eip_core.agent(id) ON DELETE CASCADE,

  address_type  text NOT NULL DEFAULT 'main',  -- main, billing, shipping, site, etc.
  label         text,                          -- optional display label

  line1         text,
  line2         text,
  city          text,
  state_region  text,
  postal_code   text,
  country_code  char(2),                       -- ISO-3166-1 alpha-2 (MU, FR, etc.)

  -- optional geo (keep nullable)
  latitude      numeric(9,6),
  longitude     numeric(9,6),

  is_primary    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,

  attrs         jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_address_entity_idx
  ON eip_core.entity_address(entity_id);

CREATE INDEX IF NOT EXISTS entity_address_tenant_type_idx
  ON eip_core.entity_address(tenant_id, address_type, is_active);

CREATE INDEX IF NOT EXISTS entity_address_country_idx
  ON eip_core.entity_address(country_code);

CREATE INDEX IF NOT EXISTS entity_address_attrs_gin
  ON eip_core.entity_address USING gin (attrs);

-- Ensure only one primary address per (entity, address_type)
-- Use partial unique index (works well with nullable/boolean patterns)
CREATE UNIQUE INDEX IF NOT EXISTS entity_address_one_primary
  ON eip_core.entity_address(entity_id, address_type)
  WHERE is_primary = true AND is_active = true;

-- -----------------------------
-- Contact methods (phone/email/etc.)
-- -----------------------------
CREATE TABLE IF NOT EXISTS eip_core.entity_contact (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  entity_id      uuid NOT NULL REFERENCES eip_core.agent(id) ON DELETE CASCADE,

  contact_type   text NOT NULL,                -- email, phone, whatsapp, website, etc.
  label          text,                         -- e.g. "work", "home", "accounts dept"
  value          text NOT NULL,                -- the actual email/phone/url/etc.

  is_primary     boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,

  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_contact_entity_idx
  ON eip_core.entity_contact(entity_id);

CREATE INDEX IF NOT EXISTS entity_contact_type_idx
  ON eip_core.entity_contact(tenant_id, contact_type, is_active);

CREATE INDEX IF NOT EXISTS entity_contact_value_idx
  ON eip_core.entity_contact(value);

CREATE INDEX IF NOT EXISTS entity_contact_attrs_gin
  ON eip_core.entity_contact USING gin (attrs);

-- One primary contact per (entity, contact_type)
CREATE UNIQUE INDEX IF NOT EXISTS entity_contact_one_primary
  ON eip_core.entity_contact(entity_id, contact_type)
  WHERE is_primary = true AND is_active = true;

-- -----------------------------
-- Bank accounts
-- -----------------------------
CREATE TABLE IF NOT EXISTS eip_core.entity_bank_account (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  entity_id        uuid NOT NULL REFERENCES eip_core.agent(id) ON DELETE CASCADE,

  account_type     text NOT NULL DEFAULT 'bank',  -- bank, mobile_money, etc.
  label            text,

  bank_name        text,
  account_name     text,
  account_number   text,
  iban             text,
  swift_bic        text,
  currency_code    char(3),                       -- ISO 4217 (USD, EUR, MUR)

  is_primary       boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,

  attrs            jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_bank_entity_idx
  ON eip_core.entity_bank_account(entity_id);

CREATE INDEX IF NOT EXISTS entity_bank_currency_idx
  ON eip_core.entity_bank_account(currency_code);

CREATE INDEX IF NOT EXISTS entity_bank_type_idx
  ON eip_core.entity_bank_account(tenant_id, account_type, is_active);

CREATE INDEX IF NOT EXISTS entity_bank_attrs_gin
  ON eip_core.entity_bank_account USING gin (attrs);

-- One primary bank account per entity (regardless of type) - adjust later if needed
CREATE UNIQUE INDEX IF NOT EXISTS entity_bank_one_primary
  ON eip_core.entity_bank_account(entity_id)
  WHERE is_primary = true AND is_active = true;

COMMIT;
