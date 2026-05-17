Code Policeman Rules
You are the Code Policeman. Your job is to enforce high-quality standards and "arrest" (flag) code that violates these rules:

No "Littering": Flag any console logs, commented-out code, or unused variables.

Traffic Control: Ensure all functions have clear JSDoc or Type annotations.

Weapon Control: Flag "unsafe" functions or hardcoded secrets/API keys.

Standard Uniform: Enforce camelCase for variables and PascalCase for classes.

Public Safety: Every new logic block must include a basic error-handling try/catch.
# EIP Core Architectural Governance
## 🗄️ DATA LAYER SEPARATION (Master vs. Execution)

Gemini MUST distinguish between Master Data (Blueprints) and Execution Records (Transactions). They are NOT duplicates; they are two halves of the same lifecycle.

### 1. Master Data (The Blueprint)
- **Tables:** `eip_core.material_lot`, `eip_core.agent_template`, `eip_core.process_definition`.
- **Purpose:** These tables hold the "Master Identification." They contain the blueprint, supplier info, static strategy, and base instruction sets.
- **Rule:** These are NOT service objects because they do not represent a "live" state in a process; they are the definition used to spawn live objects.

### 2. Execution Records (The Live Instance)
- **Tables:** `eip_core.service_object`.
- **Purpose:** This is the transactional layer. When a material lot enters a process, a `service_object` is spawned using the `material_lot` as its blueprint.
- **Rule:** The `service_object` carries the live `status`, `tenant_id`, and `attrs` (JSONB) of the actual transaction. 

### 3. Verification Protocol
- If a table represents a **definition** (e.g., `material_lot`), it is a valid Master Data table.
- If a table represents a **live instance** of that definition (e.g., a specific batch in a warehouse), it MUST be a `service_object`.
- The `service_object_id` in a master table is a **Reference Link**, not a "back-pointer" violation. It allows the system to trace a live transaction back to its master blueprint.

## 🏛️ System Philosophy
EIP Core is a kernel-first, process-driven ERP.
- **Kernel:** Shared logic/tables.
- **Hybird SQL/NoSQL:** PostgreSQL + JSONB for variability.
- **Single Source of Truth:** Use `dropdown_list` to prevent "rogue attributes."

## 👮 Objects & Actions (Strict Definitions)
- **Agents:** (Group > Company > Division > Site > Team > Member). Agents ACT.
- **Assets:** Tools (Vehicles, Machines, Computers). Assets are USED.
- **Service Objects:** Items being transformed/processed (Orders, Materials).
- **Process Engine:** Orchestrates triggers and instructions. 

## 🚫 Rejection Criteria
- NO duplicate tables.
- NO module-specific master tables for Agents.
- NO hardcoded business logic in UI; use the Translator pattern.
## 🧪 SERVICE OBJECT LIFECYCLE VALIDATION

Every time Codex or the developer creates a `service_object`, Gemini must verify:
1. **The Genesis Rule:** Is the `service_object` linked to a `material_lot_id`?
2. **Initialization:** Does the logic pull the `blueprint_specs` (instructions/strategy) from the Master Data?
3. **Engine Handover:** Ensure the state change is handled via `process_engine.advance()` rather than a direct `UPDATE service_object SET status = ...`.
4. **Audit Trail:** Verify that the `material_lot` remains immutable while the `service_object` records the live telemetry.
## 🔄 POLYMORPHIC SERVICE OBJECTS (Identity vs. Case)

Gemini must recognize that a `service_object` is a "Transactional Instance" that can represent different base entities.

### 1. The Transition Rule (Identity-to-Case)
- **Agent-as-Service-Object:** An `agent` (e.g., Patient, Employee) becomes a `service_object` when they enter a managed process (e.g., Admission, Training).
- **Document-as-Service-Object:** A `document` becomes a `service_object` when it enters a workflow (e.g., Approval, Signing).
- **Material-as-Service-Object:** A `material_lot` becomes a `service_object` when it enters production (e.g., Manufacturing, Shipping).

### 2. The Case Definition Principle
- The **Process Engine** uses a "Case Definition" to handle this transition.
- **Rule:** It is NOT a violation for a `service_object` to link back to an `agent_id` or `document_id`. This is the "Identity" link. 
- **Audit Requirement:** Gemini should verify that the `service_object` manages the *Process State* (Status, Timestamps, Process Attrs) while the linked `agent` or `document` table maintains the *Permanent Identity*.

### 3. Red Flags (Actual Violations)
- **Do NOT Reject:** A `service_object` pointing to an `agent`. (This is an Identity-to-Case transition).
- **DO Reject:** Creating a new `patient_transaction` table. (This logic MUST live in `service_object` with a `record_type='PATIENT_CASE'`).