# Email / Chat Intake Service Object Model

## Purpose

This note records the agreed EIP V1 direction for unstructured communication intake so it can be referred to in later waves.

The goal is not only to send and receive email. The goal is to treat email, chat, and collaborative workspace messages as governed business intake channels that can be transformed into structured operational objects inside EIP.

## Core Principle

Unstructured communication must not become hidden business authority.

Channels are only entry points.

Authority must remain with:
- governed process definitions
- task/effect rules
- service object linking rules
- status transition rules
- validation rules
- human review thresholds where needed

AI may propose structure and actions.
The process engine remains the authority that validates and executes them.

## Canonical Flow

`channel event -> intake record -> AI digestion -> structured payload -> service object / task / status transition / comment / document -> process engine validation`

## Channel Scope

This model should apply consistently to:
- email
- chat
- collaborative workspace messages
- later forms
- API feeds
- OCR / document ingestion
- voice transcript channels if introduced later

## Operational Meaning

Examples of intended behavior:
- one inbound email can create a new service object
- another inbound email can update the same service object
- another message can request a status transition
- another message can create a task
- another message can register a document or evidence
- another message can trigger creation of a child service object from a parent service object

The same pattern should later apply to chat and collaborative workspace channels.

## Storage Layers

For each inbound channel event, EIP should preserve multiple layers:

### 1. Raw intake record
Store the original event unchanged as far as practical:
- full body
- subject / title
- sender / recipients / participants
- thread or conversation id
- timestamps
- channel metadata
- attachment metadata
- raw payload or normalized envelope

### 2. AI digestion output
AI should extract a structured proposal, for example:
- intent
- probable referenced service object
- probable customer / contact / partner
- probable order / document / case reference
- requested action
- proposed status change
- proposed task creation
- proposed child service object creation
- extracted dates / amounts / references
- confidence score
- ambiguity flags

### 3. Normalized action proposal
The AI result should be normalized into governed action proposals such as:
- create service object
- update service object
- change status
- create task
- add note/comment
- register document/info record
- create child service object
- link existing objects

### 4. Engine decision
The process engine should then determine whether the proposal is:
- accepted automatically
- accepted with guardrails
- routed for human review
- rejected as invalid

## Service Object Canon

Inbound communication should support the service object model directly.

Communication does not bypass the kernel.
It feeds the kernel.

That means:
- service objects remain the operational case container
- tasks remain the actionable work units
- documents/info records remain governed supporting records
- status transitions remain process-governed
- child service object creation remains an allowed governed outcome where process/effect rules support it

## AI Role

AI is the parser, classifier, and structuring assistant.

AI is **not** the authority.

AI can propose:
- create complaint case
- link to existing order case
- move status to under review
- create follow-up task
- create child logistics claim object

But EIP must validate those proposals against governed process/effect/status rules before execution.

## Email Provider Direction

### Outbound first
Use Brevo outbound delivery to stabilize:
- OTP emails
- password reset emails
- recovery emails
- future transactional notifications

### Inbound second
Use Brevo inbound parsing webhook so incoming email is delivered to EIP as structured JSON.

Recommended direction:
- Brevo handles transport/parsing
- EIP stores the raw inbound payload
- EIP normalizes the message
- AI digests the content
- the process engine validates and executes allowed actions

## Future Extension

After email inbound/outbound is stable, the same normalized intake contract should be extended to:
- chat connectors
- collaborative workspace connectors
- additional intake channels

This preserves one canonical intake model across channels rather than creating hidden channel-specific business logic.

## Design Summary

**Email = intake channel**

**Chat / workspace = intake channels**

**Service object = business case container**

**Task = required action**

**Document / info record = supporting governed evidence**

**AI = parser / classifier / extractor**

**Process engine = authority**

## Implementation Sequence

1. Implement Brevo outbound for auth mail
2. Validate OTP / reset / recovery delivery
3. Implement Brevo inbound webhook route
4. Store raw inbound email payloads
5. Add AI digestion to structured proposals
6. Map proposals into governed service object / task / document actions
7. Extend the same intake contract to chat and collaborative workspace channels
