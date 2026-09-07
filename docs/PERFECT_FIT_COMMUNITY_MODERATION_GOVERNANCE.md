# Perfect Fit Community Moderation Governance

## Purpose

Community Feedback is a trust-facing public surface. Perfect Fit therefore does **not** use a general pre-publication approval queue for ordinary feedback.

The default rule is:

1. a visitor/member submits feedback;
2. an automated safety screen runs immediately;
3. if no high-confidence safety criterion is triggered, the post is published immediately;
4. if a safety criterion is triggered, the post is kept in the existing `blog_post` draft state as `pending_review` and is not exposed by the public Community Feedback endpoint;
5. PF Admin may publish a held false-positive, unpublish an already-live post, restore an unpublished post, or permanently delete a post.

This preserves the trust benefit of immediate publication without giving inappropriate content an automatic public release path.

## Authority and storage

EIP remains the persistence and governance authority.

No new community table is introduced. Community Feedback continues to use:

- `eip_core.service_object` with `object_type='blog_post'`;
- the existing `ECOM_BLOG_POST_FLOW` process binding and process instance;
- existing `eip_core.info_record` for moderation alerts, author notices, and irreversible-deletion audit tombstones;
- the existing authenticated member upload route for media.

The Community Feedback marker remains `pf-community-feedback` in the post's governed tag array.

## Visibility contract

The public Community Feedback endpoint exposes only statuses that are already public (`published`, `approved`, `visible`).

A held post remains `new`/draft with:

```text
attrs.moderation.state = pending_review
```

It is visible to PF Admin moderation but not to the public feed.

Ordinary clear posts are advanced through `INTAKE` then `PUBLISH` immediately in the same request.

## Automated safety review

The initial implementation is an explicit deterministic automated safety engine (`automated-rules-v1`). It checks a narrow set of high-confidence categories such as:

- abusive/profane language;
- direct personal insults or degrading language;
- threatening/harmful language.

A held submission receives an immediate explanation describing the triggered criterion and stating that the post was sent for administrator review.

The moderation record stores the decision, criteria, engine identifier, explanation, and review timestamp.

### AI provider boundary

This release does **not** claim an LLM/AI moderation decision when no external moderation provider is configured. The review contract is deliberately engine-labelled so a later approved AI moderation provider can replace or augment `automated-rules-v1` without changing the Community Feedback persistence or PF Admin workflow.

An AI provider should return the same normalized contract:

```json
{
  "decision": "publish | hold",
  "engine": "provider-and-version",
  "criteria": [{ "code": "...", "label": "..." }],
  "message": "user-facing explanation"
}
```

## PF Admin moderation actions

### Publish after review

For a held post, PF Admin advances the existing process with `PUBLISH`. No separate publication workflow is created.

### Unpublish

PF Admin advances the existing process with `REJECT` from the published node. A moderation reason is required. The post immediately disappears from the public endpoint.

### Restore

A rejected post is advanced with `INTAKE` back to draft and then `PUBLISH`.

### Permanent delete

Permanent deletion is intentionally distinct from unpublish:

1. a moderation ground is required;
2. if the author is a registered member, an author notice is written first;
3. an EIP `info_record` tombstone is written containing the post reference, content hash, administrator identity, reason, and deletion timestamp;
4. the `blog_post` service object is deleted;
5. the existing FK cascade removes its process instance.

The tombstone does not retain the deleted post body.

## Registered-author notice

When a registered member's post is unpublished or permanently deleted, EIP writes `PF_COMMUNITY_MODERATION_NOTICE` targeted to that member identity. Perfect Fit surfaces unseen notices when the member loads Community Feedback.

The notice explains:

- which post was moderated;
- the action taken;
- the moderation ground and administrator explanation.

Guest/anonymous authors cannot receive an account notification because they have no member identity.

## Administrator alert

Automated holds create `PF_COMMUNITY_MODERATION_ALERT` in EIP. The PF Admin Community Moderation console polls the EIP moderation queue and prioritizes posts whose moderation state is `pending_review`.

## Security

Admin moderation routes require:

- the existing Perfect Fit storefront gateway connection;
- MEMBER realm session;
- `PF_ADMIN` role;
- member CSRF for writes;
- gateway idempotency (`X-Event-Id`) for moderation mutations.

No designer-private Workspace data is exposed through this flow.

## No migration

This feature reuses existing EIP service-object, process, member-session, and info-record primitives. It requires no new database migration or table.
