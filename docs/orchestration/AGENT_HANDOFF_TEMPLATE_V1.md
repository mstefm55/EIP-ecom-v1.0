# EIP V1 Agent Handoff Template

Every agent must use this template before asking Agent 0 to review, merge, or continue work.

```text
Agent:
Branch:
Commit SHA:
Scope:

Files changed:

Routes changed:

Migrations added:

Descriptors changed:

Backend/API changes:

Frontend changes:

Tests run:

Build result:

Known limitations:

Conflicts/overlaps:

Registry update needed:

Shared/high-risk files touched:

Migration reservations used or released:

Railway/deployment notes:

Rollback notes:
```

## Engine-First Drift Check

```text
1. Did any business policy move into React?
2. Did any route become process authority?
3. Did any tenant-specific hardcoding enter production code?
4. Did any fake/demo production data get added?
5. Are actions process/task governed?
6. Are UI changes descriptor-driven where practical?
7. Are commercial/trade policies still commercial_condition governed?
8. Are Product Studio, Inventory, Procurement, CRM and Tasks boundaries respected?
```

## Required Closure Statement

```text
This work preserved EIP engine-first architecture: yes/no
If no, explain why and what must be fixed before merge.
```
