import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, Search, ShieldCheck, Tag } from 'lucide-react';
import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import { eipApiAdapter } from '../../lib/eipApiAdapter';

function labelFor(option) {
  return option?.label || option?.eipV1Value || option?.code || '';
}

export default function PerfectFitCurationAdmin() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draftTags, setDraftTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const options = useMemo(() => {
    const workspace = perfectFitMetadata.workspace || {};
    const governed = workspace.dropdowns?.VARIANT_CURATION || workspace.dropdowns?.VARIANT_TAG || [];
    return Array.isArray(governed)
      ? governed.filter((option) => option?.attrs?.admin_selectable !== false)
      : [];
  }, [products.length, loading]);

  const selected = useMemo(
    () => products.find((product) => String(product.id) === String(selectedId)) || null,
    [products, selectedId]
  );

  const load = useCallback(async (nextQuery = query) => {
    setLoading(true);
    setError('');
    try {
      const payload = await eipApiAdapter.listAdminCurationProducts(nextQuery);
      const rows = Array.isArray(payload?.products) ? payload.products : [];
      setProducts(rows);
      setSelectedId((current) => {
        if (current && rows.some((row) => String(row.id) === String(current))) return current;
        return rows[0]?.id || '';
      });
    } catch (err) {
      setProducts([]);
      setSelectedId('');
      setError(err?.message || 'Unable to load curation products.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDraftTags(Array.isArray(selected?.tags) ? selected.tags : []);
    setSavedMessage('');
  }, [selectedId, selected?.updated_at]);

  const toggleTag = (code) => {
    setDraftTags((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
    setSavedMessage('');
  };

  const save = async () => {
    if (!selected?.id) return;
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const result = await eipApiAdapter.saveAdminCuration(selected.id, draftTags);
      const tags = Array.isArray(result?.tags) ? result.tags : draftTags;
      setProducts((current) =>
        current.map((product) =>
          String(product.id) === String(selected.id)
            ? { ...product, tags, updated_at: new Date().toISOString() }
            : product
        )
      );
      setDraftTags(tags);
      setSavedMessage('Curation saved to the enterprise product.');
    } catch (err) {
      setError(err?.message || 'Unable to save curation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 text-left">
      <div className="rounded-2xl border border-sand-200 bg-[#FAF8F5] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-clay-700">
              <ShieldCheck className="h-4 w-4" />
              Merchandising authority
            </div>
            <h4 className="font-serif text-xl text-bark-950">Product curation & placement</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-bark-550">
              Assign governed website-level tags to Style Variants. Designers manage SEO and search keywords in their Workspace; Orbit, Best Seller and other merchandising controls are administered here or in EIP Product Studio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(query)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-sand-250 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-bark-700 hover:bg-sand-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-sand-200 bg-white p-4">
          <form
            className="mb-3 flex items-center gap-2 rounded-xl border border-sand-200 bg-[#FAF8F5] px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              load(query);
            }}
          >
            <Search className="h-4 w-4 text-bark-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Style Variants"
              className="min-w-0 flex-1 bg-transparent text-xs text-bark-900 outline-none placeholder:text-bark-350"
            />
          </form>

          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center text-bark-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : products.length ? (
            <div className="max-h-[440px] space-y-1.5 overflow-auto pr-1">
              {products.map((product) => {
                const active = String(product.id) === String(selectedId);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? 'border-clay-400 bg-clay-50/60'
                        : 'border-transparent bg-white hover:border-sand-200 hover:bg-sand-50'
                    }`}
                  >
                    <span className="block truncate text-[11px] font-semibold text-bark-900">{product.name || product.code}</span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-wider text-bark-400">{product.code}</span>
                    {Array.isArray(product.tags) && product.tags.length > 0 && (
                      <span className="mt-2 block text-[9px] text-clay-700">{product.tags.length} curation tag{product.tags.length === 1 ? '' : 's'}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-sand-250 bg-[#FAF8F5] px-4 py-8 text-center text-[11px] text-bark-450">
              No Style Variant products found.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white p-5">
          {!selected ? (
            <div className="flex min-h-[260px] items-center justify-center text-[11px] text-bark-400">
              Select a Style Variant to manage curation.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="border-b border-sand-150 pb-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-bark-400">
                  <Tag className="h-3.5 w-3.5" /> Style Variant
                </div>
                <h5 className="mt-1 font-serif text-lg text-bark-950">{selected.name || selected.code}</h5>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-bark-400">{selected.code}</div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-bark-500">Governed curation & placement</div>
                <div className="flex flex-wrap gap-2 rounded-xl border border-sand-200 bg-[#FAF8F5] p-3">
                  {options.map((option) => {
                    const code = String(option.code || '');
                    const active = draftTags.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleTag(code)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                          active
                            ? 'border-clay-700 bg-clay-700 text-white'
                            : 'border-sand-250 bg-white text-bark-650 hover:border-clay-300'
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                        {labelFor(option)}
                      </button>
                    );
                  })}
                  {!options.length && (
                    <span className="text-[11px] text-bark-400">No governed curation options are loaded.</span>
                  )}
                </div>
              </div>

              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{error}</div>}
              {savedMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">{savedMessage}</div>}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-bark-900 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-bark-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Save curation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
