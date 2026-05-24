# EIP V1 Monetization And Extension Plan

Date: 2026-05-24

## Intent

This document captures the agreed V1 direction while V2 is built separately.

V1 should be stabilized and extended as a monetizable multi-tenant product without disturbing the current working setup, hosted deployment model, or the external storefront contract.

## Core Rule

Do not redesign V1 into V2.

Only additive work is allowed in V1:
- hardening
- abstraction
- reusable module completion
- new capability layers that do not break the existing external storefront and admin/dashboard contract

## What Must Stay Stable

- External storefronts remain external and do not use `/api/eip/*` directly.
- Storefront connection stays simple: one Admin-generated endpoint and one browser-safe API key.
- Admin > Connections remains the source of truth for tenant/channel connection configuration.
- Current Samara setup remains valid.
- Security work already merged stays in place.

## V1 Commercialization Goal

Make V1 usable for multiple tenant websites and both digital and physical commerce while keeping the current Railway deployment working.

## Required Additive Capability Waves

### Wave A — Physical Commerce Layer

Add physical-product capability without replacing the existing ecommerce base.

Scope:
- SKU/variant inventory
- stock ledger / movement history
- on-hand / reserved / available quantities
- warehouse / location / bin support
- reservation / allocation to sales orders
- receiving
- pick / pack / ship flow
- low-stock and replenishment triggers

Principle:
Digital fulfillment keeps working. Physical fulfillment is added as a governed extension.

### Wave B — Procurement Lite

Add enough procurement to support physical-commerce tenants.

Scope:
- supplier master
- purchase requisition
- purchase order
- goods receipt
- supplier follow-up status
- receiving integration to inventory

Principle:
Do not attempt full finance in V1. Keep it operational and commerce-supporting.

### Wave C — CRM Completion

CRM already exists in V1 and should be completed, not restarted.

Target scope:
- leads
- opportunities
- interactions / timeline
- tasks / follow-ups
- account/contact linkage
- linkage to orders and service objects

Principle:
Use the existing CRM route/module foundation and extend it into a reusable tenant-ready module.

### Wave D — Content Studio Generalization

Content Studio must stop being implicitly coupled to Samara DOM structure.

Target model:
- EIP stores structured content, sections, fields, media refs, CTA metadata, publication state, and locale variants.
- Each tenant website uses a site adapter / renderer map to convert structured content into that website's DOM or component tree.

Principle:
Content Studio publishes structured payloads, not Samara-specific DOM assumptions.

## Multi-Tenant Product Packaging

Recommended V1 packaging:

### Core Commerce
- onboarding
- storefront endpoint
- product/content
- connections
- checkout integration

### Physical Commerce Add-on
- inventory
- receiving
- fulfillment
- procurement lite

### CRM Add-on
- leads
- interactions
- follow-up workflow

### Content Studio
- section-based publishing
- renderer/site adapter model

## Payment Direction

Default payment hub direction for V1:
- prefer Checkout.com as primary PSP for cards / Apple Pay / Google Pay and future tenant reuse
- PayPal can be added as an optional method rather than the main processing model
- EIP remains the integration hub and stores provider credentials server-side

## FX Direction

Current V1 repo defaults:
- primary FX provider: `openexchangerates`
- fallback FX provider: `ecb`

EIP should refresh/store FX data and serve prepared values to storefronts.

## Translation Direction

EIP remains the hub for translation integration.

Preferred V1 model:
- translate on change/publish where possible
- store prepared translations in EIP
- storefront reads translated content from EIP rather than translating live in the browser path

## Passkey Rollout Note

Current state:
- passkey login is exposed on the shared auth surface
- passkey management UI was added to the admin security panel
- tenant dashboard-specific passkey management UI is not yet assumed unless explicitly added later

Principle:
Passkey enforcement rollout remains staged and must not break current login flows.

## What Not To Backport Into V1

Do not push these into V1 if they require deep redesign:
- major kernel redesign
- process engine redesign
- deep schema reshaping better suited to V2
- changes that break the current external storefront contract
- changes that invalidate the current Railway deployment assumptions

## Success Criteria For V1 Monetization

V1 is good enough to monetize when:
- onboarding works for real tenants
- external storefront contract stays simple and stable
- physical commerce add-ons can support stock-based tenants
- CRM is usable enough for customer/account follow-up workflows
- Content Studio can support different site renderers
- checkout integration is reusable across tenants
- security hardening already merged remains intact

## Working Rule For Future Codex Waves

When extending V1, Codex must follow this instruction:

> Do not redesign V1 into V2. Only add reusable, governed capability layers that preserve the current working external storefront, admin/dashboard, and security contract.
