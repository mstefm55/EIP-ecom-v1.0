-- 0001_init.sql
-- Purpose: base extensions + schemas for EIP Core

BEGIN;

-- Extensions (safe defaults)
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive text
CREATE EXTENSION IF NOT EXISTS btree_gin;  -- useful for JSONB/text indexing combos

-- Schemas (align with your design)
CREATE SCHEMA IF NOT EXISTS public;           -- business partner (as you decided)
CREATE SCHEMA IF NOT EXISTS material_master;  -- materials
CREATE SCHEMA IF NOT EXISTS order_management; -- orders

-- Optional: a dedicated schema for platform/core objects
CREATE SCHEMA IF NOT EXISTS eip_core;

COMMIT;
