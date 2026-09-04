import { useEffect, useMemo, useRef } from 'react';
import { productIntegrationService } from '../lib/productIntegrationService';

function clearIntegrationIntentFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('eip_intent');
    url.searchParams.delete('eip_product_id');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {}
}

/**
 * Perfect Fit product integration is intentionally background-only.
 *
 * Ordinary designers save the Workspace; the runtime persistence bridge writes
 * the authoritative Perfect Fit document to EIP and automatically synchronizes
 * already-linked enterprise projections. The old manual EIP/Sync button is not
 * part of the designer workflow.
 *
 * This component remains mounted only to honor explicit EIP-origin navigation
 * intents (create a PF workspace from an EIP product, or link the current PF
 * variant to a specific EIP product). Those intents are executed once and then
 * removed from the URL.
 */
export default function ProductIntegrationMenu({
  project,
  style,
  variant,
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

  const handledIntentRef = useRef('');

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (
        !variant ||
        !queryIntent.intent ||
        !queryIntent.productId ||
        !productIntegrationService.isConfigured()
      ) {
        return;
      }

      const intentKey = `${queryIntent.intent}:${queryIntent.productId}`;
      if (handledIntentRef.current === intentKey) return;
      handledIntentRef.current = intentKey;

      let capability;
      try {
        capability = await productIntegrationService.capability();
      } catch {
        return;
      }
      if (!active || !capability?.available || !capability.can_link) return;

      try {
        if (queryIntent.intent === 'create-workspace') {
          const productResult = await productIntegrationService.getIntegration(
            queryIntent.productId
          );
          const createdContext = onCreateFromEip?.(
            productResult?.product,
            queryIntent.productId
          );
          if (!createdContext) {
            throw new Error('Perfect Fit could not create the workspace.');
          }
          const linked = await productIntegrationService.link(
            queryIntent.productId,
            createdContext,
            'EIP'
          );
          if (!active) return;
          onIntegrationChange?.(
            {
              ...(linked?.link || {}),
              eip_product_id: queryIntent.productId,
              status: 'LINKED'
            },
            createdContext.variant?.id
          );
          clearIntegrationIntentFromUrl();
          return;
        }

        if (queryIntent.intent === 'link-existing') {
          const linked = await productIntegrationService.link(
            queryIntent.productId,
            { project, style, variant },
            'EIP'
          );
          if (!active) return;
          onIntegrationChange?.({
            ...(linked?.link || {}),
            eip_product_id: queryIntent.productId,
            status: 'LINKED'
          });
          clearIntegrationIntentFromUrl();
        }
      } catch (error) {
        console.error('[PerfectFit EIP product link]', error);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [
    project,
    style,
    variant,
    queryIntent.intent,
    queryIntent.productId,
    onCreateFromEip,
    onIntegrationChange
  ]);

  return null;
}
