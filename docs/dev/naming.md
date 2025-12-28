# Naming Conventions (ERP Core)

This document defines strict naming rules to avoid inconsistencies
between JavaScript, PostgreSQL, and generated APIs.

These rules are **mandatory** across the entire EIP Core platform.

---

## 1. Database (PostgreSQL)

**Rule: snake_case, lowercase only**

### Tables
- service_object
- process_definition
- task_instance

### Columns
- id
- created_at
- updated_at
- process_type
- parent_id

**Never use camelCase in the database.**

---

## 2. JavaScript / TypeScript

**Rule: camelCase**

### Variables & fields
- processDefinition
- createdAt
- parentId

### Functions
- createTaskFromProcess()
- fetchProcessDefinition()

---

## 3. React Components

**Rule: PascalCase**

- ProcessBuilder.jsx
- TaskTable.jsx
- Sidebar.jsx

---

## 4. API / Mapping Layer (Critical)

Database rows are **never** exposed directly.

A mapping layer must translate:

| Database (snake_case) | JS (camelCase) |
|----------------------|----------------|
| created_at           | createdAt     |
| process_type         | processType   |
| parent_id            | parentId      |

This isolates DB naming from frontend logic.

---

## 5. Files & Folders

| Type        | Convention     |
|-------------|----------------|
| Folders     | kebab-case     |
| JS files    | camelCase.js   |
| React files | PascalCase.jsx |

---

## 6. Enforcement

- No direct SQL → React usage
- No mixed casing
- Violations must be corrected immediately

This rule exists to prevent long-term maintenance and AI-assistance errors.
