-- Active: 1769891749921@@127.0.0.1@5432@eip@eip_authz
# EIP Core ERP System - Developer Manual

## Table of Contents
1. [System Overview](#system-overview)
   1.1 [Business Context](#business-context)
   1.2 [Technical Vision](#technical-vision)
   1.3 [Architecture Principles](#architecture-principles)
2. [Architecture & Technology Stack](#architecture--technology-stack)
   2.1 [Backend Architecture](#backend-architecture)
   2.2 [Frontend Architecture](#frontend-architecture)
   2.3 [Infrastructure Components](#infrastructure-components)
   2.4 [Process Simplicity Guardrails (Early Development)](#process-simplicity-guardrails-early-development)
3. [Core Components](#core-components)
   3.1 [Multi-Tenant Architecture](#multi-tenant-architecture)
   3.2 [Process Engine](#process-engine)
   3.3 [CRM Module](#crm-module)
   3.4 [Ecommerce Module](#ecommerce-module)
   3.5 [Authentication & Authorization](#authentication--authorization)
4. [Database Schema](#database-schema)
   4.1 [Schema Design Philosophy](#schema-design-philosophy)
   4.2 [Core Tables](#core-tables)
   4.3 [Authentication Tables](#authentication-tables)
   4.4 [Authorization Tables](#authorization-tables)
   4.5 [Migration Strategy](#migration-strategy)
5. [API Routes Deep Dive](#api-routes-deep-dive)
   5.1 [Authentication Routes](#authentication-routes)
   5.2 [Process Management Routes](#process-management-routes)
   5.3 [CRM Routes](#crm-routes)
   5.4 [UI Surface Routes](#ui-surface-routes)
   5.5 [Gateway Connection Profiles](#gateway-connection-profiles)
   5.6 [Public Commerce Routes](#public-commerce-routes)
   5.7 [Plug & Play Connection Routes](#plug--play-connection-routes)
   5.8 [Tenant Onboarding Checklist](#tenant-onboarding-checklist)
   5.9 [Ecommerce Routes (Internal)](#ecommerce-routes-internal)
6. [Security Implementation](#security-implementation)
   6.1 [Authentication Security](#authentication-security)
   6.2 [Session Management](#session-management)
   6.3 [CSRF Protection](#csrf-protection)
   6.4 [Password Security](#password-security)
   6.5 [API Security](#api-security)
7. [Process Engine Deep Dive](#process-engine-deep-dive)
   7.1 [Graph Theory Fundamentals](#graph-theory-fundamentals)
   7.2 [Process Definition Structure](#process-definition-structure)
   7.3 [Execution Engine](#execution-engine)
   7.4 [Effects System](#effects-system)
   7.5 [Idempotency & Transactions](#idempotency--transactions)
8. [Configuration Management](#configuration-management)
   8.1 [Environment Variables](#environment-variables)
   8.2 [Configuration Validation](#configuration-validation)
   8.3 [Tenant Configuration](#tenant-configuration)
9. [Development Best Practices](#development-best-practices)
   9.1 [Code Organization](#code-organization)
   9.2 [Error Handling](#error-handling)
   9.3 [Database Patterns](#database-patterns)
   9.4 [Testing Patterns](#testing-patterns)
10. [Testing Strategy](#testing-strategy)
    10.1 [Unit Testing](#unit-testing)
    10.2 [Integration Testing](#integration-testing)
    10.3 [End-to-End Testing](#end-to-end-testing)
    10.4 [Security Testing](#security-testing)
11. [Deployment Architecture](#deployment-architecture)
    11.1 [Development Environment](#development-environment)
    11.2 [Staging Environment](#staging-environment)
    11.3 [Production Environment](#production-environment)
12. [Troubleshooting Guide](#troubleshooting-guide)
    12.1 [Common Issues](#common-issues)
    12.2 [Debug Tools](#debug-tools)
    12.3 [Logging & Monitoring](#logging--monitoring)
13. [Extension Points](#extension-points)
    13.1 [Adding New Modules](#adding-new-modules)
    13.2 [Custom Business Logic](#custom-business-logic)
    13.3 [Integration APIs](#integration-apis)
14. [Performance Optimization](#performance-optimization)
    14.1 [Database Optimization](#database-optimization)
    14.2 [Application Optimization](#application-optimization)
    14.3 [Caching Strategies](#caching-strategies)
15. [Operational Procedures](#operational-procedures)
    15.1 [Backup & Recovery](#backup--recovery)
    15.2 [Monitoring & Alerting](#monitoring--alerting)
    15.3 [Incident Response](#incident-response)
16. [Compliance & Security](#compliance--security)
    16.1 [GDPR Compliance](#gdpr-compliance)
    16.2 [Security Standards](#security-standards)
    16.3 [Audit Requirements](#audit-requirements)

## System Overview

EIP Core is a multi-tenant enterprise resource planning platform built as a monorepo with modular architecture. It's designed as a reusable ERP engine supporting multiple business applications, with a focus on scalability, security, and maintainability.

### 1.1 Business Context

**Enterprise Resource Planning (ERP) Systems** are comprehensive software solutions that integrate and automate core business processes across an organization. Traditional ERP systems are monolithic, expensive to customize, and difficult to scale. EIP Core addresses these limitations by providing:

- **Composable Architecture**: Build custom ERP solutions from modular components
- **Multi-Tenant SaaS Model**: Single codebase serving multiple customers with complete data isolation
- **Process Automation**: Configurable workflow engine replacing custom-coded business logic
- **Developer-Friendly**: Modern tech stack with comprehensive APIs and documentation

**Target Use Cases**:
- Small to medium businesses needing customized ERP functionality
- Enterprises requiring rapid deployment of new business processes
- ISVs building vertical market solutions on a robust ERP foundation
- Organizations needing HIPAA/GDPR-compliant data handling

**Market Positioning**:
- **vs. SAP/Oracle**: 90% cheaper, 10x faster deployment, fully customizable
- **vs. Generic SaaS**: Industry-specific configurability with enterprise-grade security
- **vs. Custom Development**: Pre-built components with proven architecture

### 1.2 Technical Vision

**Vision Statement**: "Democratize enterprise software by providing a composable, secure, and scalable ERP platform that enables businesses to build custom solutions without the complexity and cost of traditional enterprise software."

**Core Principles**:
1. **Security First**: Every feature designed with security as primary consideration
2. **Developer Experience**: Comprehensive tooling, documentation, and APIs
3. **Operational Excellence**: Automated deployment, monitoring, and maintenance
4. **Business Agility**: Rapid customization without code changes

**Long-term Goals**:
- **2025**: Complete CRM, Inventory, and Order Management modules
- **2026**: Advanced analytics and reporting platform
- **2027**: AI-powered process optimization and predictive analytics
- **2028**: Global expansion with multi-region deployment

### 1.3 Architecture Principles

**1. Multi-Tenant by Design**
- All tables include `tenant_id` foreign keys
- Shared database with row-level isolation
- Tenant-specific configuration and branding
- Complete data segregation (no cross-tenant access)

**2. API-First Development**
- RESTful APIs for all business operations
- Comprehensive OpenAPI documentation
- Versioned APIs with backward compatibility
- Rate limiting and request validation

**3. Event-Driven Architecture**
- Process engine triggers automated workflows
- Audit trails for all state changes
- Event sourcing for complex business logic
- Asynchronous processing for performance

**4. Security as Code**
- Authentication and authorization in every request
- CSRF protection on state-changing operations
- Input validation and sanitization
- Secure defaults with explicit opt-in for less secure options

**5. Infrastructure as Code**
- Declarative configuration management
- Automated deployment pipelines
- Immutable infrastructure patterns
- Monitoring and alerting as first-class citizens

### Key Characteristics
- **Multi-tenant**: Complete data isolation between tenants using PostgreSQL row security
- **Process-driven**: Graph-based workflow engine enabling complex business automation
- **Modular**: Clean separation of concerns with CRM, inventory, and custom modules
- **Secure**: Multi-layer authentication (password + OTP), authorization, and CSRF protection
- **Scalable**: Horizontal scaling with stateless application design and database optimization
- **Developer-friendly**: Comprehensive APIs, detailed documentation, and extension points

## Architecture & Technology Stack

### Backend (Node.js/Fastify)
- **Framework**: Fastify 4.x with ES modules
- **Database**: PostgreSQL with multiple schemas
- **Security**: CSRF protection, rate limiting, multi-factor authentication
- **Authentication**: Session-based with cookie storage, API key support

### Frontend Applications
- **EIP Dashboard (apps/dashboard)**: Vite + React + Tailwind. Single `index.html` and `App.jsx`, with UI rendered by a JSON-driven engine (surfaces are the source of truth and can be stored in the DB).
- **Landing Page**: Static HTML/CSS/JS
- **Samara Web App**: Tenant-facing Vite-based React application

### UI Engine Policy (Non-negotiable)
- All new module UIs must be fully UI-engine driven. Surface JSON is the source of truth.
- Exception: Admin Console and Authentication/Authorization modules may remain hardcoded.
- Do not add new hardcoded React panels for module screens. If a capability is missing, add or extend engine components and reference them from the surface tree.
- Layout copy, labels, placeholders, and action labels must live in `props.layout` within the surface JSON. Components only render data and wire actions.
- Every UI surface must have a DB seed in `services/api/db/seed/ui_surface_*.sql` and a fallback in `apps/dashboard/src/engine/surfaces/*.js`.
- Before starting any new module UI work, re-read this section and reference it in the task plan or PR to avoid drift.

### Process Simplicity Guardrails (Early Development)
Current scope is still early-stage (ECOM near-ready, CRM backend-focused). To avoid process-engine overgrowth and debugging complexity:

- For each new module, run a short architecture brainstorming before implementation.
- Default to a **minimal process** first (few stages, few effects), then extend only when required by real use-cases.
- Prefer **business templates** (example: "PO Standard") over exposing low-level process/effect details to end users.
- Keep an explicit **core effect set**; new effects need a clear justification and owner.
- Require observability for every new process path (traceable status transitions, task events, and effect outcomes).
- Prefer composition/reuse of existing process and task components over adding new primitives.
- For module kickoff, document:
  1) simple flow (happy path),
  2) mandatory exceptions,
  3) rollback/error handling,
  4) why existing effects are not sufficient (if adding new ones).

Policy: no architecture rewrite now; continue on current kernel + process engine, with simplicity-first constraints.

#### Mandatory Reading Before New Process/Module Work

To maintain continuity across sessions/contributors, read these first:

1. `docs/PROCESS_V2_INTENT.md`
2. This section (`Process Simplicity Guardrails (Early Development)`)

Any intentional deviation must be written in task/PR notes with rationale and expected impact.

#### Mandatory Implementation Gate (Plan -> Engine Mapping -> Code)

This is a hard gate before writing code. Do not skip.

For every feature/change, document these three blocks first:

1. **Plan**
   - Business objective (1-2 lines)
   - Scope in/out
   - API/UI/DB touchpoints

2. **Engine Mapping**
   - Which part is UI Engine (surface/schema/config)
   - Which part is Process Engine (object type, transitions, effects, bindings)
   - Which part is System Core only (infra/config/scan/auth plumbing), with justification

3. **Code**
   - Files to change
   - Migration/seed impact
   - Tests/validation commands

If a change is not mapped to an engine or core category, stop and clarify design before implementation.

#### Tenant-Agnostic Feature Gate (Mandatory)

Every new feature must be designed for multi-tenant reuse by default. No tenant-specific behavior may be hardcoded in runtime flows.

Required checks before merge:

1. **No tenant hardcoding**
   - Do not hardcode tenant codes, section names, URLs, locales, categories, or route branches for one storefront.
   - Allowed exception: test fixtures/scripts only (never production runtime path).

2. **Configuration-driven behavior**
   - Tenant variability must come from DB/config (`tenant attrs`, connection profiles, dropdown-controlled lists, manifest mapping, process bindings), not code forks.
   - UI labels/structure must be surface/config driven where applicable.

3. **Engine alignment**
   - Business lifecycle actions run via Process Engine transitions.
   - UI behavior and layout come from UI Engine/surfaces.
   - System Core is only for infrastructure plumbing (scan/bootstrap/auth/config transport), not tenant business logic.

4. **Safe defaults + overrides**
   - Provide a generic default behavior for new tenants.
   - Tenant-specific changes must be additive overrides through config/mapping (no code edits per tenant).

5. **Verification evidence**
   - Validate on at least two tenants (template + one non-template tenant) for the same feature path.
   - Record where the feature is configured and how to disable it.

##### Required PR/Task Template

Copy this into task notes or PR description:

```md
### Plan
- Objective:
- Scope:
- Touchpoints:

### Engine Mapping
- UI Engine:
- Process Engine:
- System Core:
- Deviation (if any) + reason:

### Code
- Files:
- Migrations/Seeds:
- Validation:
```

##### Process-First Rule for Business Actions

- Business state changes (create/publish/reject/cancel/delete lifecycle actions) must go through **Process Engine transitions**.
- Direct status mutation is allowed only for emergency repair/migration scripts, never as normal runtime path.
- If binding is missing and `require_process_binding=true`, return explicit error (`PROCESS_BINDING_REQUIRED`) and do not fallback to ad-hoc behavior.

#### Execution Plan (What to do now)
Use this sequence for every upcoming module while the platform is still stabilizing:

1. **Module brainstorm first (mandatory)**
   - Define target outcomes in business language.
   - Define the minimal happy path (no edge-case explosion).
   - Define the smallest process graph that can ship.

2. **Freeze and govern core effects**
   - Keep a small core effect registry (stable, cross-module effects only).
   - Mark everything else as module-pack effects.
   - Any new core effect needs: owner, reason, expected reuse, and rollback strategy.

3. **Add composite effects/macros**
   - Build business-level composite effects that expand into low-level effects.
   - Example: `PO_APPROVAL_FLOW` can internally execute status changes, task creation, and notifications.
   - Keep composites parameter-driven (thresholds, assignees, SLAs, channels).

4. **Template-first process authoring**
   - Ship templates (example: "PO Standard", "PO With Finance Approval", "PO Fast Track").
   - End users configure template parameters instead of editing graph internals.
   - Keep advanced graph editing available only for authorized admins.

5. **Traceability and debuggability baseline**
   - Every transition must produce a traceable event.
   - Every effect execution must log input, output, and error (if any).
   - Process instance timeline must be sufficient to reconstruct failures without code-level forensics.

6. **Complexity gates before publish**
   - Validate graph branch/join consistency and deprecated effect usage.
   - Enforce module-level limits (max branches per node, max effects per transition).
   - Reject publish if required observability metadata is missing.

7. **Post-release learning loop**
   - Review incidents and classify root causes by effect/template/permission/data quality.
   - Promote repeated patterns into composites.
   - Remove or deprecate low-value effects.

#### Recommended Core Effects (Baseline Set)
The following core effects are recommended to cover most cross-module scenarios:

1. `STATUS_SET` - Set service object lifecycle/status.
2. `ATTRS_MERGE` (or `JSON_MERGE`) - Merge structured attributes into object/task payload.
3. `TASK_CREATE` - Create a human/system task.
4. `TASK_UPDATE` - Update assignee, SLA, metadata, or task fields.
5. `TASK_STATUS` - Transition task state (`open`, `in_progress`, `done`, etc.).
6. `LINK_UPSERT` - Create/update relationship between objects/agents.
7. `LINK_REMOVE` - Remove relationship explicitly.
8. `SO_CREATE` - Create child/related service object.
9. `INFO_RECORD_WRITE` - Write operational/audit event.
10. `HTTP_REQUEST` - Call external integration endpoint.
11. `NOTIFY_SEND` - Send email/SMS/in-app notification through adapter.
12. `TIMER_SCHEDULE` - Schedule delayed action/reminder/escalation.

#### Effect Scope Rule
- If an effect is used by only one module domain (inventory/access grant/special finance logic), keep it in that module pack.
- Promote to core only when proven cross-module reuse exists.

### Repository Structure
```
eip-core/
├── apps/           # Business-facing applications
├── services/       # Backend services (API, workers)
├── packages/       # Shared libraries
├── docs/          # Developer & system documentation
└── scripts/       # Tooling & automation
```

**Workspaces**: The repo is configured with npm workspaces. Install dependencies once from the root (`npm install`) to hydrate all apps/services.

## Core Components

### 1. Multi-Tenant Architecture
- Tenant isolation at database level (`tenant_id` foreign keys)
- Dynamic tenant resolution for public routes
- Tenant-specific websites served statically
- Bootstrap/onboarding workflows

### 2. Core Process Engine
- Graph-based workflow engine operating on service objects
- Supports complex business processes with state transitions
- Effects system for automated actions
- Idempotent operations with transaction safety

### 3. CRM Module
- Customer relationship management on core tables
- Entities: Agents (customers), contacts, addresses, bank accounts
- Service objects: Interactions, cases, opportunities, tasks
- Process-driven workflows

### 4. Ecommerce Module

The ecommerce module is implemented on top of the **core process engine + service_object** model.
There is **no separate product table required** for the UX flows described below; products are stored
as `service_object` rows (`object_type = 'product'`) with structured JSON attributes.

**Key service objects**
- `product`: product master + enrichment fields in `service_object.attrs`
- `sales_order`: order intake and fulfillment transitions
- `payment`: payment lifecycle transitions

**Template tenant + seeding**
- Template tenant: `eip_ecom` (`services/api/db/seed/tenant_template_ecom.sql`)
- Ecom processes: `services/api/db/seed/template_ecom_process.sql`
- Clone into a real tenant: `services/api/db/seed/clone_template_to_tenant.sql`

**Product enrichment data model (attrs JSON)**
- `content.summary`: short description
- `media.hero_asset` / `media.hero_url`: hero image/video
- `media.gallery_assets` / `media.gallery`: gallery images/videos
- `pricing.strategy`: `fixed | tiered | regional | subscription`
- `pricing.tiers[]`: one-to-many price entries (currency/region/tax/discount)
- `inventory.sku`, `inventory.available_qty`, `inventory.track_inventory`
- `variants.enabled`, `variants.items[]` (tenant-defined variant attributes)
- `variants.headers[]` (dropdown-governed by `ecom/ECOM_VARIANT_HEADER`; no free-form header keys)
- `taxonomy.category`, `taxonomy.subcategory`, `taxonomy.tags`
- `seo.title`, `seo.description`, `seo.slug`

**Variant inventory consistency rule**
- When `variants.enabled = true`, product inventory must be derived from variants.
- The process effect `VARIANT_INVENTORY_VALIDATE` reconciles `inventory.available_qty` and `inventory.on_hand` to the sum of active `variants.items[].stock_qty`.
- Reconciliation runs through product workflow transitions (process-driven), not ad-hoc route logic.
- Manual inventory entry is only authoritative when variants are disabled.

**Pricing rules**
- The UI captures **price tiers** per currency/region.
- System-wide pricing, tax, discount logic is enforced by
  `eip_core.commercial_condition` (commercial conditions can override discounts).

**Media uploads (local)**
- Upload endpoint: `POST /api/eip/ecom/uploads` (multipart form field: `file`)
- Files are stored locally under `services/api/assets/{tenant_id}/products`
- URLs are served by the API at `/assets/...`
- For production hosting, replace local storage with the deployment provider (S3/MinIO/etc).

**Process alignment**
- Product onboarding uses `ECOM_PRODUCT_ONBOARDING`.
- Sales order flow uses `ECOM_SALES_ORDER_FLOW`.
- Payment flow uses `ECOM_PAYMENT_FLOW`.

### 5. Authentication & Authorization
- User identity management with password hashing (Argon2)
- Session management with device tracking
- API key authentication for integrations
- Permission-based access control with role bundles

## Database Schema

### PostgreSQL Schemas
- `eip_core`: Platform core tables (tenants, processes, tasks)
- `eip_auth`: Authentication and authorization
- `eip_authz`: Permissions and roles
- `material_master`: Product/material data
- `order_management`: Order processing
- `public`: Business partner data

### Core Tables (eip_core schema)

#### tenant
```sql
CREATE TABLE eip_core.tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code citext UNIQUE NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true,
  attrs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Stores tenant metadata and configuration
**Why**: Enables multi-tenant data isolation and tenant-specific settings

#### service_object
```sql
CREATE TABLE eip_core.service_object (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  object_type text NOT NULL,
  status text NOT NULL,
  title text,
  attrs jsonb DEFAULT '{}',
  owner_agent_id uuid REFERENCES eip_core.agent(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Generic entity storage for business objects
**Why**: Flexible schema supporting CRM cases, opportunities, inventory items, etc.

#### process_def
```sql
CREATE TABLE eip_core.process_def (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES eip_core.tenant(id),
  code text NOT NULL,
  name text NOT NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  graph jsonb NOT NULL,
  attrs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Workflow definitions as JSON graphs
**Why**: Enables configurable business processes without code changes

#### process_instance
```sql
CREATE TABLE eip_core.process_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  service_object_id uuid NOT NULL REFERENCES eip_core.service_object(id),
  process_def_id uuid NOT NULL REFERENCES eip_core.process_def(id),
  status text DEFAULT 'active',
  cursor_json jsonb DEFAULT '{}',
  attrs jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Active process executions with state tracking
**Why**: Maintains workflow state and history for each business object

#### task
```sql
CREATE TABLE eip_core.task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  service_object_id uuid REFERENCES eip_core.service_object(id),
  process_def_id uuid REFERENCES eip_core.process_def(id),
  task_type text NOT NULL,
  status text DEFAULT 'open',
  title text,
  description text,
  assigned_agent_id uuid REFERENCES eip_core.agent(id),
  due_at timestamptz,
  payload jsonb DEFAULT '{}',
  attrs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Workflow tasks assigned to users
**Why**: Human tasks in automated processes

#### Commerce Kernel (planned, kernel-aligned)

Digital commerce is enabled without new product tables by using the existing `material` master.
We add **one** commercial rules table, a jurisdiction tree, and a document registry for audit.

##### material (product catalog)
**Why**: One catalog for digital + physical with zero rework later.

**Usage**
- Use `material.material_type` to classify: `digital | physical | service`.
- Digital delivery configuration lives in `material.attrs.delivery`.
- Physical inventory attaches to `material_lot` later without schema change.

##### commercial_condition (pricing/tax/discount/terms)
**Why**: Single flexible rules table with many-to-many targeting and no table explosion.

**Key fields**
- `condition_type` (price | tax | discount | terms)
- `condition_category` (e.g., base_price, VAT, installment, subscription)
- `priority` (higher wins)
- `valid_from`, `valid_to` (short-lived promos supported)
- `scope` jsonb (jurisdiction, agents, materials, channels)
- `effect` jsonb (pricing/tax/discount logic)
- `attrs` jsonb (misc)

**Linking (object_link)**
Use `eip_core.object_link` to attach rules to:
- `material` (relation_type: `APPLIES_TO`)
- `agent` (relation_type: `APPLIES_TO`)
- `jurisdiction` (relation_type: `JURISDICTION_SCOPE`)
- `service_object` (relation_type: `APPLIED_TO` for snapshots)

##### jurisdiction (geo tree, ISO-based)
**Why**: Tax and pricing depend on global jurisdiction chains (country ? city).

**Key fields**
- `code`, `name`, `level`, `parent_id`
- `iso_country_code`, `iso_subdivision_code`, `iso_numeric_code`
- `attrs` jsonb for trade agreements/custom unions

**Seed (global ISO countries)**
- Seed file: `services/api/db/seed/jurisdiction_iso_seed.sql`
- Load after migration `0052_jurisdiction.sql`.
- Command (psql):
  ```sql
  \i services/api/db/seed/jurisdiction_iso_seed.sql
  ```

**Linking (object_link)**
- Agent ? Jurisdiction (relation_type: `CITIZENSHIP`, `INCORPORATION`, `TAX_RESIDENCE`, `SHIP_FROM`, `SHIP_TO_DEFAULT`)
- Commercial condition ? Jurisdiction (relation_type: `JURISDICTION_SCOPE`)

##### document_registry (audit/legal documents)
**Why**: Accounting and compliance require explicit document tracking, separate from content artifacts.

**Key fields**
- `content_object_id`, `content_version_id`
- `doc_type`, `doc_no`, `issued_at`, `status`
- `attrs` jsonb

**Linking**
Use `object_link` to attach documents to `service_object`, `agent`, or `material`.

##### Documents vs. Content
- `content_object` = reusable digital artifact (manual, file, dataset).
- `document_registry` = legal/audit artifact (invoice, contract, tax form).

##### Digital delivery (process-driven)
Digital delivery is modeled as a `service_object` process (e.g., `digital_entitlement`).
- Token/reference stored in `service_object.attrs`.
- Entitlement links to `content_object` via `object_link`.
- Token consumption is tracked as a process transition (no extra tables).

##### Accounting (future, dedicated tables)
Accounting will have dedicated ledgers for audit/legal requirements.
Order/payment service_objects will post entries to ledgers later.

### Authentication Tables (eip_auth schema)

#### auth_identity
```sql
CREATE TABLE eip_auth.auth_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  login citext NOT NULL,
  login_type text DEFAULT 'email',
  is_active boolean DEFAULT true,
  is_locked boolean DEFAULT false,
  attrs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, login)
);
```

**Purpose**: User accounts with login credentials
**Why**: Multi-tenant user management

#### auth_session
```sql
CREATE TABLE eip_auth.auth_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id),
  device_id uuid REFERENCES eip_auth.auth_device(id),
  expires_at timestamptz NOT NULL,
  csrf_secret_hash text NOT NULL,
  ip_address inet,
  user_agent_hash text,
  is_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  attrs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

**Purpose**: Active user sessions with security metadata
**Why**: Session management with device tracking and CSRF protection

#### auth_password_reset
```sql
CREATE TABLE eip_auth.auth_password_reset (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_ip text,
  requested_user_agent text
);
```

**Purpose**: Stores one-time password reset tokens (hashed)
**Why**: Allows secure reset without exposing raw tokens or user enumeration

#### auth_recovery_token
```sql
CREATE TABLE eip_auth.auth_recovery_token (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_ip text,
  requested_user_agent text
);
```

**Purpose**: Break-glass recovery tokens for EIP admins
**Why**: Enables controlled recovery when TOTP/device is lost, without weakening normal login flows

#### auth_recovery_request
```sql
CREATE TABLE eip_auth.auth_recovery_request (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id) ON DELETE CASCADE,
  login text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_ip text,
  requested_user_agent text,
  decided_at timestamptz,
  decided_by uuid,
  decision_reason text
);
```

**Purpose**: Admin-reviewed requests when a user has lost their authenticator
**Why**: Adds human approval for high-risk recovery and limits account takeover risk

## API Routes Deep Dive

### Authentication Routes (`src/routes/auth.js`)

**Purpose**: Handles user authentication with multiple security layers including OTP-based login, device management, and session handling.

**Key Endpoints**:

#### POST /auth/request-otp
Initiates OTP-based login flow with comprehensive security checks
```javascript
// Request payload validation
{
  "tenantId": "uuid",        // Required: Tenant identifier for multi-tenant isolation
  "email": "user@example.com", // Required: User login identifier
  "password": "password"     // Required: User's password for initial verification
}

// Response indicates OTP was sent (doesn't reveal if user exists for security)
{ "ok": true } // OTP sent to email if credentials valid
```

**Security Features**:
- **Rate limiting**: 30 requests/minute per IP to prevent brute force
- **Password verification**: Validates password before sending OTP (fail silently if invalid)
- **OTP expiration**: 10-minute window for OTP validity
- **Attempt limits**: Maximum 5 OTP requests per 10-minute window per user
- **Silent failures**: Returns success even for invalid credentials to prevent user enumeration

#### POST /auth/verify-otp
Completes authentication with OTP and establishes secure session
```javascript
// Request with OTP verification
{
  "tenantId": "uuid",           // Required: Same tenant as request-otp
  "email": "user@example.com",  // Required: Must match request-otp
  "otp": "123456"              // Required: 6-digit OTP from email
}

// Success response with session establishment
{ "ok": true } // Sets HTTP-only session cookies: sid, csrf, did
```

**Why this flow**:
- **High assurance**: Combines password + OTP for strong authentication
- **Anti-phishing**: OTP prevents password-only attacks
- **Device trust**: Tracks and manages trusted devices
- **Step-up auth**: Supports escalating privileges for sensitive operations
- **Session security**: Creates secure, HTTP-only cookies with CSRF protection

#### POST /auth/password/forgot
Requests a password reset link (always returns success to avoid user enumeration)
```javascript
{
  "email": "user@example.com",
  "organisation": "tenant_code"
}
```

#### POST /auth/password/reset
Consumes the reset token and updates the password
```javascript
{
  "token": "raw-reset-token",
  "password": "new_password",
  "confirmPassword": "new_password"
}
```

#### POST /auth/recovery/request
Requests a recovery token for EIP admin access (requires password + TOTP unless dev override)
```javascript
{
  "email": "admin@example.com",
  "organisation": "EIP",
  "password": "password",
  "totp": "123456"
}
```

#### POST /auth/recovery/consume
Consumes a recovery token and issues a temporary session
```javascript
{
  "token": "raw-recovery-token"
}
```

#### POST /auth/recovery/request-lost
Creates an admin-reviewed recovery request when TOTP device is lost
```javascript
{
  "email": "admin@example.com",
  "organisation": "EIP",
  "password": "password",
  "totpLost": true
}
```

#### GET /auth/recovery/requests?status=PENDING
Admin listing of pending recovery requests (EIP admin only)

#### POST /auth/recovery/requests/:id/approve
Approves a pending recovery request and issues a recovery token (EIP admin only)

#### POST /auth/recovery/requests/:id/reject
Rejects a pending recovery request with a decision reason (EIP admin only)

**Auth UI surfaces**
- Public auth UI is rendered from `eip_core.ui_surface` (code `auth`) when DB surfaces are enabled.
- The recovery + reset buttons are included in migration `services/api/db/migrations/0073_ui_surface_auth.sql`.

### Process Routes (`src/routes/core_process.js`)

#### POST /process/defs
Create new process definition
```javascript
// Request
{
  "code": "case_lifecycle",
  "name": "Case Lifecycle",
  "graph": {
    "object_type": "CRM_CASE",
    "initial_node": "new",
    "nodes": {
      "new": { "on_enter": { "task_templates": [...] } },
      "in_progress": {}
    },
    "transitions": [...]
  }
}
```

**Why JSON graphs**: Enables business users to configure workflows without developer intervention.

#### POST /process/instances/:id/advance
Advance process state
```javascript
// Request
{
  "action": "start",
  "idempotency_key": "unique-key",
  "payload": { "notes": "Customer called" }
}
```

**Why idempotent**: Handles network retries and duplicate requests safely.

### Process Builder (Admin UI)

The Process Builder is an admin-only UI rendered by the UI Engine (surface nodes), not by hardcoded routes.
It is the canonical authoring tool for process definitions, task templates, and bindings.
Layout copy, labels, and placeholders are supplied by the admin surface JSON (`props.layout`) so the UI engine remains the source of truth.

**Admin surface seed**
- Generator: `tools/build_ui_surface_admin_seed.mjs`
- Seed output: `services/api/db/seed/ui_surface_admin.sql`
- Load after migration `0046_ui_surface_engine.sql`:
  ```sql
  \i services/api/db/seed/ui_surface_admin.sql
  ```

**Data sources**
- `GET /api/eip/process/taxonomy` for node/edge/effect/action dropdowns.
- `GET /api/eip/process/defs` and `GET /api/eip/process/defs/:id` for process definitions.
- `GET /api/eip/process/task-templates` and `GET /api/eip/process/bindings` for attachments to the definition.

**Lifecycle**
1. Create a process definition (code, name, object type).
2. Define nodes, transitions, and effects.
3. Save, then run validation (`POST /api/eip/process/defs/:id/validate`).
4. Publish when validation passes (`POST /api/eip/process/defs/:id/publish`).
5. Attach task templates and bindings to route service objects into the process engine.

**Non-negotiable**
- The UI never hardcodes task actions or node/effect types.
- All actions are derived from governed dropdowns.
- Module code only submits JSON payloads to the core process engine.

**How to create a process (quick guide)**
1. **Create definition**: Click `Add`, enter `Code`, `Name`, `Service Object Type`, and choose the `Initial Node`.
2. **Build nodes**: Add nodes in execution order. Use `TRIGGER` for the start and `TERMINAL` for the end. Keep node IDs stable.
3. **Add transitions**: Connect nodes with explicit transitions. Use `ROUTER` for branching and `JOIN` to merge branches (no implicit merges).
4. **Attach effects**: On transitions, add effects from the taxonomy (e.g., `STATUS_SET`, `TASK_CREATE`, `JSON_MERGE`). Effects must be valid types.
5. **Define task templates**: For `HUMAN_TASK` nodes, create task templates and set allowed actions + completion action from taxonomy.
6. **Bind service objects**: Add bindings so service object types route into this process (optional task type and priority).
7. **Validate & publish**: Save, run validation, then publish. Validation must pass before publish.

**Troubleshooting**
- Missing dropdown values: check `/api/eip/process/taxonomy`.
- Validation errors: ensure every branch merges with a `JOIN` and every `HUMAN_TASK` has a template.
- No runtime effects: confirm bindings are active and object types match the service object.

### CRM Routes (`src/routes/crm.js`)

#### POST /cases
Create support case
```javascript
// Request
{
  "title": "Login Issue",
  "description": "Cannot access account",
  "customer_agent_id": "uuid"
}

// Response
{
  "ok": true,
  "case": { "id": "uuid", "status": "new" },
  "process_instance": { "id": "uuid" }
}
```

**Why process integration**: Cases automatically follow defined workflows.

### UI Surface Routes

**Files**: `src/routes/ui_surface.js`

**Purpose**: Serve JSON UI surfaces (engine tree) from the database as the single source of truth.

#### GET /api/public/ui/surfaces/:code
Public (unauthenticated) surface fetch. Only returns `is_public=true` + `is_published=true`.

```
GET /api/public/ui/surfaces/auth
GET /api/public/ui/surfaces/auth?tenant_code=samara
```

#### GET /api/eip/ui/surfaces/:code
Authenticated surface fetch scoped to tenant. Falls back to global (tenant_id NULL).

```
GET /api/eip/ui/surfaces/dashboard
```

**Notes**:
- Surfaces are stored in `eip_core.ui_surface` with `tree` JSON.
- Use `is_published=true` for production surfaces, `is_public=true` for login/marketing.

### Gateway Connection Profiles

**Files**: `src/routes/gateway.js`, `src/routes/public_gateway.js`

**Purpose**: Generic, tenant-driven gateway configuration for any external connection (website, e-commerce, banking, EDI, social, email, custom) with no provider assumptions.

**Storage**:
- Profiles live in `eip_core.tenant.attrs.connection_profiles` (JSONB array).
- No module tables are touched. All intake is logged via `eip_core.info_record`.

#### Admin (EIP) Control Plane
**Endpoints** (all require session + CSRF + step-up + permissions):
- `GET /api/eip/gateway/connections` — tenant list + connection summary
- `GET /api/eip/gateway/connections/:tenantId` — full profile + API keys + health/logs
- `POST /api/eip/gateway/connections/:tenantId/profile` — save profiles
- `POST /api/eip/gateway/connections/:tenantId/test/inbound` — simulate inbound
- `POST /api/eip/gateway/connections/:tenantId/test/outbound` — simulate outbound
- `POST /api/eip/gateway/connections/:tenantId/api-keys` — create key (raw returned once)
- `POST /api/eip/gateway/connections/:tenantId/api-keys/:keyId/revoke` — revoke
- `POST /api/eip/gateway/connections/:tenantId/api-keys/:keyId/rotate` — rotate

#### Public Gateway
- `GET /api/public/gateway/bootstrap?connection_code=...&template_code=...`
- `GET /api/public/gateway/manifest/:templateCode/:objectId?`
- `POST /api/public/gateway/intake/:suffix`
- `POST /api/edi/gateway/webhook/:suffix`

**Deterministic URLs**:
Inbound endpoints are generated from `inbound.inbound_path_suffix`:
```
{base}/api/public/gateway/intake/{suffix}
{base}/api/edi/gateway/webhook/{suffix}
```

**Security**:
- API key validated against `eip_auth.auth_api_key` (hash only stored).
- Origin/IP allowlist enforced per connection profile.
- HMAC / API key / OAuth2 JWT verification supported (configurable).
- Idempotency enforced via `eip_core.idempotency_key`.
- Handshakes and denials logged to `eip_core.info_record`.

**Key Tables**:
- `eip_core.tenant` (attrs.connection_profiles)
- `eip_auth.auth_api_key`
- `eip_core.idempotency_key`
- `eip_core.info_record`
- `eip_core.ui_surface` (optional mapping in attrs)

**Admin Console**:
- Connections are managed under Admin Console > **Connections**.
- Wizard sections: Identity, Inbound, Outbound, Security, Idempotency, Routing, Audit.
- Every button is wired (save, test, copy, key rotation).

#### Field Guide (What each section means)
This is the operational "how to fill it" guide. Every field exists because the gateway uses it at runtime.

**Identity**
- `connection_name` (required): Human label used in the admin UI.
- `connection_code` (system-generated): URL-safe identifier used internally for tests and lookup. It is generated from `connection_name` and should not be manually edited.
- `connection_kind` (required): Classifies the connection (website, ecommerce, banking, edi, social, email, custom). No provider assumptions.
- `frontend_url` / `portal_url` (website/ecommerce only): Used to pre-fill origin allowlist and show the correct partner URLs.
- `direction` (required): inbound, outbound, or both.
- `environment` (required): sandbox or production.
- `is_enabled`: when false, gateway rejects the connection.

**Inbound (Partner -> EIP)**
- `inbound_path_suffix` (required): Used to build deterministic intake URLs:
  - `{base}/api/public/gateway/intake/{suffix}`
  - `{base}/api/edi/gateway/webhook/{suffix}`
- `http_method` (required): POST/PUT/PATCH only.
- `expected_content_type` (required): Enforced on inbound requests.
- `origin_allowlist` (recommended): Origin validation for browser-based partners.
- `raw_body_required` (required for signatures): Ensures signature checks can use raw payload.

**Security / Verification**
- `verification.mode`: none, api_key, hmac_signature, oauth2_jwt.
- `api_key`: header name + secret (shared secret, never logged).
- `hmac_signature`: header name + algorithm + encoding + secret + optional timestamp header.
- `oauth2_jwt`: header name + issuer + audience + jwks_url or shared secret.

**Idempotency**
- `event_id_location` (required): header or body.
- `event_id_key` (required): header name or JSON path key.
- `idempotency_scope` (recommended): lets the gateway isolate duplicate events per connection or tenant.

**Outbound (EIP -> Partner)**
- `base_url` + `path_prefix` (required): Deterministic outbound request builder.
- `auth_mode`: none, bearer_token, api_key_header, basic, oauth2_client_credentials.
- `auth` parameters: required based on the selected auth_mode.
- `default_headers`: static headers always sent.
- `timeout_ms`, `retry_policy`, `healthcheck_path`, `test_request_method`.

**Routing**
- `channel` (required): website_intake, edi, banking, payments, social, email, custom.
- `protocol` (required for edi/banking/payments): HTTPS, SFTP, AS2, FTP, MQ, SMTP, WebSocket.
- `schema_version` and `envelope_profile` (required): canonical envelope defaults.
- `mapping_mode` + `mapping_rules`: passthrough or mapped.
- `require_process_binding` (optional): when true, commerce order/payment creation requires an active process_binding.

**Audit**
- `audit_record_type` (required): default `GATEWAY_AUDIT`.
- `redaction_policy`: JSON-based redaction rules.
- `max_body_size`: enforces payload limit.
- `ip_allowlist`: optional IP restriction (server-to-server).
- `log_level`: error|warn|info|debug.

#### Practical Examples (what to configure)
- **Website / E-commerce**: frontend_url + origin_allowlist + inbound_path_suffix. Optional outbound if EIP needs to call the tenant.
- **EDI**: protocol + strict content_type + idempotency + raw body capture for signatures.
- **Banking/Payments**: protocol + oauth2 or api_key auth + strict idempotency.
- **Social/Email**: typically inbound only, with origin/IP allowlist and signature verification.

#### Runtime Behavior (why these fields exist)
- Inbound requests build deterministic URLs (prevents 404s).
- Auth and signature verification are driven entirely by the profile.
- Idempotency is mandatory and enforced for all inbound integrations.
- No business data is mutated here; only intake/audit records are written.

### Public Commerce Routes (Deprecated)

**File**: `src/routes/public_commerce.js`

**Status**: Deprecated and not registered in `server.js`.

**Why**: There is one public gateway. All external traffic (landing pages, ecommerce, portals, integrations)
must enter through the single Gateway (`/api/public/gateway/*`). This prevents parallel gateways and
keeps perimeter behavior consistent and policed.

**Current guidance**:
- Use `POST /api/public/gateway/intake/:suffix` for inbound events.
- Use process bindings to move sales, payment, and delivery through the core process engine.
- Use UI surfaces (`/api/public/gateway/manifest`) to render public storefront views when needed.

Legacy endpoints listed below are kept only as reference and must not be exposed in production.
- To enforce this, set `routing.require_process_binding = true` in the connection profile. If missing, the request fails with `PROCESS_BINDING_REQUIRED`.

**Idempotency**:
- Required for `order` and `payment`.
- Duplicate events are rejected with conflict or return replayed response.

**Digital delivery (access_grant)**:
- Entitlements are stored in `eip_core.access_grant` (token hash only).
- `redeem` transitions `active -> reserved` and returns content references.
- `confirm` transitions `reserved -> delivered` and increments use count.
- Use `ACCESS_GRANT_PEPPER` (or fallback to `API_KEY_PEPPER`) to hash tokens.
- Provide the token in body (`token`) or header (`X-Access-Token`).

### Plug & Play Connection Routes

**Purpose**: Server-driven UI bootstrap for external websites (Shadow DOM loader) using connection profiles and strict perimeter controls.

**Endpoints**:
- `GET /api/public/gateway/bootstrap?connection_code=...&template_code=...`
- `GET /api/public/gateway/manifest/:templateCode/:objectId?`

**Client assets**:
- `apps/dashboard/src/loader.js` (Shadow DOM loader)
- `plug-play-client.html` (sample integration)

**Contract**:
- Loader sends `X-API-Key` (or `Authorization: Bearer`) and optional `connection_code`.
- Gateway validates origin/ip/verification rules from the connection profile.
- UI Engine renders `ui_surface.tree` + mapped data; no module tables are mutated.

### Tenant Onboarding Checklist

**Goal**: Ensure a tenant website or ecommerce front-end can connect to EIP without 404s, auth failures, or idempotency bugs.

**Canonical checklist**: `docs/TENANT_ONBOARDING_CHECKLIST.md` (mark each item after completion).

**Connection profile (required)**
- Identity: `connection_name`, `connection_kind`, `direction`, `environment`, `is_enabled`.
- Inbound: `inbound_path_suffix` (unique), `http_method`, `expected_content_type`.
- Routing: `channel` = `website_intake` or `payments` (or `custom`).
- Security: configure **one** verification mode (`api_key`, `hmac_signature`, or `oauth2_jwt`).
- Idempotency: set `event_id_location` + `event_id_key` (required for order/payment).
- Audit: set `audit_record_type`, optional `ip_allowlist`.

**Tenant data (required)**
- Materials: create `eip_core.material` rows for products (digital or physical).
- Commercial conditions: add `eip_core.commercial_condition` rows for PRICE, TAX, DISCOUNT, TERMS.

**Gateway sanity checks**
- Confirm deterministic URLs:
  - `/api/public/gateway/intake/{suffix}`
  - `/api/public/commerce/{suffix}/catalog`
- Confirm origin allowlist includes the tenant website URL.

**Test sequence**
1. `catalog` (GET) for products
2. `quote` (POST) for pricing/tax/discount
3. `order` (POST) with idempotency key
4. `payment` (POST) with idempotency key

**Operational checks**
- Verify `info_record` entries exist for order/payment.
- Verify `service_object` rows created for `sales_order` and `payment`.
- Confirm idempotency prevents duplicates on retry.

### Ecommerce Routes (Internal)

These routes power the **Product Studio** UI and are tenant-scoped.

**Base path**: `/api/eip/ecom`

**Endpoints**
- `GET /products` (list, supports `q` and `limit`)
- `POST /products` (create; if `code` is blank, server auto-generates it)
- `GET /products/:id` (load details)
- `PATCH /products/:id` (update fields + attrs JSON)
- `POST /products/:id/actions` (process actions)
- `POST /uploads` (multipart file upload -> local `/assets` URL)

**Actions**
- `DRAFT_READY` (move to review stage)
- `APPROVE` / `REJECT`
- `PUBLISH`

**Permissions**
- Read: `ECOM_PRODUCT_READ`
- Write: `ECOM_PRODUCT_WRITE`

If the UI shows `API 403`, the identity is missing the required permission or role.

### Industry Template Tenants (eip_ecom, eip_textile, eip_pharma)

We use template tenants to separate platform-wide templates by industry. This avoids starting from scratch for every tenant.

**Approach**
- Create a template tenant per industry (e.g., `eip_ecom`) with `tenant.attrs.template = true`.
- Seed process_def, task_template, process_binding, dropdowns, schema_registry/bundle, ui_surface, and commercial_condition under the template tenant.
- Clone the template into a real tenant (e.g., Samara) and then customize.

**Seed + clone SQL**
- Create the template tenant: `services/api/db/seed/tenant_template_ecom.sql`
- Clone template to target: `services/api/db/seed/clone_template_to_tenant.sql`

**Why**
- The JSON that drives process and UI differs by industry.
- Cloning a template keeps workflows and UI consistent while saving time.

**Future**
- Add an Admin Console panel to select a template and clone into a tenant.

### Future Enhancement (Not Priority): Auto-Generated Forms from Table Metadata

We may later allow a form UI to be derived from one or more tables (and optional joins). The UI engine would:
- read table structure,
- generate a default form schema,
- and render via the UI engine without hand-authored JSON.

This is a future optimization to reduce form configuration overhead. It is **not** part of the current scope to avoid disrupting the existing engine-driven approach.

## Security Implementation

### CSRF Protection

**Mechanism**: Double-submit cookie pattern with server-side validation

**Client Request Setup**:
```javascript
// Client must send token in both header and cookie
const csrfToken = getCsrfTokenFromCookie(); // Read from 'csrf' cookie
headers: {
  'x-csrf': csrfToken,  // Custom header with token value
  'Content-Type': 'application/json'
}
cookies: {
  csrf: csrfToken  // Same token in httpOnly cookie
}
```

**Server Validation Process**:
```javascript
// 1. Extract tokens from request
const csrfHeader = req.headers['x-csrf'];     // From custom header
const csrfCookie = req.cookies?.csrf;         // From httpOnly cookie

// 2. Verify both tokens match (prevent header injection)
if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
  return { ok: false, status: 403, error: "CSRF_MISSING" };
}

// 3. Validate against server-side session hash
const expected = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
if (!timingSafeEqual(expected, session.csrf_secret_hash)) {
  return { ok: false, status: 403, error: "CSRF_INVALID" };
}

// 4. Success - allow state-changing operation
return { ok: true };
```

**Why this approach**:
- **Double submission**: Prevents header-only attacks
- **Server validation**: Uses peppered hash for additional security
- **Timing safe**: Prevents timing attacks on validation
- **Stateless**: No server-side storage needed beyond session

### Session Security

**Features**:
- HTTP-only cookies prevent XSS theft
- Secure flag enforces HTTPS in production
- SameSite protection against CSRF
- Automatic expiration and revocation

**Cookie Configuration Details**:
```javascript
// Session ID cookie (most critical)
reply.setCookie("sid", sessionId, {
  path: "/",                    // Available on all paths
  httpOnly: true,              // Prevent JavaScript access (XSS protection)
  secure: isProd,              // HTTPS only in production
  sameSite: "lax",             // Allow top-level navigation
  expires: sessionExpires      // Automatic cleanup
});

// CSRF token cookie
reply.setCookie("csrf", csrfToken, {
  path: "/",                    // Available for all API calls
  httpOnly: false,             // Client JS needs to read this
  secure: isProd,              // HTTPS only in production
  sameSite: "lax",             // Allow cross-site top-level navigation
  expires: sessionExpires      // Match session lifetime
});

// Device tracking cookie
reply.setCookie("did", deviceToken, {
  path: "/",                    // Available on all paths
  httpOnly: true,              // Prevent JavaScript access
  secure: isProd,              // HTTPS only in production
  sameSite: "lax",             // Allow navigation
  expires: deviceExpires       // Long-lived (90 days)
});
```

### Password Security

**Algorithm Selection**: Argon2id (primary), Scrypt (legacy fallback)

**Password Hashing Process**:
```javascript
// Primary: Argon2id (recommended for new installations)
const secretHash = await argon2.hash(password, {
  type: argon2.argon2id,      // Memory-hard algorithm
  memoryCost: 65536,         // 64 MB memory usage
  timeCost: 3,               // 3 iterations
  parallelism: 1,            // Single thread
  hashLength: 32             // 256-bit output
});

// Legacy: Scrypt (for backward compatibility)
const secretHash = await scryptAsync(password, salt, 64, {
  N: 16384,                   // CPU/memory cost
  r: 8,                       // Block size
  p: 1                        // Parallelization
});
```

**Verification Process**:
```javascript
// Timing-safe comparison prevents timing attacks
const isValid = await argon2.verify(storedHash, providedPassword);
if (!isValid) {
  // Log failed attempt (rate limiting applied elsewhere)
  return false;
}
return true;
```

**Why Argon2**:
- **Memory-hard**: Resists GPU/ASIC attacks
- **Configurable**: Adjustable memory/CPU/time costs
- **Standardized**: IETF RFC 9106
- **Future-proof**: Better than PBKDF2/SCrypt for password hashing

## Process Engine Deep Dive

### Graph Execution Flow

1. **Process Creation**:
   - Validate graph structure and object type compatibility
   - Initialize cursor at `initial_node`
   - Apply on-enter task templates

2. **State Advancement**:
   - Find matching transition for requested action
   - Execute effects in database transaction
   - Update cursor and record history
   - Apply on-enter effects for new node

3. **Effect Processing**:
   - `so_create`: Generate related business objects
   - `so_status`: Update status with audit trail
   - `task_create`: Add workflow tasks
   - `link`: Establish object relationships

### Effects System

Effects are declared on transitions (`process_def.graph.transitions.effects`) and executed
inside the same database transaction that advances the process cursor.

**Validation + taxonomy**
- Effect types are validated against `eip_core.dropdown_list` where `code = PROCESS_EFFECT_TYPE`.
- This list is also used by the Process Builder UI to populate the dropdown.

**Handler registry**
- Runtime dispatch is implemented in `services/api/src/core/core_process_engine.js`
  via the `EFFECT_HANDLER_REGISTRY`.
- Adding a new effect requires:
  1) add the dropdown value (migration/seed),
  2) implement the handler in the registry.

**Key effect types in use**
- `STATUS_SET`, `JSON_MERGE`, `TASK_CREATE`, `TASK_STATUS`
- `ACCESS_GRANT_CREATE` (digital entitlement delivery)
- `INVENTORY_MOVE`, `INVENTORY_CONSUME`, `INVENTORY_PRODUCE`, `INVENTORY_CONVERT`

### Idempotency Handling

**Mechanism**: Digest-based duplicate detection
```javascript
const historyEntry = {
  idempotency_key: idempotencyKey,
  payload_digest: buildIdempotencyDigest(payload),
  effects_applied: appliedEffects
};
```

**Use cases**:
- Retry failed API calls
- Handle duplicate webhook deliveries
- Ensure exactly-once processing

### Transactional Behavior

**Why transactions**: Ensures atomicity of complex state changes
```javascript
await client.query("BEGIN");
// ... multiple effect operations ...
await client.query("COMMIT");
```

**Locking strategy**: `FOR UPDATE` on affected rows prevents race conditions.

## Configuration Management

### System-wide Environment (.env)

**Single source of truth**: The repository root `.env` is the only environment file used by the API and the dashboard.
- **API** loads from root `.env` via Fastify `@fastify/env`.
- **Dashboard (Vite)** loads from root `.env` using `envDir` in `apps/dashboard/vite.config.js`.
- Use `VITE_` prefixes for frontend-exposed variables (e.g., `VITE_API_BASE_URL`).
- Optional: `ACCESS_GRANT_PEPPER` for entitlement token hashing (falls back to `API_KEY_PEPPER`).

**Password reset + recovery variables**:
- `PASSWORD_RESET_URL_BASE`: Base URL used in reset links (e.g., `https://app.example.com/auth?reset=`).
- `PASSWORD_RESET_PEPPER`: Server-side pepper for hashing reset tokens.
- `RECOVERY_TOKEN_URL_BASE`: Base URL used in recovery links (e.g., `https://app.example.com/auth?recovery=`).
- `RECOVERY_TOKEN_PEPPER`: Server-side pepper for hashing recovery tokens.
- `RECOVERY_TOKEN_TTL_MIN`: Token lifetime in minutes (default 30).
- `ALLOW_RECOVERY_NO_TOTP`: Dev-only override (set `false` in production).

### Security toggles (env flags)

```
ENABLE_DEBUG_ROUTES=false
ENABLE_PUBLIC_DB_HEALTH=false
LOG_DEV_OTP=false
PUBLIC_TENANT_GUARD=true
```

**Note**: keep debug/public health disabled in production.

### Environment Schema Validation

**Purpose**: Ensures all required configuration is present at startup.

```javascript
const envSchema = {
  type: "object",
  required: ["NODE_ENV", "DB_HOST", "API_KEY_PEPPER"],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    DB_HOST: { type: "string", default: "localhost" },
    // ... more properties
  }
};
```

**Benefits**:
- Fail-fast on configuration errors
- Type safety for environment variables
- Default values for optional settings

### Tenant Agreements

**Purpose**: Require specific terms acceptance for production tenants.

```bash
REQUIRED_TENANT_AGREEMENTS=TERMS_OF_SERVICE:v1.0,PRIVACY_POLICY:v2.1
```

**Why**: Legal compliance and version tracking.

## Development Best Practices

### Code Organization

**File Structure**:
```
src/
├── server.js          # Main application setup
├── routes/           # Feature-specific route handlers
├── plugins/          # Fastify plugins
├── core/            # Business logic engines
├── auth/            # Authentication utilities
└── lib/             # Shared utilities
```

### Error Handling

**Consistent response format**:
```javascript
// Success
{ "ok": true, "data": {...} }

// Error
{ "ok": false, "error": "INVALID_REQUEST" }
```

**HTTP status codes**:
- 200: Success
- 400: Bad request (validation errors)
- 401: Authentication required
- 403: Authorization failed
- 404: Resource not found
- 500: Server error

### Database Patterns

**Connection management**:
```javascript
const client = await app.db.connect();
try {
  await client.query("BEGIN");
  // ... operations ...
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
}
```

**Query optimization**:
- Tenant-scoped queries: `WHERE tenant_id = $1`
- Indexed foreign keys
- Efficient JSONB operations

## Testing Strategy

### Happy Path Scripts

**Purpose**: End-to-end workflow validation using shell scripts.

**Coverage**:
- User onboarding flow (`onboarding_happy_path.sh`)
- CRM case lifecycle (`crm_happy_path.sh`)
- Process engine execution (`core_process_happy_path.sh`)

**Example script structure**:
```bash
#!/bin/bash
# Authenticate and get session
curl -X POST http://localhost:4000/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"demo","email":"admin@example.com","password":"password"}'

# Extract OTP from logs and verify
# ... continue with workflow steps
```

### Manual Testing Checklist

**API Testing**:
- [ ] All endpoints return correct status codes
- [ ] Authentication guards work properly
- [ ] Permission checks are enforced
- [ ] Data validation prevents invalid inputs
- [ ] Rate limiting is functional

**Security Testing**:
- [ ] CSRF protection active
- [ ] Session management secure
- [ ] Input sanitization working
- [ ] HTTPS enforcement in production

## Deployment Architecture

### Production Setup

**Infrastructure**:
- Load balancer with SSL termination
- Application servers with PM2 process management
- PostgreSQL with replication and backups
- Redis for session storage (optional)
- Email service for notifications

**Environment variables**:
```bash
NODE_ENV=production
DB_HOST=prod-db.example.com
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
# ... security secrets ...
```

### Scaling Considerations

**Horizontal scaling**:
- Stateless application design
- Shared database with proper indexing
- Session storage in database (no sticky sessions needed)
- File storage abstraction (S3, etc.)

**Database scaling**:
- Connection pooling optimization
- Query performance monitoring
- Index maintenance
- Read replica usage for reporting

## Troubleshooting Guide

### Common Issues

**Database Connection**:
```bash
# Check environment variables
echo $DB_HOST $DB_USER $DB_PASSWORD

# Test connection
psql -h $DB_HOST -U $DB_USER -d $DB_DATABASE -c "SELECT 1"
```

**Authentication Problems**:
- Verify cookie settings in browser dev tools
- Check CORS configuration
- Validate secret keys match between client/server

**Process Engine Issues**:
- Validate graph JSON structure
- Check permission assignments
- Review database constraints

### Debug Tools

**Debug Routes** (`src/routes/_debug.js`):
```javascript
// GET /api/eip/_debug/env - Environment inspection
// GET /api/eip/_debug/db - Database connectivity tests
// GET /api/eip/_debug/permissions - Permission validation
```

**Logging**:
- Structured JSON logging with Pino
- Request/response tracing
- Error stack traces with context

## Extension Points

### Adding New Modules

1. **Database Schema**: Create migration for new tables
   ```sql
   -- db/migrations/0045_new_module.sql
   CREATE TABLE eip_core.new_entity (...);
   ```

2. **Permissions**: Add module-specific permissions
   ```sql
   -- Add to authz migrations
   INSERT INTO eip_authz.permission (code, name, module)
   VALUES ('NEW_MODULE_READ', 'Read New Module', 'new_module');
   ```

3. **Routes**: Implement REST endpoints
   ```javascript
   // src/routes/new_module.js
   export default async function newModuleRoutes(app) {
     app.get("/new-module", async (req, reply) => {
       // implementation
     });
   }
   ```

4. **Process Integration**: Define workflow graphs
   ```json
   {
     "code": "new_workflow",
     "graph": {
       "object_type": "NEW_ENTITY",
       "initial_node": "draft",
       "transitions": [...]
     }
   }
   ```

### Customizing Business Logic

**Process Definitions**: JSON-based workflow configuration
**Effects System**: Extensible action framework
**Validation Rules**: Configurable dropdown lists
**Email Templates**: Customizable notification content

## Performance Optimization

### Database Tuning

**Indexing Strategy**:
```sql
-- Composite indexes on tenant-scoped queries
CREATE INDEX idx_service_object_tenant_status
ON eip_core.service_object (tenant_id, status);

-- JSONB path indexes for attributes
CREATE INDEX idx_service_object_attrs
ON eip_core.service_object USING gin (attrs jsonb_path_ops);
```

**Query Optimization**:
- Tenant-scoped queries prevent cross-tenant access
- Efficient pagination with cursors
- Batch operations for bulk updates

### Application Performance

**Caching**:
- LRU cache for tenant validation (5-minute TTL)
- Database query result caching
- Static asset caching headers

**Async Processing**:
```javascript
// Non-blocking email sending
void sendEmail(app, to, subject, text, html).catch((err) => {
  app.log.error({ event: "email_failed", error: err.message });
});
```

**Connection Pooling**:
```javascript
const pool = new Pool({
  host: app.config.DB_HOST,
  max: app.config.PG_POOL_MAX, // Default: 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## 15. Operational Procedures

### 15.1 Backup & Recovery

**Database Backup Strategy**:
- **Full Backups**: Daily at 2 AM UTC using `pg_dump`
- **Incremental Backups**: Hourly WAL archiving
- **Point-in-Time Recovery**: 7-day retention window
- **Offsite Storage**: Encrypted backups in S3 with cross-region replication

**Backup Commands**:
```bash
# Full database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_DATABASE \
  --format=custom --compress=9 --verbose \
  --file="/backups/eip_core_$(date +%Y%m%d_%H%M%S).backup"

# Continuous WAL archiving
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
```

**Recovery Procedures**:
1. **Point-in-Time Recovery**:
   ```bash
   # Stop application servers
   pm2 stop all

   # Restore base backup
   pg_restore -h $DB_HOST -U $DB_USER -d postgres \
     --create --clean /backups/base.backup

   # Apply WAL files up to target time
   pg_waldump /archive/ | head -n 100
   ```

2. **Full Database Recovery**:
   ```bash
   # Drop and recreate database
   psql -h $DB_HOST -U $DB_USER -d postgres \
     -c "DROP DATABASE IF EXISTS $DB_DATABASE;"
   psql -h $DB_HOST -U $DB_USER -d postgres \
     -c "CREATE DATABASE $DB_DATABASE;"

   # Restore from backup
   pg_restore -h $DB_HOST -U $DB_USER -d $DB_DATABASE \
     --verbose /backups/full.backup
   ```

**Business Continuity**:
- **RTO (Recovery Time Objective)**: 4 hours for critical systems
- **RPO (Recovery Point Objective)**: 1 hour data loss tolerance
- **Multi-AZ Deployment**: Automatic failover within same region
- **Cross-Region DR**: Manual activation for disaster scenarios

### 15.2 Monitoring & Alerting

**Application Metrics**:
```javascript
// Key metrics to monitor
const metrics = {
  http_request_duration_seconds: {
    type: 'histogram',
    help: 'HTTP request duration in seconds'
  },
  http_requests_total: {
    type: 'counter',
    help: 'Total number of HTTP requests',
    labels: ['method', 'route', 'status_code']
  },
  db_connection_pool_size: {
    type: 'gauge',
    help: 'Database connection pool size'
  },
  process_instance_active: {
    type: 'gauge',
    help: 'Number of active process instances',
    labels: ['tenant_id']
  }
};
```

**Alerting Rules**:
```yaml
# Prometheus alerting rules
groups:
  - name: eip_core_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% over last 5 minutes"

      - alert: DatabaseConnectionPoolExhausted
        expr: db_connection_pool_active_connections / db_connection_pool_max_connections > 0.9
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool nearly exhausted"
```

**Log Aggregation**:
```javascript
// Structured logging with context
app.log.info({
  event: 'user_login',
  tenantId: tenantId,
  identityId: identityId,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});
```

**Health Check Endpoints**:
```javascript
// GET /api/public/health
app.get('/health', async (req, reply) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    checks: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      smtp: await checkSMTPHealth()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.healthy);
  reply.code(isHealthy ? 200 : 503).send(health);
});
```

### 15.3 Incident Response

**Severity Levels**:
- **P0 (Critical)**: Complete system outage, data loss
- **P1 (High)**: Major functionality broken, significant user impact
- **P2 (Medium)**: Minor functionality issues, partial user impact
- **P3 (Low)**: Cosmetic issues, no functional impact

**Incident Response Process**:

1. **Detection**:
   - Automated monitoring alerts
   - User-reported issues
   - Performance degradation detection

2. **Assessment**:
   ```bash
   # Quick system check
   curl -f https://api.eip-core.com/api/public/health

   # Database connectivity
   psql -h $DB_HOST -U $DB_USER -d $DB_DATABASE -c "SELECT 1;"

   # Application logs
   pm2 logs --lines 100
   ```

3. **Containment**:
   - Scale out additional instances
   - Enable circuit breakers
   - Redirect traffic to healthy regions

4. **Recovery**:
   - Roll back to last known good state
   - Apply database fixes
   - Restart services with updated configuration

5. **Post-Mortem**:
   - Root cause analysis
   - Timeline documentation
   - Prevention measures
   - Knowledge base updates

**Runbooks**:
- **Database Failover**: Automated promotion of read replica
- **Application Deployment**: Blue-green deployment strategy
- **Security Incident**: Isolation and forensic analysis procedures

## 16. Compliance & Security

### 16.1 GDPR Compliance

**Data Subject Rights Implementation**:

**Right to Access**:
```javascript
// GET /api/eip/privacy/data-request
app.get('/data-request', async (req, reply) => {
  const { request_type, identity_id } = req.query;

  if (request_type === 'access') {
    // Collect all personal data for user
    const personalData = {
      identity: await getIdentityData(identity_id),
      sessions: await getSessionHistory(identity_id),
      activities: await getActivityLog(identity_id),
      consents: await getConsentHistory(identity_id)
    };

    // Log data access request
    await logDataAccessRequest(identity_id, 'access', req.ip);

    return reply.send({
      ok: true,
      data: personalData,
      retention_period: '7 days' // Auto-delete after download
    });
  }
});
```

**Right to Erasure (Right to be Forgotten)**:
```javascript
// POST /api/eip/privacy/data-erasure
app.post('/data-erasure', async (req, reply) => {
  const { identity_id, reason } = req.body;

  // Start erasure transaction
  const client = await app.db.connect();
  try {
    await client.query('BEGIN');

    // Anonymize instead of delete for audit/compliance
    await client.query(`
      UPDATE eip_auth.auth_identity
      SET login = CONCAT('deleted_', id),
          is_active = false,
          attrs = jsonb_set(attrs, '{erased}', 'true'::jsonb)
      WHERE id = $1
    `, [identity_id]);

    // Log erasure event
    await client.query(`
      INSERT INTO eip_core.info_record
        (tenant_id, object_type, data)
      VALUES ($1, 'gdpr_erasure', $2)
    `, [req.auth.tenant_id, {
      identity_id,
      reason,
      timestamp: new Date().toISOString(),
      performed_by: req.auth.principal_id
    }]);

    await client.query('COMMIT');

    return reply.send({ ok: true, message: 'Data erased successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
```

**Data Processing Records**:
```sql
-- GDPR Article 30 compliance
CREATE TABLE eip_core.gdpr_processing_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  purpose text NOT NULL, -- e.g., 'user_authentication', 'crm_management'
  legal_basis text NOT NULL, -- e.g., 'consent', 'contract', 'legitimate_interest'
  data_categories text[] NOT NULL, -- e.g., ['personal_data', 'contact_details']
  recipients text[] DEFAULT '{}', -- Third parties receiving data
  retention_period interval NOT NULL,
  dpo_contact text,
  created_at timestamptz DEFAULT now()
);
```

**Data Protection Impact Assessment (DPIA)**:
- **High-Risk Processing**: Automated decision-making, large-scale monitoring
- **Risk Mitigation**: Privacy by design, data minimization, pseudonymization
- **Assessment Triggers**: New feature deployments, data processing changes

### 16.2 Security Standards

**ISO 27001 Compliance Framework**:

**Information Security Policy**:
```javascript
// Security policy enforcement
const securityPolicy = {
  password_policy: {
    min_length: 12,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_symbols: true,
    prevent_reuse: 5, // Last 5 passwords
    max_age_days: 90
  },
  session_policy: {
    max_concurrent_sessions: 5,
    idle_timeout_minutes: 30,
    absolute_timeout_hours: 12,
    remember_me_days: 30
  },
  access_control: {
    principle_of_least_privilege: true,
    role_based_access: true,
    mandatory_access_control: false // Future enhancement
  }
};
```

**Security Controls Mapping**:
| ISO 27001 Control | EIP Core Implementation |
|-------------------|-------------------------|
| A.9 Access Control | Multi-factor authentication, RBAC |
| A.10 Cryptography | Argon2 password hashing, TLS 1.3 |
| A.12 Operations Security | Audit logging, incident response |
| A.13 Communications Security | CSRF protection, secure headers |
| A.14 System Acquisition | Secure development lifecycle |

**Penetration Testing Schedule**:
- **External Testing**: Quarterly by certified third-party
- **Internal Testing**: Monthly by security team
- **Automated Scanning**: Daily vulnerability scans
- **Red Team Exercises**: Bi-annual adversarial simulations

### 16.3 Audit Requirements

**Audit Trail Implementation**:
```javascript
// Comprehensive audit logging
async function auditLog(action, req, additionalData = {}) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: action,
    actor: {
      type: req.auth?.principal_type || 'anonymous',
      id: req.auth?.principal_id || null,
      tenant_id: req.auth?.tenant_id || null
    },
    target: {
      resource: req.url,
      method: req.method,
      parameters: sanitizeParameters(req.params)
    },
    context: {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      session_id: req.cookies?.sid,
      correlation_id: req.headers['x-correlation-id']
    },
    changes: additionalData.changes || null,
    reason: additionalData.reason || null,
    compliance_flags: additionalData.compliance_flags || []
  };

  // Store in audit table
  await app.db.query(`
    INSERT INTO eip_core.audit_log
      (tenant_id, actor_id, action, resource, details, ip_address)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
  `, [
    req.auth?.tenant_id,
    req.auth?.principal_id,
    action,
    `${req.method} ${req.url}`,
    auditEntry,
    req.ip
  ]);

  // Send to SIEM system
  await sendToSIEM(auditEntry);
}
```

**Audit Log Schema**:
```sql
CREATE TABLE eip_core.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES eip_core.tenant(id),
  actor_id uuid, -- Can be identity, api_key, or system
  action text NOT NULL, -- e.g., 'user_login', 'data_access', 'config_change'
  resource text NOT NULL, -- e.g., 'POST /api/eip/auth/login'
  details jsonb NOT NULL, -- Full audit context
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now(),

  -- Partitioning for performance
  PARTITION BY RANGE (created_at)
);

-- Retention policy: 7 years for financial, 2 years for operational
CREATE POLICY audit_retention ON eip_core.audit_log
  USING (created_at > now() - interval '7 years');
```

**Compliance Reporting**:
```javascript
// Automated compliance reports
app.get('/api/eip/compliance/report', async (req, reply) => {
  const { report_type, start_date, end_date } = req.query;

  switch (report_type) {
    case 'gdpr_access_requests':
      return await generateGDPRReport(start_date, end_date);
    case 'security_incidents':
      return await generateSecurityReport(start_date, end_date);
    case 'audit_trail':
      return await generateAuditReport(start_date, end_date);
    default:
      return reply.code(400).send({ error: 'Invalid report type' });
  }
});
```

**Regulatory Compliance Checklist**:
- [ ] GDPR: Data protection officer appointed
- [ ] GDPR: Privacy impact assessments conducted
- [ ] GDPR: Data processing records maintained
- [ ] ISO 27001: Information security management system
- [ ] SOC 2: Trust services criteria met
- [ ] PCI DSS: Payment card data protection (if applicable)
- [ ] HIPAA: Protected health information safeguards (if applicable)

### 16.4 Production Security Launch Backlog (Do Not Skip)

Context snapshot (March 2026):
- Current security maturity estimate: 7/10.
- Best-in-class SaaS benchmark: 9.0-9.5/10.
- Objective for production launch: move from implementation-focused security to audited operational security.

Mandatory backlog before/at production launch:
1. Perform formal threat modeling and recurring third-party penetration testing.
2. Add automated security regression checks in CI/CD (authz, CSRF, idempotency/replay, tenant isolation, gateway policy).
3. Enforce production-only security policy gates:
   - HTTPS everywhere
   - secure cookie flags in production
   - session rotation and strict idle timeout validation
   - step-up checks for sensitive admin actions
4. Remove or hard-disable all development/testing shortcuts in production builds and runtime.
5. Implement centralized security monitoring and incident response playbooks (alerts, triage, escalation, containment, postmortem).

Architecture alignment items (already agreed, must remain in scope):
- Keep all new behavior process-driven in EIP (no untracked route-level bypass logic).
- Complete migration of any remaining direct-write lifecycle flows to process-engine transitions.
- Keep tenant isolation test coverage mandatory for every release.

---

This comprehensive manual provides external developers with everything needed to understand, maintain, and extend the EIP Core ERP system. The modular architecture and thorough documentation enable confident development and deployment.
