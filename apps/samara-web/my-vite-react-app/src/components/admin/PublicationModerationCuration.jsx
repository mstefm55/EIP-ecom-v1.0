import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, ShieldCheck, Tag } from 'lucide-react';
import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import { eipApiAdapter } from '../../lib/eipApiAdapter';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function labelFor(option) {
  return option?.label || option?.eipV1Value || option?.code || '';
}

function resolveProduct(rows, request) {
  if (!Array.isArray(rows) || !rows.length) return null;

  const variantId = normalize(request?.variantId);
  const variantCode = normalize(request?.variantCode);
  const styleId = normalize(request?.styleId);
  const styleCode = normalize(request?.styleCode);
  const expectedName = normalize(
    [request?.styleName, request?.variantName].filter(Boolean).join(' — ')
  );

  return (
    rows.find((row) => variantId && normalize(row?.perfect_fit?.variant_id) === variantId) ||
    rows.find((row) => variantCode && normalize(row?.perfect_fit?.variant_code) === variantCode) ||
    rows.find(
      (row) =>
        styleId &&
        normalize(row?.perfect_fit?.style_id) === styleId &&
        (!variantCode || normalize(row?.perfect_fit?.variant_code) === variantCode)
    ) ||
    rows.find(
      (row) =>
        styleCode &&
        normalize(row?.perfect_fit?.style_code) === styleCode &&
        (!variantCode || normalize(row?.perfect_fit?.variant_code) === variantCode)
    ) ||
    rows.find((row) => expectedName && normalize(row?.name) === expectedName) ||
    (rows.length === 1 ? rows[0] : null)
  );
}

export default function PublicationModerationCuration({ request }) {
  const [product, setProduct] = useState(null);
  const [draftTags, setDraftTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const options = useMemo(() => {
    const workspace = perfectFitMetadata.workspace || {};
    const governed = workspace.dropdowns?.VARIANT_CURATION || workspace.dropdowns?.VARIANT_TAG || [];
    return Array.isArray(governed)
      ? governed.filter((option) => option?.attrs?.admin_selectable !== false)
      : [];
  }, []);

  const load = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError('');
    setSavedMessage('');

    try {
      const primaryQuery = request.variantCode || request.styleCode || request.styleName || '';
      let payload = await eipApiAdapter.listAdminCurationProducts(primaryQuery);
      let rows = Array.isArray(payload?.products) ? payload.products : [];
      let matched = resolveProduct(rows, request);

      if (!matched && primaryQuery) {
        payload = await eipApiAdapter.listAdminCurationProducts('');
        rows = Array.isArray(payload?.products) ? payload.products : [];
        matched = resolveProduct(rows, request);
      }

      setProduct(matched);
      setDraftTags(Array.isArray(matched?.tags) ? matched.tags : []);

      if (!matched) {
        setError('The submitted Style Variant is not linked to an EIP curation product yet.');
      }
    } catch (err) {
      setProduct(null);
      setDraftTags([]);
      setError(err?.message || 'Unable to load website curation.');
    } finally {
      setLoading(false);
    }
  }, [request?.requestId, request?.variantId, request?.variantCode, request?.styleId, request?.styleCode]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTag = (code) => {
    setDraftTags((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
    setSavedMessage('');
  };

  const save = async () => {
    if (!product?.id) return;
    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const result = await eipApiAdapter.saveAdminCuration(product.id, draftTags);
      const tags = Array.isArray(result?.tags) ? result.tags : draftTags;
      setDraftTags(tags);
      setProduct((current) => (current ? { ...current, tags } : current));
      setSavedMessage('Website curation saved.');
    } catch (err) {
      setError(err?.message || 'Unable to save website curation.');
    } finally {
      setSaving(false);
    }
  };

  const originalTags = Array.isArray(product?.tags) ? product.tags : [];
  const dirty = JSON.stringify([...draftTags].sort()) !== JSON.stringify([...originalTags].sort());

  return (
    <div className="border-t border-sand-150 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[8px] font-mono font-bold uppercase tracking-[0.14em] text-clay-700">
            <Tag className="h-3.5 w-3.5" /> Website curation &amp; placement
          </div>
          <p className="mt-1 max-w-xl text-[9px] leading-relaxed text-bark-450">
            PF Admin authority only. These tags update the enterprise product and do not open or modify the designer&apos;s private Workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading || saving}
          className="inline-flex items-center gap-1 rounded-lg border border-sand-200 bg-[#FAF8F5] px-2.5 py-1.5 text-[8px] font-mono font-bold uppercase tracking-wider text-bark-550 hover:text-bark-900 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-[9px] text-bark-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading governed tags…
        </div>
      ) : product ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const code = String(option.code || '');
              const active = draftTags.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(code)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[8.5px] font-semibold transition-colors ${
                    active
                      ? 'border-clay-700 bg-clay-700 text-white'
                      : 'border-sand-250 bg-[#FAF8F5] text-bark-650 hover:border-clay-300'
                  }`}
                >
                  {active && <Check className="h-2.5 w-2.5" />}
                  {labelFor(option)}
                </button>
              );
            })}
            {!options.length && (
              <span className="text-[9px] text-bark-400">No governed curation options are loaded.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[7.5px] uppercase tracking-wider text-bark-350">
              EIP product {product.code || product.id}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 rounded-lg bg-clay-750 px-3 py-1.5 text-[8.5px] font-bold text-white hover:bg-clay-850 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              Save tags
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[9px] text-amber-800">
          {error}
        </div>
      )}
      {savedMessage && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[9px] text-emerald-800">
          {savedMessage}
        </div>
      )}
    </div>
  );
}
