# ADR 0001 – Repository Structure

**Status:** Accepted  
**Date:** 2025-12-28

---

## Context

The EIP Core platform is designed as a reusable ERP engine
supporting multiple business applications (e.g. Samara).

The system must support:
- Modular growth
- Rollback safety
- Cloud + desktop usage
- Long-term maintainability

---

## Decision

We adopt a **single monorepo** structure:

eip-core/
├── apps/ # Business-facing applications
├── services/ # Backend services (API, workers)
├── packages/ # Shared libraries (db, auth, ui)
├── docs/ # Developer & system documentation
├── scripts/ # Tooling & automation

Each business application (e.g. Samara) lives under `apps/`
and must not introduce business-specific logic into core packages.

---

## Consequences

### Positive
- Single source of truth
- Easy rollback using Git
- Clear separation of concerns
- Scalable for multiple clients

### Negative
- Requires discipline to avoid cross-contamination
- Larger repository size

These tradeoffs are accepted.

---

## Notes

This decision is binding unless superseded by a future ADR.
