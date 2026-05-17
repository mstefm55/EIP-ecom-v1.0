-- 0082_ecom_product_reject_transitions.sql
-- Purpose: allow product reject action from draft and publish steps

BEGIN;

WITH target AS (
  SELECT id, graph
  FROM eip_core.process_def
  WHERE code = 'ECOM_PRODUCT_ONBOARDING'
),
patched AS (
  SELECT
    t.id,
    (
      WITH add_draft_reject AS (
        SELECT
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(t.graph->'edges', '[]'::jsonb)) edge
              WHERE edge->>'from' = 'draft_enrich'
                AND edge->>'to' = 'reject_step'
                AND UPPER(COALESCE(edge->>'action', '')) = 'REJECT'
            ) THEN t.graph
            ELSE jsonb_set(
              t.graph,
              '{edges}',
              COALESCE(t.graph->'edges', '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object(
                  'from', 'draft_enrich',
                  'to', 'reject_step',
                  'action', 'REJECT',
                  'edge_type', 'DEFAULT',
                  'effects', jsonb_build_array(
                    jsonb_build_object(
                      'type', 'JSON_MERGE',
                      'target', 'material',
                      'material_id', '$payload.material_id',
                      'value', jsonb_build_object(
                        'workflow', jsonb_build_object('outcome', 'rejected')
                      )
                    )
                  )
                )
              ),
              true
            )
          END AS graph_after_draft
      ),
      add_publish_reject AS (
        SELECT
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(d.graph_after_draft->'edges', '[]'::jsonb)) edge
              WHERE edge->>'from' = 'publish_step'
                AND edge->>'to' = 'reject_step'
                AND UPPER(COALESCE(edge->>'action', '')) = 'REJECT'
            ) THEN d.graph_after_draft
            ELSE jsonb_set(
              d.graph_after_draft,
              '{edges}',
              COALESCE(d.graph_after_draft->'edges', '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object(
                  'from', 'publish_step',
                  'to', 'reject_step',
                  'action', 'REJECT',
                  'edge_type', 'DEFAULT',
                  'effects', jsonb_build_array(
                    jsonb_build_object(
                      'type', 'JSON_MERGE',
                      'target', 'material',
                      'material_id', '$payload.material_id',
                      'value', jsonb_build_object(
                        'workflow', jsonb_build_object('outcome', 'rejected')
                      )
                    )
                  )
                )
              ),
              true
            )
          END AS graph_after_publish
        FROM add_draft_reject d
      )
      SELECT p.graph_after_publish
      FROM add_publish_reject p
    ) AS graph
  FROM target t
)
UPDATE eip_core.process_def pd
SET graph = p.graph,
    updated_at = now()
FROM patched p
WHERE pd.id = p.id
  AND pd.graph IS DISTINCT FROM p.graph;

COMMIT;
