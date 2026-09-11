import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import {
  X,
  ShoppingBag,
  Trash2,
  ArrowRight,
  Mail,
  MapPin,
  CreditCard,
  ChevronRight,
  CheckCircle,
  Download,
  FileText,
  Scissors,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { UI_LAYERS } from '../lib/uiLayers';
import { resolveActivePromotion, resolvePromotionByCode } from '../lib/commercialPromotions';
import {
  cancelPerfectFitPaymentSession,
  confirmPerfectFitPaymentSession,
  createPerfectFitOrder,
  createPerfectFitPaymentSession,
  fetchPerfectFitPaymentMethods,
  fetchPerfectFitPaymentSession
} from '../services/perfectFitCheckout';

const PENDING_CHECKOUT_KEY = 'perfectfit_pending_eip_checkout_v1';
const PAID_STATES = new Set(['paid', 'partially_refunded', 'refunded']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizePaymentCode = (value) => {
  const code = String(value || '').trim().toLowerCase();
  if (['credit_card', 'creditcard', 'bank_card'].includes(code)) return 'card';
  if (['paypal', 'pay_pal'].includes(code)) return 'paypal';
  if (['manual', 'manual_test', 'test'].includes(code)) return 'manual_test';
  if (['googlepay', 'google_pay'].includes(code)) return 'google_pay';
  if (['applepay', 'apple_pay'].includes(code)) return 'apple_pay';
  return code;
};

const normalizePaymentMethods = (payload = {}) => {
  const source = Array.isArray(payload?.methods)
    ? payload.methods
    : Array.isArray(payload?.payment?.methods)
      ? payload.payment.methods
      : [];

  return source
    .map((item) => ({
      ...item,
      code: normalizePaymentCode(item?.code || item?.method || item?.id),
      provider_code: String(item?.provider_code || item?.providerCode || '').trim().toLowerCase(),
      label: String(item?.label || item?.name || item?.code || 'Payment').trim(),
      enabled: item?.enabled !== false,
      available: item?.available !== false,
      visible: item?.visible !== false
    }))
    .filter((item) => item.code && item.enabled && item.available && item.visible);
};

const isPersistentUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const getWorkspaceTrustedImage = (pattern = {}) => {
  const candidates = [
    pattern?.primaryMediaAsset?.url,
    pattern?.workspacePrimaryMediaUrl,
    ...(Array.isArray(pattern?.presentationMediaItems)
      ? pattern.presentationMediaItems.map((item) => item?.url)
      : [])
  ];
  return candidates.find(isPersistentUrl) || '';
};

const getCommerceTrustedImage = (pattern = {}) => {
  const candidates = [
    pattern?.image,
    pattern?.primaryImage,
    pattern?.coverImage,
    pattern?.thumbnail,
    pattern?.thumbnailUrl,
    pattern?.mainImage,
    pattern?.imageUrl,
    pattern?.primaryMediaAsset?.url,
    ...(Array.isArray(pattern?.presentationMediaItems)
      ? pattern.presentationMediaItems.map((item) => item?.url)
      : [])
  ];
  return candidates.find(isPersistentUrl) || '';
};

const getCheckoutPatternImage = (pattern = {}) =>
  pattern?.workspaceOwned || pattern?.presentationSource === 'workspace'
    ? getWorkspaceTrustedImage(pattern)
    : getCommerceTrustedImage(pattern);

const sanitizePatternForPurchase = (pattern = {}) => {
  const image = getCheckoutPatternImage(pattern);
  const workspaceOwned = pattern?.workspaceOwned || pattern?.presentationSource === 'workspace';
  const persistentMediaItems = Array.isArray(pattern?.presentationMediaItems)
    ? pattern.presentationMediaItems.filter((item) => isPersistentUrl(item?.url))
    : [];
  const persistentGalleryAssets = Array.isArray(pattern?.galleryMediaAssets)
    ? pattern.galleryMediaAssets.filter((item) => isPersistentUrl(item?.url))
    : [];

  return {
    ...pattern,
    image,
    primaryImage: image,
    coverImage: image,
    thumbnail: image,
    thumbnailUrl: image,
    mainImage: image,
    imageUrl: image,
    presentationMediaItems: workspaceOwned ? persistentMediaItems : (pattern.presentationMediaItems || []),
    galleryMediaAssets: workspaceOwned ? persistentGalleryAssets : (pattern.galleryMediaAssets || []),
    primaryMediaAsset: pattern?.primaryMediaAsset
      ? {
          ...pattern.primaryMediaAsset,
          url: isPersistentUrl(pattern.primaryMediaAsset?.url) ? pattern.primaryMediaAsset.url : ''
        }
      : null
  };
};

const getPatternInitials = (name = '') =>
  String(name || 'PF')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'PF';

const resolveMaterialIdentity = (pattern = {}) => {
  const materialId = [
    pattern.eipProductId,
    pattern.material_id,
    pattern.materialId,
    pattern.integration?.eip?.productId
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean);

  if (materialId) return { material_id: materialId };

  const candidates = [
    pattern.materialCode,
    pattern.material_code,
    pattern.commerceMaterialCode,
    pattern.commerce_material_code,
    pattern.code,
    pattern.sku,
    pattern.productReference,
    pattern.reference
  ];
  const normalized = candidates
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const materialCode = normalized.find((value) => /^PRD[-_]/i.test(value)) || normalized[0] || '';

  if (UUID_RE.test(materialCode)) return { material_id: materialCode };
  return materialCode ? { material_code: materialCode } : {};
};

const numberValue = (...values) => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

const resolveServerTotal = (orderResult, paymentResult, fallback = 0) =>
  numberValue(
    paymentResult?.payment?.amount,
    orderResult?.quote?.totals?.total,
    orderResult?.quote?.grand_total,
    orderResult?.quote?.total,
    fallback
  ) ?? 0;

const resolveServerSubtotal = (orderResult, fallback = 0) =>
  numberValue(
    orderResult?.quote?.totals?.subtotal,
    orderResult?.quote?.subtotal,
    fallback
  ) ?? 0;

const getPaymentState = (payload = {}) =>
  String(
    payload?.payment?.lifecycle_state ||
      payload?.status ||
      payload?.payment?.status ||
      ''
  ).trim().toLowerCase();

const getPaymentRecord = (payload = {}) => payload?.payment || payload?.session || payload || {};

const trustedProviderRedirect = (value) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const resolveDigitalDownloadUrl = (item = {}) => {
  const pattern = item.pattern || {};
  const candidates = [
    item.downloadUrl,
    item.download_url,
    item.entitlement?.url,
    item.entitlement?.download_url,
    pattern.downloadUrl,
    pattern.download_url,
    pattern.digitalDownloadUrl,
    pattern.digital_download_url,
    pattern.pdfUrl,
    pattern.pdf_url,
    pattern.fileUrl,
    pattern.file_url,
    ...(Array.isArray(pattern.documents) ? pattern.documents : []),
    ...(Array.isArray(pattern?.media?.documents) ? pattern.media.documents : []),
    ...(Array.isArray(pattern?.raw?.attrs?.media?.documents) ? pattern.raw.attrs.media.documents : [])
  ];

  for (const candidate of candidates) {
    const value = typeof candidate === 'string'
      ? candidate
      : candidate?.url || candidate?.download_url || '';
    const normalized = String(value || '').trim();
    if (/^(https?:|blob:)/i.test(normalized)) return normalized;
  }
  return '';
};

export default function CheckoutDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  currentUser = null,
  commercialPromotions = [],
  onOrderSuccess = null
}) {
  const [step, setStep] = useState('cart');
  const [order, setOrder] = useState(null);
  const [downloadedItemIds, setDownloadedItemIds] = useState([]);
  const [cartClearedAfterDownloads, setCartClearedAfterDownloads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [pendingPaymentRef, setPendingPaymentRef] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: currentUser?.email || currentUser?.login || '',
    firstName: currentUser?.fullName ? currentUser.fullName.split(' ')[0] : '',
    lastName: currentUser?.fullName ? currentUser.fullName.split(' ').slice(1).join(' ') : '',
    address: currentUser?.shippingAddress || '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    paymentMethod: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  const subtotal = useMemo(
    () => cartItems.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0),
    [cartItems]
  );
  const memberPromotion = resolveActivePromotion(commercialPromotions, currentUser);
  const discountPercent = memberPromotion?.discountPercent || 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const promoDiscountPercent = appliedPromo?.discountPercent || 0;
  const promoDiscountAmount = (subtotal * promoDiscountPercent) / 100;
  const shipping = 0;
  const total = Math.max(0, subtotal - discountAmount - promoDiscountAmount) + shipping;

  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => ({
      ...prev,
      email: prev.email || currentUser?.email || currentUser?.login || '',
      firstName: prev.firstName || currentUser?.fullName?.split(' ')[0] || '',
      lastName: prev.lastName || currentUser?.fullName?.split(' ').slice(1).join(' ') || ''
    }));
  }, [isOpen, currentUser]);

  useEffect(() => {
    let cancelled = false;
    setPaymentMethodsLoading(true);
    fetchPerfectFitPaymentMethods()
      .then((payload) => {
        if (cancelled) return;
        const methods = normalizePaymentMethods(payload);
        setPaymentMethods(methods);
        setFormData((prev) => ({
          ...prev,
          paymentMethod: methods.some((item) => item.code === prev.paymentMethod)
            ? prev.paymentMethod
            : methods[0]?.code || ''
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setPaymentMethods([]);
        setCheckoutError(error?.message || 'Unable to load governed payment methods.');
      })
      .finally(() => {
        if (!cancelled) setPaymentMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistPendingCheckout = (snapshot) => {
    try {
      runtimeDataStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(snapshot));
    } catch {}
  };

  const loadPendingCheckout = () => {
    try {
      const raw = runtimeDataStorage.getItem(PENDING_CHECKOUT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const clearPendingCheckout = () => {
    try {
      runtimeDataStorage.removeItem(PENDING_CHECKOUT_KEY);
    } catch {}
  };

  const finalizePaidOrder = (pending, paymentPayload = {}) => {
    if (!pending) return;
    const payment = getPaymentRecord(paymentPayload);
    const paymentOrder = paymentPayload?.order || {};
    const serverTotal = numberValue(payment?.amount, pending.serverTotal, pending.total) ?? pending.total;
    const serverOrderCode = String(
      paymentOrder?.code || payment?.order_code || pending.orderCode || pending.orderId || ''
    ).trim();
    const savedOrder = {
      orderId: serverOrderCode,
      orderCode: serverOrderCode,
      serverOrderId: String(paymentOrder?.id || pending.serverOrderId || '').trim(),
      paymentCode: String(payment?.code || pending.paymentCode || '').trim(),
      source: 'EIP',
      date: pending.date || new Date().toLocaleString(),
      items: Array.isArray(pending.items) ? pending.items : [],
      subtotal: numberValue(pending.serverSubtotal, pending.subtotal) ?? 0,
      shipping: 0,
      total: serverTotal,
      appliedPromo: pending.appliedPromo || null,
      promoDiscountAmount: pending.promoDiscountAmount || 0,
      discountAmount: pending.discountAmount || 0,
      customerDetails: pending.customerDetails || {},
      payment: {
        code: String(payment?.code || pending.paymentCode || '').trim(),
        provider: payment?.provider || null,
        method: payment?.method || pending.paymentMethod || null,
        lifecycle_state: getPaymentState(paymentPayload) || 'paid'
      }
    };

    setOrder(savedOrder);
    setDownloadedItemIds([]);
    setCartClearedAfterDownloads(false);
    setPendingPaymentRef('');
    setCheckoutError('');
    setStep('receipt');
    clearPendingCheckout();
    onOrderSuccess?.(savedOrder);
    window.showToast?.(
      `Payment verified by EIP. Order ${serverOrderCode} is confirmed.`,
      'success',
      'Order Confirmed'
    );
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search || '');
    const returnStatus = String(params.get('eip_payment_status') || '').toLowerCase();
    const paymentCode = String(params.get('eip_payment_code') || '').trim();
    if (!paymentCode || !['approved', 'cancelled'].includes(returnStatus)) return;

    const pending = loadPendingCheckout();
    const providerSessionId = String(params.get('token') || '').trim();
    const clean = new URL(window.location.href);
    ['token', 'PayerID', 'eip_payment_status', 'eip_payment_code'].forEach((key) => clean.searchParams.delete(key));
    window.history.replaceState({}, '', clean.toString());

    setIsSubmitting(true);
    setPendingPaymentRef(paymentCode);
    const operation = returnStatus === 'cancelled'
      ? cancelPerfectFitPaymentSession(paymentCode, { return_flow: 'provider' })
      : confirmPerfectFitPaymentSession({
          payment_code: paymentCode,
          provider_session_id: providerSessionId || undefined,
          metadata: { source: 'perfect-fit-bureau', return_flow: 'provider' }
        });

    operation
      .then((result) => {
        if (returnStatus === 'cancelled') {
          clearPendingCheckout();
          setCheckoutError('Payment was cancelled. Your cart has been preserved.');
          setStep('payment');
          return;
        }
        if (PAID_STATES.has(getPaymentState(result))) {
          finalizePaidOrder(pending, result);
        } else {
          setCheckoutError('Payment is not yet verified. Check payment status again shortly.');
          setStep('payment');
        }
      })
      .catch((error) => {
        setCheckoutError(error?.message || 'Unable to verify provider payment.');
        setStep('payment');
      })
      .finally(() => setIsSubmitting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleDetailsSubmit = (event) => {
    event.preventDefault();
    const errors = {};
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Valid email required';
    if (!formData.firstName) errors.firstName = 'First name required';
    if (!formData.lastName) errors.lastName = 'Last name required';
    if (!formData.address) errors.address = 'Billing address required';
    if (!formData.city) errors.city = 'City required';
    if (!formData.state) errors.state = 'State / Province required';
    if (!formData.postalCode) errors.postalCode = 'Postal code required';
    setFormErrors(errors);
    if (!Object.keys(errors).length) {
      setCheckoutError('');
      setStep('payment');
    }
  };

  const buildPendingSnapshot = (orderResult, paymentResult, items, paymentMethod) => {
    const orderCode = String(orderResult?.order?.code || orderResult?.order_code || orderResult?.orderCode || '').trim();
    const serverOrderId = String(orderResult?.order?.id || '').trim();
    const payment = getPaymentRecord(paymentResult);
    return {
      orderCode,
      orderId: orderCode,
      serverOrderId,
      paymentCode: String(payment?.code || '').trim(),
      paymentMethod,
      date: new Date().toLocaleString(),
      items,
      subtotal,
      serverSubtotal: resolveServerSubtotal(orderResult, subtotal),
      total,
      serverTotal: resolveServerTotal(orderResult, paymentResult, total),
      appliedPromo,
      promoDiscountAmount,
      discountAmount,
      customerDetails: {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
        paymentMethod
      }
    };
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    setCheckoutError('');
    const selected = paymentMethods.find((method) => method.code === formData.paymentMethod);
    if (!selected) {
      setCheckoutError('Select an available EIP payment method.');
      return;
    }

    const safeItems = cartItems.map((item) => ({
      ...item,
      pattern: sanitizePatternForPurchase(item.pattern || {})
    }));
    const lines = safeItems.map((item) => ({
      ...resolveMaterialIdentity(item.pattern),
      quantity: Math.max(1, Number(item.quantity) || 1)
    }));
    const missingIndex = lines.findIndex((line) => !line.material_id && !line.material_code);
    if (missingIndex >= 0) {
      setCheckoutError(`\"${safeItems[missingIndex]?.pattern?.name || 'Product'}\" is not registered with EIP for checkout.`);
      return;
    }

    const currencies = Array.from(new Set(
      safeItems.map((item) => String(item.pattern?.currency || 'USD').trim().toUpperCase()).filter(Boolean)
    ));
    if (currencies.length > 1) {
      setCheckoutError('Mixed-currency carts are not supported.');
      return;
    }

    setIsSubmitting(true);
    try {
      const currency = currencies[0] || 'USD';
      const address = {
        line1: formData.address,
        city: formData.city,
        region: formData.state,
        postcode: formData.postalCode,
        country_name: formData.country
      };
      const orderResult = await createPerfectFitOrder({
        channel: 'WEB',
        currency,
        external_ref: `perfect-fit-${Date.now()}`,
        buyer: {
          agent_type: 'person',
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email
        },
        shipping_address: address,
        billing_address: address,
        line_items: lines,
        metadata: {
          source: 'perfect-fit-bureau',
          cart_count: safeItems.length,
          checkout: {
            payment_method: selected.code,
            payment_provider: selected.provider_code || null,
            digital_fulfilment: true
          },
          perfect_fit: {
            selections: safeItems.map((item, index) => ({
              ...(lines[index].material_id ? { material_id: lines[index].material_id } : {}),
              ...(lines[index].material_code ? { material_code: lines[index].material_code } : {}),
              format: item.format || 'PDF',
              size_preference: item.sizePreference || null
            }))
          }
        }
      });

      const orderCode = String(orderResult?.order?.code || orderResult?.order_code || orderResult?.orderCode || '').trim();
      const orderId = String(orderResult?.order?.id || '').trim();
      if (!orderCode && !orderId) throw new Error('EIP did not return an order reference.');

      const paymentResult = await createPerfectFitPaymentSession({
        order_code: orderCode || undefined,
        order_id: orderId || undefined,
        method: selected.code,
        provider_code: selected.provider_code || undefined,
        metadata: {
          source: 'perfect-fit-bureau',
          digital_fulfilment: true
        }
      });
      const payment = getPaymentRecord(paymentResult);
      const pending = buildPendingSnapshot(orderResult, paymentResult, safeItems, selected.code);
      persistPendingCheckout(pending);
      setPendingPaymentRef(payment.code || '');

      if (payment.client_action === 'redirect') {
        const redirectUrl = trustedProviderRedirect(payment.redirect_url);
        if (!redirectUrl) throw new Error('Payment provider did not return a safe checkout URL.');
        window.location.assign(redirectUrl);
        return;
      }

      let confirmation = paymentResult;
      if (payment.client_action === 'manual_test_confirm') {
        confirmation = await confirmPerfectFitPaymentSession({
          payment_id: payment.id,
          payment_code: payment.code,
          metadata: { source: 'perfect-fit-bureau', mode: 'manual_test' }
        });
      } else if (!PAID_STATES.has(getPaymentState(paymentResult)) && payment.code) {
        confirmation = await fetchPerfectFitPaymentSession(payment.code);
      }

      if (PAID_STATES.has(getPaymentState(confirmation))) {
        finalizePaidOrder(pending, confirmation);
        setAppliedPromo(null);
        setPromoCodeInput('');
        setPromoError('');
      } else {
        setStep('payment');
        setCheckoutError('Payment session created. Complete payment with the provider, then check status.');
      }
    } catch (error) {
      setCheckoutError(error?.message || 'EIP checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    const pending = loadPendingCheckout();
    const paymentRef = pendingPaymentRef || pending?.paymentCode;
    if (!paymentRef) {
      setCheckoutError('No pending payment reference is available.');
      return;
    }
    setIsSubmitting(true);
    setCheckoutError('');
    try {
      const result = await fetchPerfectFitPaymentSession(paymentRef);
      if (PAID_STATES.has(getPaymentState(result))) {
        finalizePaidOrder(pending, result);
      } else {
        setCheckoutError(`Payment is currently ${getPaymentState(result) || 'pending'}.`);
      }
    } catch (error) {
      setCheckoutError(error?.message || 'Unable to check payment status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReceiptItemId = (item, index) => item.id || `${item.pattern?.id || 'pattern'}-${index}`;

  const handleDownloadPattern = (item, index) => {
    const downloadUrl = resolveDigitalDownloadUrl(item);
    if (!downloadUrl) {
      window.showToast?.(
        `No governed digital file is attached to \"${item.pattern?.name || 'this pattern'}\". The order remains valid, but no placeholder file will be fabricated.`,
        'warning',
        'Pattern File Unavailable'
      );
      return;
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();

    const itemId = getReceiptItemId(item, index);
    const nextDownloadedIds = Array.from(new Set([...downloadedItemIds, itemId]));
    setDownloadedItemIds(nextDownloadedIds);

    const allDownloadsComplete = order?.items?.every((orderItem, orderIndex) =>
      nextDownloadedIds.includes(getReceiptItemId(orderItem, orderIndex))
    );
    if (allDownloadsComplete && !cartClearedAfterDownloads) {
      onClearCart?.();
      try {
        runtimeDataStorage.setItem('perfectfit_bureau_cart', JSON.stringify([]));
      } catch {}
      setCartClearedAfterDownloads(true);
      window.showToast?.('All purchased files were retrieved. Your active cart is now empty.', 'success', 'Cart Cleared');
    }
  };

  const handleDownloadInvoicePdf = () => {
    if (!order) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 48;
    const right = doc.internal.pageSize.getWidth() - 48;
    const line = (label, value, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.text(String(label), 48, y);
      doc.text(String(value ?? ''), right, y, { align: 'right' });
      y += 18;
    };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Perfect Fit', 48, y);
    y += 28;
    doc.setFontSize(13);
    doc.text('EIP Order Receipt', 48, y);
    y += 26;
    line('Order reference', order.orderId, true);
    line('Payment reference', order.paymentCode || '—');
    line('Date processed', order.date);
    line('Customer email', order.customerDetails?.email || '—');
    y += 8;
    order.items.forEach((item) => {
      line(item.pattern?.name || 'Digital pattern', `${item.quantity || 1} × ${item.format || 'PDF'}`);
    });
    y += 8;
    line('Grand total', `$${Number(order.total || 0).toFixed(2)}`, true);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Order and payment references are issued by EIP. Digital files are never replaced by demo placeholders.', 48, y);
    doc.save(`Perfect-Fit-Receipt-${order.orderId}.pdf`);
  };

  const handleDrawerClose = () => {
    if (cartClearedAfterDownloads) setStep('cart');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={handleDrawerClose}
            className="fixed inset-0 bg-stone-900 cursor-zoom-out"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden"
            style={{ zIndex: UI_LAYERS.modal }}
          >
            <div className="border-b border-sand-200 px-6 py-5 flex items-center justify-between bg-sand-50">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-clay-700" />
                <h3 className="font-sans font-semibold text-lg text-bark-900">
                  {step === 'receipt' ? 'Receipt & Patterns' : `Checkout (${cartItems.length} items)`}
                </h3>
              </div>
              <button onClick={handleDrawerClose} className="text-bark-400 hover:text-bark-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {step !== 'receipt' && (
              <div className="bg-sand-50/70 border-b border-sand-200/60 py-3 px-6 flex items-center justify-between text-xs font-semibold">
                {['cart', 'details', 'payment'].map((stage, index) => (
                  <React.Fragment key={stage}>
                    <button
                      type="button"
                      onClick={() => stage !== 'payment' && setStep(stage)}
                      className={step === stage ? 'text-clay-700' : 'text-bark-500'}
                    >
                      {stage === 'cart' ? 'Cart' : stage === 'details' ? 'Details' : 'Payment'}
                    </button>
                    {index < 2 && <ChevronRight className="w-3.5 h-3.5 text-sand-300" />}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {step === 'cart' && (
                <div className="p-6 space-y-5">
                  {!cartItems.length ? (
                    <div className="text-center py-16 space-y-4">
                      <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto text-bark-400">
                        <Scissors className="w-7 h-7" />
                      </div>
                      <h4 className="font-sans font-semibold text-bark-850">Your cart is empty</h4>
                    </div>
                  ) : cartItems.map((item) => {
                    const image = getCheckoutPatternImage(item.pattern || {});
                    return (
                      <div key={item.id} className="flex gap-4 border-b border-sand-100 pb-4">
                        <div className="relative w-16 h-20 bg-sand-100 rounded-lg overflow-hidden flex-shrink-0 border border-sand-200/50">
                          <div className="absolute inset-0 flex items-center justify-center font-serif text-bark-500">
                            {getPatternInitials(item.pattern?.name)}
                          </div>
                          {image && <img src={image} alt={item.pattern?.name || ''} className="absolute inset-0 w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between gap-3">
                            <div>
                              <h4 className="font-sans font-medium text-bark-900 text-sm">{item.pattern?.name}</h4>
                              <p className="text-[10px] text-bark-500 mt-1">{item.format || 'PDF'} · Size {item.sizePreference || '—'}</p>
                            </div>
                            <span className="font-mono text-sm font-semibold">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-3">
                            <div className="flex items-center border border-sand-200 rounded-md">
                              <button type="button" onClick={() => onUpdateQuantity(item.id, -1)} className="px-2 py-1">−</button>
                              <span className="px-2 text-xs font-mono">{item.quantity}</span>
                              <button type="button" onClick={() => onUpdateQuantity(item.id, 1)} className="px-2 py-1">+</button>
                            </div>
                            <button type="button" onClick={() => onRemoveItem(item.id)} className="text-bark-350 hover:text-red-650">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 'details' && (
                <form onSubmit={handleDetailsSubmit} className="p-6 space-y-4">
                  <h4 className="text-sm font-semibold text-clay-800 font-serif uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Customer & billing
                  </h4>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider mb-1">Email</label>
                    <input name="email" type="email" value={formData.email} onChange={handleInputChange} className="w-full border border-sand-250 rounded-lg px-4 py-2.5 text-sm" />
                    {formErrors.email && <p className="text-xs text-red-650 mt-1">{formErrors.email}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider mb-1">First name</label>
                      <input name="firstName" value={formData.firstName} onChange={handleInputChange} className="w-full border border-sand-250 rounded-lg px-4 py-2.5 text-sm" />
                      {formErrors.firstName && <p className="text-xs text-red-650 mt-1">{formErrors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider mb-1">Last name</label>
                      <input name="lastName" value={formData.lastName} onChange={handleInputChange} className="w-full border border-sand-250 rounded-lg px-4 py-2.5 text-sm" />
                      {formErrors.lastName && <p className="text-xs text-red-650 mt-1">{formErrors.lastName}</p>}
                    </div>
                  </div>
                  <div className="p-4 border border-clay-200 bg-clay-50/40 rounded-[4px] space-y-3">
                    <p className="text-xs font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Billing address</p>
                    <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Address line 1" className="w-full border border-sand-250 rounded-lg px-3 py-2 text-sm" />
                    {formErrors.address && <p className="text-xs text-red-650">{formErrors.address}</p>}
                    <div className="grid grid-cols-3 gap-2">
                      <input name="city" value={formData.city} onChange={handleInputChange} placeholder="City" className="border border-sand-250 rounded-lg px-3 py-2 text-sm" />
                      <input name="state" value={formData.state} onChange={handleInputChange} placeholder="State" className="border border-sand-250 rounded-lg px-3 py-2 text-sm" />
                      <input name="postalCode" value={formData.postalCode} onChange={handleInputChange} placeholder="Postcode" className="border border-sand-250 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <input name="country" value={formData.country} onChange={handleInputChange} placeholder="Country" className="w-full border border-sand-250 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button type="submit" className="hidden" id="details-submit-hidden" />
                </form>
              )}

              {step === 'payment' && (
                <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5">
                  <h4 className="text-sm font-semibold text-clay-800 font-serif uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Secure payment
                  </h4>

                  {paymentMethodsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-bark-500"><RefreshCw className="w-4 h-4 animate-spin" /> Loading payment methods…</div>
                  ) : !paymentMethods.length ? (
                    <p className="text-xs text-red-650 border border-red-200 bg-red-50 p-3 rounded">No governed payment method is currently available.</p>
                  ) : (
                    <div className="space-y-2">
                      {paymentMethods.map((method) => (
                        <label key={`${method.provider_code}-${method.code}`} className={`block border rounded-lg p-3 cursor-pointer ${formData.paymentMethod === method.code ? 'border-clay-600 bg-clay-50' : 'border-sand-250'}`}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.code}
                            checked={formData.paymentMethod === method.code}
                            onChange={handleInputChange}
                            className="mr-2"
                          />
                          <span className="text-sm font-semibold text-bark-850">{method.label}</span>
                          <span className="block ml-5 text-[10px] text-bark-450">{method.provider_code || 'EIP provider'}{method.mode ? ` · ${method.mode}` : ''}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {checkoutError && <p className="text-xs text-red-650 border border-red-200 bg-red-50 p-3 rounded">{checkoutError}</p>}
                  {pendingPaymentRef && (
                    <button type="button" onClick={handleCheckPaymentStatus} disabled={isSubmitting} className="inline-flex items-center gap-2 text-xs border border-sand-250 rounded-lg px-3 py-2">
                      <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} /> Check payment status
                    </button>
                  )}
                  <button type="submit" className="hidden" id="payment-submit-hidden" />
                </form>
              )}

              {step === 'receipt' && order && (
                <div className="p-6 space-y-6">
                  <div className="text-center border-b border-sand-200 pb-5">
                    <div className="w-12 h-12 bg-clay-50 rounded-full flex items-center justify-center mx-auto text-clay-700 border border-clay-100">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <h4 className="font-sans font-semibold text-bark-900 text-lg mt-2">Payment verified</h4>
                    <p className="text-xs text-bark-550">EIP order {order.orderId} · Payment {order.paymentCode || 'verified'}</p>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={handleDownloadInvoicePdf} className="inline-flex items-center gap-2 rounded-lg border border-sand-250 px-3.5 py-2 text-xs font-semibold">
                      <FileText className="w-4 h-4" /> Download receipt PDF
                    </button>
                  </div>
                  <div className="space-y-3">
                    {order.items.map((item, index) => {
                      const id = getReceiptItemId(item, index);
                      const downloaded = downloadedItemIds.includes(id);
                      const downloadUrl = resolveDigitalDownloadUrl(item);
                      return (
                        <div key={id} className="p-3 bg-white border border-sand-250 rounded-[4px] flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-bark-900">{item.pattern?.name || 'Digital pattern'}</p>
                            <span className="text-[9px] uppercase tracking-wider text-bark-450">{item.format || 'PDF'} · Size {item.sizePreference || '—'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadPattern(item, index)}
                            className={`inline-flex items-center gap-2 p-2 rounded-lg text-[10px] font-semibold ${downloaded ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : downloadUrl ? 'bg-bark-900 text-sand-50' : 'bg-sand-100 text-bark-400'}`}
                          >
                            {downloaded ? <CheckCircle className="w-3.5 h-3.5" /> : downloadUrl ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            {downloaded ? 'Downloaded' : downloadUrl ? 'Download pattern' : 'File unavailable'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {cartClearedAfterDownloads && (
                    <div className="rounded-[4px] border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                      All purchased files were retrieved. Your active cart has been cleared.
                    </div>
                  )}
                </div>
              )}
            </div>

            {step !== 'receipt' && (
              <div className="border-t border-sand-200 p-6 bg-sand-50 space-y-4">
                {step === 'cart' && (
                  <div className="border-b border-sand-200 pb-3">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between text-xs text-emerald-800">
                        <span>{appliedPromo.code} · {appliedPromo.discountPercent}% applied</span>
                        <button type="button" onClick={() => setAppliedPromo(null)}>Remove</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input value={promoCodeInput} onChange={(event) => { setPromoCodeInput(event.target.value.toUpperCase()); setPromoError(''); }} placeholder="Promo code" className="flex-1 border border-sand-250 rounded-lg px-3 py-1.5 text-xs" />
                        <button type="button" onClick={() => {
                          const code = promoCodeInput.trim().toUpperCase();
                          const promotion = resolvePromotionByCode(commercialPromotions, code, currentUser);
                          if (!promotion) {
                            setPromoError('Promo code is invalid, inactive, expired, or unavailable.');
                            return;
                          }
                          setAppliedPromo(promotion);
                          setPromoCodeInput('');
                        }} className="bg-bark-800 text-white text-xs px-3 rounded-lg">Apply</button>
                      </div>
                    )}
                    {promoError && <p className="text-[10px] text-red-650 mt-1">{promoError}</p>}
                  </div>
                )}
                <div className="text-xs text-bark-600 space-y-1">
                  <div className="flex justify-between"><span>Catalogue subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
                  {discountAmount > 0 && <div className="flex justify-between text-emerald-700"><span>Member discount</span><strong>-${discountAmount.toFixed(2)}</strong></div>}
                  {promoDiscountAmount > 0 && <div className="flex justify-between text-emerald-700"><span>Promo discount</span><strong>-${promoDiscountAmount.toFixed(2)}</strong></div>}
                  <div className="flex justify-between text-sm font-semibold text-bark-900 border-t border-sand-200 pt-2"><span>Displayed estimate</span><strong>${total.toFixed(2)}</strong></div>
                  <p className="text-[9px] text-bark-400">Final charge is recalculated from EIP pricing conditions when the order is created.</p>
                </div>

                {step === 'cart' && (
                  <button type="button" onClick={() => cartItems.length && setStep('details')} disabled={!cartItems.length} className="w-full py-3 bg-bark-900 disabled:bg-sand-200 text-white text-sm rounded-lg flex items-center justify-center gap-2">
                    Continue to details <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {step === 'details' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setStep('cart')} className="py-3 border border-sand-250 rounded-lg text-xs">Back</button>
                    <button type="button" onClick={() => document.getElementById('details-submit-hidden')?.click()} className="py-3 bg-bark-900 text-white rounded-lg text-xs">Continue to payment</button>
                  </div>
                )}
                {step === 'payment' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setStep('details')} disabled={isSubmitting} className="py-3 border border-sand-250 rounded-lg text-xs">Back</button>
                    <button type="button" onClick={() => document.getElementById('payment-submit-hidden')?.click()} disabled={isSubmitting || !paymentMethods.length} className="py-3 bg-clay-700 disabled:bg-sand-200 text-white rounded-lg text-xs">
                      {isSubmitting ? 'Processing with EIP…' : 'Create secure order'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
