# CRM Intelligence Foundation V1

Status: implemented foundation
Date: 2026-06-01

## Purpose

CRM Intelligence extends the existing tenant CRM without replacing its operational model. It adds governed segments, campaigns, normalized signals, connector readiness, KPI summaries, and reusable dashboard tabs.

No CRM-specific persistence table was added.

## Kernel Model

| Capability | Kernel storage | Type |
| --- | --- | --- |
| Segment or market group | `eip_core.agent` | `SEGMENT`, `MARKET_GROUP` |
| Master campaign | `eip_core.service_object` | `CRM_CAMPAIGN` |
| Segment follow-up context | `eip_core.service_object` | `CRM_SEGMENT_REVIEW` |
| Normalized signal | `eip_core.info_record` | `CRM_SIGNAL`, `CRM_CAMPAIGN_SIGNAL` |
| Relationships | `eip_core.object_link` | Governed relation vocabulary |
| Campaign and segment follow-ups | `eip_core.task` | Existing CRM task types |
| Connector readiness | `eip_core.tenant.attrs.connection_profiles` | Existing connection metadata only |

## Security Boundary

All CRM Intelligence routes require:

```text
EIP session
CSRF
RBAC permission
active CRM capability flag
tenant-scoped lookup
input validation
```

Signals are append-only records. Their metadata is sanitized recursively. Credential-like keys are replaced with `[REDACTED]`. External references are stored as SHA-256 hashes by default.

Connector readiness never returns secrets, tokens, raw provider payloads, or verification credentials. Admin Console remains responsible for technical connection setup and secret lifecycle.

The gateway remains border control. It may append normalized intake facts through controlled orchestration later, but it must not directly create leads, opportunities, campaigns, or tasks.

## Routes

Prefix:

```text
/api/eip/crm
```

Segments:

```text
GET    /segments
POST   /segments
GET    /segments/:id
PATCH  /segments/:id
POST   /segments/:id/link
POST   /segments/:id/tasks
POST   /segments/:id/notes
GET    /segments/:id/timeline
```

Campaigns:

```text
GET    /campaigns
POST   /campaigns
GET    /campaigns/:id
PATCH  /campaigns/:id
POST   /campaigns/:id/status
POST   /campaigns/:id/link
POST   /campaigns/:id/tasks
POST   /campaigns/:id/notes
GET    /campaigns/:id/timeline
POST   /campaigns/:id/channel-variants
PATCH  /campaigns/:id/channel-variants/:variantId
```

Signals and intelligence:

```text
GET    /signals
POST   /signals
GET    /signals/:id
POST   /signals/:id/link
POST   /signals/:id/promote
GET    /intelligence/capabilities
GET    /intelligence/overview
GET    /intelligence/connectors
```

Signal promotion creates governed review work only on an existing tenant-scoped service object with a live process binding.

## Governed Dropdowns

Migration `0101_crm_intelligence_foundation.sql` seeds:

```text
CRM_SEGMENT_TYPE
CRM_SEGMENT_PRIORITY
CRM_SEGMENT_MATURITY
CRM_CAMPAIGN_STATUS
CRM_CAMPAIGN_OBJECTIVE
CRM_CAMPAIGN_CHANNEL
CRM_CHANNEL_VARIANT_STATUS
CRM_SIGNAL_TYPE
CRM_SIGNAL_PROVIDER_CATEGORY
CRM_SIGNAL_SOURCE_CHANNEL
CRM_CONNECTOR_READINESS_STATUS
CRM_CONNECTOR_PROVIDER
```

## Permissions

```text
CRM_SEGMENT_READ
CRM_SEGMENT_WRITE
CRM_CAMPAIGN_READ
CRM_CAMPAIGN_WRITE
CRM_SIGNAL_READ
CRM_SIGNAL_WRITE
CRM_INTELLIGENCE_READ
CRM_CONNECTOR_READ
```

Permissions are added to existing admin, universal, CRM, full-access, and read-only bundles according to their current posture.

## Process Governance

The foundation seeds:

```text
CRM_CAMPAIGN_FLOW_V1
CRM_SEGMENT_REVIEW_FLOW_V1
```

Campaign transitions:

```text
draft -> review -> approved -> scheduled -> active -> completed
active <-> paused
cancelled from permitted non-final states
```

Campaign updates, channel-variant metadata edits, tasks, and status transitions run through the bound campaign process.

Segment records remain agent master data. Segment follow-up tasks are created through a bound `CRM_SEGMENT_REVIEW` work context so the task engine remains authoritative.

## Object Links

The route layer validates both tenant scope and business meaning for links.

Supported relation groups:

```text
SEGMENT_MEMBER
SEGMENT_INTEREST
SEGMENT_RELATED_LEAD
SEGMENT_RELATED_OPPORTUNITY
SEGMENT_RELATED_CONTENT

CAMPAIGN_TARGETS_SEGMENT
CAMPAIGN_RELATED_PRODUCT
CAMPAIGN_RELATED_CONTENT
CAMPAIGN_SOURCE_FOR_LEAD
CAMPAIGN_RELATED_OPPORTUNITY

SIGNAL_FOR_SEGMENT
SIGNAL_FOR_AGENT
SIGNAL_FOR_CAMPAIGN
SIGNAL_FOR_LEAD
SIGNAL_FOR_OPPORTUNITY
SIGNAL_FOR_PRODUCT
SIGNAL_FOR_CONTENT
SIGNAL_PROMOTED_TO_WORK
```

No custom join table is used.

## Module Capabilities

CRM remains the root subscription:

```text
crm
```

Intelligence tabs are gated by capabilities stored under the existing CRM subscription setting:

```json
{
  "capabilities": {
    "basic": true,
    "segments": true,
    "campaigns": true,
    "signals": true,
    "intelligence": true,
    "connectors": true
  }
}
```

Migration `0101` enables these capabilities for tenants that already have active CRM. Future tenant activation should set capabilities explicitly through the existing Admin Modules path.

## Dashboard UI

The reusable `CrmWorkspace` adds descriptor-gated tabs:

```text
Intelligence
Segments
Campaigns
Signals
Connectors
```

The Intelligence tab shows:

```text
segment count
campaign count
active campaign count
signal count
signals in the last 7 days
ready connector count
top signal channels
campaign status distribution
segment priority distribution
```

The Connectors tab is read-only. Technical connection editing remains in Admin Console.

## Connector Readiness

CRM Intelligence derives a secret-free readiness view by merging the governed
`CRM_CONNECTOR_PROVIDER` catalog with existing connection profiles:

```text
connection code
connection name
provider category
configured yes/no
enabled yes/no
direction
scope summary
last sync status
last sync time
data category
module dependency
```

Provider adapters are intentionally deferred. CRM core consumes normalized signals and does not call provider APIs.

## Railway Deployment

After deploying the API commit:

```bash
cd services/api
npm run migrate
```

Then redeploy the API and dashboard services.

## Local Verification

```bash
cd services/api
npm test
npm run test:security

cd ../../apps/dashboard
npm run build
```

## Known Limitations

This is a foundation wave. It intentionally does not implement:

```text
provider API adapters
channel publishing
automated campaign execution
analytics provider synchronization
email sending
advertising platform synchronization
commerce provider synchronization
scoring algorithms
planning engines
```

## Next Recommended Wave

Add a controlled normalized-signal intake consumer behind the existing gateway and enrich UI descriptors so tenant-specific field labels, forms, filters, and link actions can be changed without a dashboard build.
