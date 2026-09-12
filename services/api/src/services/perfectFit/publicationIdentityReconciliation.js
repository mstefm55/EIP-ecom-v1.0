const PUBLICATION_RECORD_TYPE = "PERFECT_FIT_PUBLICATION_REQUEST";
const PF_LINK_RECORD_TYPE = "PERFECT_FIT_PRODUCT_LINK";
const PF_LINK_RELATION = "PERFECT_FIT_PRODUCT";

const RECONCILE_PARAMS = [PF_LINK_RELATION, PF_LINK_RECORD_TYPE, PUBLICATION_RECORD_TYPE];

function reconciliationParams(tenantId) {
  return [tenantId, ...RECONCILE_PARAMS];
}

/**
 * Repair legacy PF materials whose publication request still points at an older
 * EIP material UUID.
 *
 * Perfect Fit and EIP use different vocabulary for the two commerce gates:
 * - PF approved/content_approved -> EIP material.is_active=true
 * - PF published/content_published -> EIP workflow.stage='published'
 *
 * Approval and publication remain separate projections. Publication authority
 * stays in the EIP process engine, and publication is never inferred merely
 * from material activation.
 */
export async function reconcilePerfectFitPublicationByIdentity(db, tenantId) {
  const params = reconciliationParams(tenantId);

  const approvalActivation = await db.query(
    `
    WITH current_pf AS (
      SELECT DISTINCT ON (m.id)
        m.id AS material_id,
        NULLIF(link_record.payload->'perfect_fit'->>'variant_id', '') AS variant_id,
        NULLIF(link_record.payload->'perfect_fit'->>'variant_code', '') AS variant_code
      FROM eip_core.material m
      JOIN eip_core.object_link ol
        ON ol.tenant_id=m.tenant_id
       AND ol.src_kind='material'
       AND ol.src_id=m.id
       AND ol.dst_kind='info_record'
       AND ol.relation_type=$2
       AND ol.is_active=true
      JOIN eip_core.info_record link_record
        ON link_record.tenant_id=ol.tenant_id
       AND link_record.id=ol.dst_id
       AND link_record.record_type=$3
       AND link_record.is_active=true
      WHERE m.tenant_id=$1
        AND m.material_type='PRODUCT'
        AND COALESCE(m.attrs->'product_hierarchy'->>'level', '')='STYLE_VARIANT'
      ORDER BY m.id, ol.updated_at DESC, ol.created_at DESC
    ),
    latest_publication AS (
      SELECT DISTINCT ON (cp.material_id)
        cp.material_id,
        publication_record.id AS publication_record_id,
        publication_record.payload->>'request_id' AS request_id,
        publication_record.updated_at,
        publication_record.created_at,
        so.id AS service_object_id,
        so.status AS service_object_status
      FROM current_pf cp
      JOIN eip_core.info_record publication_record
        ON publication_record.tenant_id=$1
       AND publication_record.record_type=$4
       AND publication_record.is_active=true
       AND (
         publication_record.payload->>'material_id'=cp.material_id::text
         OR (
           cp.variant_id IS NOT NULL
           AND publication_record.payload->'identity'->>'variant_id'=cp.variant_id
         )
         OR (
           cp.variant_code IS NOT NULL
           AND publication_record.payload->'identity'->>'variant_code'=cp.variant_code
         )
       )
      JOIN eip_core.service_object so
        ON so.tenant_id=publication_record.tenant_id
       AND so.id=(publication_record.payload->>'service_object_id')::uuid
      ORDER BY cp.material_id,
               publication_record.updated_at DESC,
               publication_record.created_at DESC,
               publication_record.id DESC
    ),
    authoritative_approved AS (
      SELECT lp.material_id
      FROM latest_publication lp
      WHERE lower(COALESCE(lp.service_object_status, '')) IN ('approved', 'published')
         OR EXISTS (
           SELECT 1
           FROM eip_core.process_instance pi
           WHERE pi.tenant_id=$1
             AND pi.service_object_id=lp.service_object_id
             AND pi.ended_at IS NULL
             AND pi.status='active'
             AND lower(COALESCE(pi.cursor_json->>'node', '')) IN ('content_approved', 'content_published')
         )
    )
    UPDATE eip_core.material m
    SET is_active=true,
        updated_at=now()
    FROM authoritative_approved aa
    WHERE m.tenant_id=$1
      AND m.id=aa.material_id
      AND m.is_active IS DISTINCT FROM true
    RETURNING m.id
    `,
    params
  );

  const publishedProjection = await db.query(
    `
    WITH current_pf AS (
      SELECT DISTINCT ON (m.id)
        m.id AS material_id,
        NULLIF(link_record.payload->'perfect_fit'->>'variant_id', '') AS variant_id,
        NULLIF(link_record.payload->'perfect_fit'->>'variant_code', '') AS variant_code
      FROM eip_core.material m
      JOIN eip_core.object_link ol
        ON ol.tenant_id=m.tenant_id
       AND ol.src_kind='material'
       AND ol.src_id=m.id
       AND ol.dst_kind='info_record'
       AND ol.relation_type=$2
       AND ol.is_active=true
      JOIN eip_core.info_record link_record
        ON link_record.tenant_id=ol.tenant_id
       AND link_record.id=ol.dst_id
       AND link_record.record_type=$3
       AND link_record.is_active=true
      WHERE m.tenant_id=$1
        AND m.material_type='PRODUCT'
        AND COALESCE(m.attrs->'product_hierarchy'->>'level', '')='STYLE_VARIANT'
      ORDER BY m.id, ol.updated_at DESC, ol.created_at DESC
    ),
    latest_publication AS (
      SELECT DISTINCT ON (cp.material_id)
        cp.material_id,
        publication_record.id AS publication_record_id,
        publication_record.payload->>'request_id' AS request_id,
        publication_record.updated_at,
        publication_record.created_at,
        so.id AS service_object_id,
        so.status AS service_object_status
      FROM current_pf cp
      JOIN eip_core.info_record publication_record
        ON publication_record.tenant_id=$1
       AND publication_record.record_type=$4
       AND publication_record.is_active=true
       AND (
         publication_record.payload->>'material_id'=cp.material_id::text
         OR (
           cp.variant_id IS NOT NULL
           AND publication_record.payload->'identity'->>'variant_id'=cp.variant_id
         )
         OR (
           cp.variant_code IS NOT NULL
           AND publication_record.payload->'identity'->>'variant_code'=cp.variant_code
         )
       )
      JOIN eip_core.service_object so
        ON so.tenant_id=publication_record.tenant_id
       AND so.id=(publication_record.payload->>'service_object_id')::uuid
      ORDER BY cp.material_id,
               publication_record.updated_at DESC,
               publication_record.created_at DESC,
               publication_record.id DESC
    ),
    authoritative_published AS (
      SELECT lp.material_id, lp.publication_record_id, lp.request_id
      FROM latest_publication lp
      WHERE lower(COALESCE(lp.service_object_status, ''))='published'
         OR EXISTS (
           SELECT 1
           FROM eip_core.process_instance pi
           WHERE pi.tenant_id=$1
             AND pi.service_object_id=lp.service_object_id
             AND pi.ended_at IS NULL
             AND pi.status='active'
             AND lower(COALESCE(pi.cursor_json->>'node', ''))='content_published'
         )
    )
    UPDATE eip_core.material m
    SET attrs = jsonb_set(
          COALESCE(m.attrs, '{}'::jsonb),
          '{workflow}',
          COALESCE(m.attrs->'workflow', '{}'::jsonb)
            || jsonb_build_object(
                 'stage', 'published',
                 'publication_status', 'PUBLISHED',
                 'publication_request_id', ap.request_id,
                 'publication_reconciled_at', now(),
                 'publication_reconciled_source', 'PF_STABLE_IDENTITY'
               ),
          true
        ),
        updated_at=now()
    FROM authoritative_published ap
    WHERE m.tenant_id=$1
      AND m.id=ap.material_id
      AND COALESCE(lower(m.attrs->'workflow'->>'stage'), '') <> 'published'
    RETURNING m.id
    `,
    params
  );

  return {
    approval_activation_reconciled: Number(approvalActivation.rowCount || 0),
    approval_material_ids: (approvalActivation.rows || []).map((row) => row.id),
    publication_identity_reconciled: Number(publishedProjection.rowCount || 0),
    material_ids: (publishedProjection.rows || []).map((row) => row.id)
  };
}

export default reconcilePerfectFitPublicationByIdentity;
