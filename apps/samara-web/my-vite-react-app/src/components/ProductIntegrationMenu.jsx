import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, RefreshCw, Unlink2 } from 'lucide-react';
import { productIntegrationService } from '../lib/productIntegrationService';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';

const PRODUCT_STUDIO_URL = String(import.meta.env?.VITE_EIP_PRODUCT_STUDIO_URL || '').trim();

export default function ProductIntegrationMenu({
  project,
  style,
  variant,
  onApplySharedPatch,
  onCreateFromEip,
  onIntegrationChange
}) {
  const queryIntent = useMemo(() => {
    if (typeof window === 'undefined') return { intent: '', productId: '' };
    const params = new URLSearchParams(window.location.search);
    return {
      intent: params.get('eip_intent') || '',
      productId: params.get('eip_product_id') || ''
    };
  }, []);
  const storedProductId = variant?.integration?.eip?.productId || '';
  const [capability, setCapability] = useState({ available: false, loading: true });
  const [link, setLink] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(queryIntent.productId || storedProductId);
  const [expanded, setExpanded] = useState(Boolean(queryIntent.intent));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const productId = storedProductId || link?.eip_product_id || selectedProductId;

  useEffect(() => {
    let active = true;
    productIntegrationService.capability().then((result) => {
      if (!active) return;
      setCapability({ ...result, loading: false });
      if (result.available && result.can_read) {
        productIntegrationService.listProducts('').then((data) => {
          if (active) setProducts(data?.items || []);
        }).catch(() => {});
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!capability.available || !storedProductId) return;
    productIntegrationService.getIntegration(storedProductId)
      .then((data) => setLink(data?.link ? { ...data.link, eip_product_id: storedProductId } : null))
      .catch(() => setLink(null));
  }, [capability.available, storedProductId]);

  if (capability.loading || !capability.available || !variant) return null;

  const context = { project, style, variant };
  const run = async (operation) => {
    setBusy(true);
    setNotice('');
    try {
      await operation();
    } catch (error) {
      setNotice(error?.message || 'EIP integration action failed. Perfect Fit data was not changed.');
    } finally {
      setBusy(false);
    }
  };

  const register = () => run(async () => {
    const result = await productIntegrationService.register(context);
    const id = result?.item?.id || result?.product_id;
    const nextLink = { ...(result?.link || {}), eip_product_id: id, status: 'LINKED' };
    setLink(nextLink);
    setSelectedProductId(id);
    onIntegrationChange?.(nextLink);
    setNotice(result?.reused ? 'Existing EIP registration restored.' : 'Product registered in EIP.');
  });

  const linkExisting = () => run(async () => {
    if (!selectedProductId) throw new Error('Select an EIP product first.');
    const result = await productIntegrationService.link(
      selectedProductId,
      context,
      queryIntent.intent === 'link-existing' ? 'EIP' : 'PERFECT_FIT'
    );
    const nextLink = { ...(result?.link || {}), eip_product_id: selectedProductId, status: 'LINKED' };
    setLink(nextLink);
    onIntegrationChange?.(nextLink);
    setNotice('Products linked by stable IDs.');
  });

  const createFromEip = () => run(async () => {
    if (!selectedProductId) throw new Error('Select an EIP product first.');
    const productResult = await productIntegrationService.getIntegration(selectedProductId);
    const createdContext = onCreateFromEip?.(productResult?.product, selectedProductId);
    if (!createdContext) throw new Error('Perfect Fit could not create the workspace.');
    const linked = await productIntegrationService.link(selectedProductId, createdContext, 'EIP');
    const nextLink = { ...(linked?.link || {}), eip_product_id: selectedProductId, status: 'LINKED' };
    setLink(nextLink);
    onIntegrationChange?.(nextLink, createdContext.variant?.id);
    setNotice('Perfect Fit created and linked its own rich workspace structure from safe starter metadata.');
  });

  const sync = () => run(async () => {
    const result = await productIntegrationService.sync(productId, context);
    const nextLink = { ...(result?.link || link || {}), eip_product_id: productId, status: 'LINKED' };
    onApplySharedPatch?.(result?.patch_to_perfect_fit || {}, nextLink);
    setLink((current) => ({ ...(current || {}), ...(result?.link || {}), eip_product_id: productId }));
    setNotice(result?.conflicts?.length
      ? `Manual review required: ${result.conflicts.map((item) => item.field).join(', ')}.`
      : 'Shared metadata synchronized. Technical workspace data was preserved.');
  });

  const unlink = () => run(async () => {
    if (!window.confirm('Unlink only? Neither the Perfect Fit product nor the EIP product will be deleted.')) return;
    await productIntegrationService.unlink(productId);
    setLink(null);
    onIntegrationChange?.(null);
    setNotice('Integration relationship removed. Both products remain intact.');
  });

  const openEip = () => {
    if (!PRODUCT_STUDIO_URL || !productId) {
      setNotice('EIP Product Studio URL is not configured for this environment.');
      return;
    }
    const url = new URL(PRODUCT_STUDIO_URL, window.location.origin);
    url.searchParams.set('product_id', productId);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#D9D5CC] bg-white px-3 text-[11px] font-semibold text-[#4A4741] hover:bg-[#EFEEE8]"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
        EIP
      </button>
      {expanded ? (
        <div className="absolute right-0 top-11 z-[2600] w-[min(360px,calc(100vw-2rem))] rounded-[14px] border border-[#D9D5CC] bg-white p-3 text-[#272622] shadow-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#918D84]">{pfUiT('integration.eip.title')}</p>
          {link || storedProductId ? (
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={openEip} className="rounded-lg border border-[#D9D5CC] px-3 py-2 text-left text-xs font-semibold">{pfUiT('integration.eip.open')}</button>
              <button type="button" onClick={sync} disabled={busy || !capability.can_sync} className="inline-flex items-center gap-2 rounded-lg border border-[#D9D5CC] px-3 py-2 text-left text-xs font-semibold disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" />{pfUiT('integration.eip.sync')}</button>
              <div className="rounded-lg bg-[#F4F2ED] px-3 py-2 text-[11px] text-[#6F6C65]">Linked EIP UUID: {productId}</div>
              <button type="button" onClick={unlink} disabled={busy || !capability.can_unlink} className="inline-flex items-center gap-2 rounded-lg border border-[#E5C8C0] px-3 py-2 text-left text-xs font-semibold text-[#8A4B3A] disabled:opacity-40"><Unlink2 className="h-3.5 w-3.5" />{pfUiT('integration.eip.unlink')}</button>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {queryIntent.intent === 'create-workspace' ? (
                <button type="button" onClick={createFromEip} disabled={busy} className="rounded-lg bg-[#272622] px-3 py-2 text-left text-xs font-semibold text-white">{pfUiT('integration.eip.createPf')}</button>
              ) : null}
              <button type="button" onClick={register} disabled={busy || !capability.can_register} className="rounded-lg bg-[#272622] px-3 py-2 text-left text-xs font-semibold text-white disabled:opacity-40">{pfUiT('integration.eip.register')}</button>
              <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="rounded-lg border border-[#D9D5CC] bg-white px-3 py-2 text-xs">
                <option value="">{pfUiT('integration.eip.selectExisting')}</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.title || item.code || item.id}</option>)}
              </select>
              <button type="button" onClick={linkExisting} disabled={busy || !selectedProductId || !capability.can_link} className="rounded-lg border border-[#D9D5CC] px-3 py-2 text-left text-xs font-semibold disabled:opacity-40">{pfUiT('integration.eip.linkExisting')}</button>
            </div>
          )}
          {notice ? <p className="mt-3 rounded-lg bg-[#F4F2ED] px-3 py-2 text-[11px] text-[#6F6C65]">{notice}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
