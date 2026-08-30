import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import {
  X, ShoppingBag, Trash2, ArrowRight, ShieldCheck, Mail,
  MapPin, CreditCard, ChevronRight, CheckCircle, Download, FileText, Printer, Scissors,
} from 'lucide-react';
import { UI_LAYERS } from '../lib/uiLayers';
import { resolveActivePromotion, resolvePromotionByCode } from '../lib/commercialPromotions';

const CHECKOUT_IMAGE_FIELDS = [
  'image',
  'primaryImage',
  'coverImage',
  'thumbnail',
  'thumbnailUrl',
  'mainImage',
  'imageUrl'
];

const getCheckoutPatternImage = (pattern = {}) => {
  const directCandidates = CHECKOUT_IMAGE_FIELDS
    .map((field) => pattern?.[field])
    .filter(Boolean);
  const nestedCandidates = [
    pattern?.primaryMediaAsset?.url,
    pattern?.media?.primaryAsset?.url,
    pattern?.presentationMediaItems?.find((item) => item?.url)?.url,
    pattern?.galleryMediaAssets?.find((item) => item?.url)?.url
  ].filter(Boolean);

  return [...directCandidates, ...nestedCandidates].find((candidate) =>
    String(candidate || '').trim()
  ) || '';
};

const getPatternInitials = (name = '') =>
  String(name || 'PF')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'PF';

export default function CheckoutDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  currentUser = null,
  commercialPromotions = [],
  onOrderSuccess = null,
  onTrackOrder = null
}) {
  // Steps: 'cart' | 'details' | 'payment' | 'receipt'
  const [step, setStep] = useState('cart');
  const [order, setOrder] = useState(null);
  const [downloadedItemIds, setDownloadedItemIds] = useState([]);
  const [cartClearedAfterDownloads, setCartClearedAfterDownloads] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    email: currentUser?.email || '',
    firstName: currentUser?.fullName ? currentUser.fullName.split(' ')[0] : '',
    lastName: currentUser?.fullName ? (currentUser.fullName.split(' ')[1] || '') : '',
    address: currentUser?.shippingAddress || '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    cardName: currentUser?.fullName || '',
    cardNumber: '',
    cardExpiry: '',
    cardCVC: '',
    paymentMethod: 'credit-card',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Promo Code States
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  // Totals calculations
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Calculate potential member discount
  const memberPromotion = resolveActivePromotion(commercialPromotions, currentUser);
  const discountPercent = memberPromotion?.discountPercent || 0;
  const discountAmount = (subtotal * discountPercent) / 100;

  // Calculate potential promo discount
  const promoDiscountPercent = appliedPromo ? appliedPromo.discountPercent : 0;
  const promoDiscountAmount = (subtotal * promoDiscountPercent) / 100;

  const totalDiscountAmount = discountAmount + promoDiscountAmount;
  const discountedSubtotal = Math.max(0, subtotal - totalDiscountAmount);

  // Current public catalogue fulfils digital pattern files only; delivery is free.
  const shipping = 0.00;
  const total = discountedSubtotal + shipping;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.firstName) errors.firstName = 'First name is required';
    if (!formData.lastName) errors.lastName = 'Last name is required';

    // Billing fields are required for order records.
    if (!formData.address) errors.address = 'Billing address is required for order records';
    if (!formData.city) errors.city = 'City required';
    if (!formData.state) errors.state = 'State / Province required';
    if (!formData.postalCode) errors.postalCode = 'Postal code required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
    } else {
      setStep('payment');
    }
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (formData.paymentMethod === 'credit-card') {
      if (!formData.cardName) errors.cardName = 'Name on card is required';
      if (!formData.cardNumber || formData.cardNumber.replace(/\s+/g, '').length < 16) {
        errors.cardNumber = 'Please enter a valid 16-digit card number';
      }
      if (!formData.cardExpiry || !/^\d{2}\/\d{2}$/.test(formData.cardExpiry)) {
        errors.cardExpiry = 'Format MM/YY required';
      }
      if (!formData.cardCVC || formData.cardCVC.length < 3) {
        errors.cardCVC = '3-digit CVC required';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
    } else {
      setIsSubmitting(true);

      // Simulate real bank authorization delay
      setTimeout(() => {
        const generatedOrderId = `SRT-${Math.floor(100000 + Math.random() * 900000)}`;
        const safeCustomerDetails = {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
          paymentMethod: formData.paymentMethod
        };
        const savedOrder = {
          orderId: generatedOrderId,
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          items: [...cartItems],
          subtotal,
          shipping,
          total,
          appliedPromo,
          promoDiscountAmount,
          discountAmount,
          customerDetails: safeCustomerDetails,
        };

        setOrder(savedOrder);
        setDownloadedItemIds([]);
        setCartClearedAfterDownloads(false);
        setIsSubmitting(false);
        setStep('receipt');
        if (onOrderSuccess) {
          onOrderSuccess(savedOrder);
        }
        if (window.showToast) {
          window.showToast(`Your order ${generatedOrderId} was placed successfully! Patterns are ready.`, "success", "Order Placed");
        }
        setAppliedPromo(null);
        setPromoCodeInput('');
        setPromoError('');
      }, 1500);
    }
  };

  // Helper formatting for credit cards
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatCardExpiry = (value) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  const getReceiptItemId = (item, index) => item.id || `${item.pattern?.id || 'pattern'}-${index}`;

  const handleDrawerClose = () => {
    if (cartClearedAfterDownloads) {
      setStep('cart');
    }
    onClose();
  };

  const handleDownloadPattern = (item, index) => {
    const itemId = getReceiptItemId(item, index);
    const nextDownloadedIds = Array.from(new Set([...downloadedItemIds, itemId]));
    setDownloadedItemIds(nextDownloadedIds);

    const fileContent = [
      'Perfect Fit digital pattern download',
      `Pattern: ${item.pattern?.name || 'Digital pattern'}`,
      `Format: ${item.format || 'PDF'}`,
      `Size preference: ${item.sizePreference || '8'}`,
      '',
      'This demo file represents the customer pattern bundle.'
    ].join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Perfect-Fit-${String(item.pattern?.name || 'pattern').replace(/[^a-z0-9]+/gi, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    if (window.showToast) {
      window.showToast(`Download started for "${item.pattern?.name || 'your pattern'}".`, "success", "Download Started");
    }

    const allDownloadsComplete = order?.items?.every((orderItem, orderIndex) =>
      nextDownloadedIds.includes(getReceiptItemId(orderItem, orderIndex))
    );

    if (allDownloadsComplete && !cartClearedAfterDownloads) {
      onClearCart?.();
      try {
        runtimeDataStorage.setItem('perfectfit_bureau_cart', JSON.stringify([]));
      } catch {}
      setCartClearedAfterDownloads(true);
      if (window.showToast) {
        window.showToast('All purchased pattern files were retrieved. Your active cart is now empty.', "success", "Cart Cleared");
      }
    }
  };

  const handleDownloadInvoicePdf = () => {
    if (!order) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 48;

    const addLine = (label, value, options = {}) => {
      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      doc.setFontSize(options.size || 10);
      doc.text(String(label), 48, y);
      if (value !== undefined) {
        doc.text(String(value), pageWidth - 48, y, { align: 'right' });
      }
      y += options.gap || 18;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Perfect Fit', 48, y);
    y += 26;
    doc.setFontSize(14);
    doc.text('Invoice / Receipt', 48, y);
    y += 28;

    addLine('Order reference', order.orderId);
    addLine('Date processed', order.date);
    addLine('Customer email / delivered to', order.customerDetails?.email || '—');
    addLine(
      'Billing details',
      `${order.customerDetails?.firstName || ''} ${order.customerDetails?.lastName || ''}, ${order.customerDetails?.address || ''}, ${order.customerDetails?.city || ''}`.replace(/\s+,/g, ',').trim()
    );

    y += 10;
    doc.setDrawColor(225, 213, 203);
    doc.line(48, y, pageWidth - 48, y);
    y += 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Items', 48, y);
    y += 20;

    order.items.forEach((item) => {
      const quantity = item.quantity || 1;
      const unitPrice = Number(item.price || 0);
      const lineTotal = unitPrice * quantity;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(item.pattern?.name || 'Digital pattern', 48, y);
      doc.text(`$${lineTotal.toFixed(2)}`, pageWidth - 48, y, { align: 'right' });
      y += 15;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Format: ${item.format || 'PDF'} · Size: ${item.sizePreference || '8'} · Qty: ${quantity} · Unit: $${unitPrice.toFixed(2)}`, 60, y);
      y += 20;
    });

    y += 8;
    doc.line(48, y, pageWidth - 48, y);
    y += 22;
    addLine('Subtotal', `$${order.subtotal.toFixed(2)}`);
    if (order.discountAmount > 0) addLine('Member discount', `-$${order.discountAmount.toFixed(2)}`);
    if (order.appliedPromo) addLine(`Promo discount (${order.appliedPromo.code})`, `-$${order.promoDiscountAmount.toFixed(2)}`);
    addLine('Digital delivery', 'Free');
    addLine('Grand total', `$${order.total.toFixed(2)}`, { bold: true, size: 12, gap: 24 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Digital pattern order. No physical shipment is included.', 48, y);
    y += 18;
    doc.text('Thank you for your order.', 48, y);

    doc.save(`Perfect-Fit-Invoice-${order.orderId}.pdf`);
  };

  return (
    <AnimatePresence id="checkout-drawer-animation">
      {isOpen && (
        <>
          {/* Dark Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={handleDrawerClose}
            className="fixed inset-0 bg-stone-900 cursor-zoom-out"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
            id="cart-backdrop"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col justify-between overflow-hidden"
            style={{ zIndex: UI_LAYERS.modal }}
            id="cart-panel-body"
          >
            {/* Header */}
            <div className="border-b border-sand-200 px-6 py-5 flex items-center justify-between bg-sand-50" id="cart-panel-header">
              <div className="flex items-center gap-2.5" id="cart-header-title">
                <ShoppingBag className="w-5 h-5 text-clay-700" id="bag-icon" />
                <h3 className="font-sans font-semibold text-lg text-bark-900" id="cart-title">
                  {step === 'receipt' ? 'Receipt & Patterns' : `Checkout (${cartItems.length} items)`}
                </h3>
              </div>
              <button
                onClick={handleDrawerClose}
                className="text-bark-400 hover:text-bark-700 transition-colors p-1"
                id="cart-close-btn"
              >
                <X className="w-5 h-5" id="x-icon" />
              </button>
            </div>

            {/* Stepper Progress Bar (Hidden during receipt) */}
            {step !== 'receipt' && (
              <div className="bg-sand-50/70 border-b border-sand-200/60 py-3 px-6 flex items-center justify-between text-xs font-semibold text-bark-400" id="checkout-stepper">
                <button
                  onClick={() => setStep('cart')}
                  className={`flex items-center gap-1.5 cursor-pointer ${step === 'cart' ? 'text-clay-700 font-semibold' : 'text-bark-600'}`}
                  id="step-tab-cart"
                >{pfUiT("ui.components.checkoutdrawer.ef96dfe4a8")}</button>
                <ChevronRight className="w-3.5 h-3.5 text-sand-300" />
                <button
                  onClick={() => cartItems.length > 0 && setStep('details')}
                  disabled={cartItems.length === 0}
                  className={`flex items-center gap-1.5 cursor-pointer ${step === 'details' ? 'text-clay-700 font-semibold' : cartItems.length > 0 ? 'text-bark-600' : 'text-sand-300'}`}
                  id="step-tab-details"
                >{pfUiT("ui.components.checkoutdrawer.1f8110e404")}</button>
                <ChevronRight className="w-3.5 h-3.5 text-sand-300" />
                <span className={step === 'payment' ? 'text-clay-700 font-semibold' : 'text-sand-300'} id="step-tab-payment">{pfUiT("ui.components.checkoutdrawer.8f0d160001")}</span>
              </div>
            )}

            {/* Body Content Areas */}
            <div className="flex-1 overflow-y-auto" id="cart-scroll-area">

              {/* STEP 1: CART OVERVIEW */}
              {step === 'cart' && (
                <div className="p-6 space-y-6" id="cart-step">
                  {cartItems.length === 0 ? (
                    <div className="text-center py-16 space-y-4" id="empty-cart-view">
                      <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto text-bark-400" id="icon-scissors-circle">
                        <Scissors className="w-7 h-7 stroke-[1.5]" id="empty-scissors" />
                      </div>
                      <div>
                        <h4 className="font-sans font-semibold text-bark-850">{pfUiT("ui.components.checkoutdrawer.e0e504752d")}</h4>
                        <p className="text-bark-400 text-xs mt-1 max-w-[280px] mx-auto leading-relaxed">{pfUiT("ui.components.checkoutdrawer.00e639c013")}</p>
                      </div>
                      <button
                        onClick={handleDrawerClose}
                        className="text-xs text-clay-700 bg-clay-50 hover:bg-clay-100 font-semibold px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        id="empty-close"
                      >{pfUiT("ui.components.checkoutdrawer.7cfa90d280")}<ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4" id="cart-items-list">
                      <AnimatePresence initial={false}>
                        {cartItems.map((item) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -10, transition: { duration: 0.2 } }}
                            className="flex gap-4 border-b border-sand-100 pb-4 overflow-hidden"
                            id={`item-${item.id}`}
                          >
                            {/* Image Thumbnail */}
                            <div className="relative w-16 h-20 bg-sand-100 rounded-lg overflow-hidden flex-shrink-0 border border-sand-200/50" id={`item-thumb-${item.id}`}>
                              <div className="absolute inset-0 flex items-center justify-center bg-sand-100 px-1 text-center font-serif text-sm leading-tight text-bark-500">
                                {getPatternInitials(item.pattern.name)}
                              </div>
                              {getCheckoutPatternImage(item.pattern) && (
                                <img
                                  src={getCheckoutPatternImage(item.pattern)}
                                  alt={item.pattern.name}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(event) => {
                                    event.currentTarget.style.display = 'none';
                                  }}
                                  id={`img-${item.id}`}
                                />
                              )}
                            </div>

                            {/* Content Details */}
                            <div className="flex-1 flex flex-col justify-between py-0.5" id={`item-text-${item.id}`}>
                              <div>
                                <div className="flex justify-between items-start">
                                  <h4 className="font-sans font-medium text-bark-900 text-sm">{item.pattern.name}</h4>
                                  <span className="font-mono text-sm font-semibold text-bark-900">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1" id={`item-tags-${item.id}`}>
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                                    item.format === 'PDF' ? 'bg-clay-50 text-clay-750 border border-clay-100' : 'bg-sand-100 text-bark-805 border border-sand-200'
                                  }`}>
                                    {item.format} Pattern
                                  </span>
                                  {item.sizePreference && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-sand-100 text-bark-500">
                                      Size {item.sizePreference} Target
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quantities & Delete Row */}
                              <div className="flex justify-between items-center mt-2" id="qty-row">
                                <div className="flex items-center border border-sand-200 rounded-md bg-sand-50/50" id="qty-stepper">
                                  <button
                                    onClick={() => onUpdateQuantity(item.id, -1)}
                                    className="px-2 py-0.5 text-bark-500 hover:bg-sand-200 rounded-l cursor-pointer"
                                    id="qty-down"
                                  >
                                    -
                                  </button>
                                  <span className="px-2.5 py-0.5 text-xs text-bark-800 font-mono font-medium">{item.quantity}</span>
                                  <button
                                    onClick={() => onUpdateQuantity(item.id, 1)}
                                    className="px-2 py-0.5 text-bark-500 hover:bg-sand-200 rounded-r cursor-pointer"
                                    id="qty-up"
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  onClick={() => onRemoveItem(item.id)}
                                  className="text-bark-300 hover:text-red-650 transition-colors pl-2 cursor-pointer"
                                  title={pfUiT("ui.components.checkoutdrawer.49e71ce55f")}
                                  id="remove-btn"
                                >
                                  <Trash2 className="w-3.5 h-3.5" id="trash-icon" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* Safety checkout badge */}
                      <div className="bg-sand-50 rounded-[4px] p-4 flex gap-3 items-start border border-sand-200 mt-6" id="safety-warning-banner">
                        <ShieldCheck className="w-4.5 h-4.5 text-clay-700 mt-0.5 flex-shrink-0" id="shield-icon" />
                        <div>
                          <p className="text-xs font-semibold text-bark-850 font-sans">{pfUiT("ui.components.checkoutdrawer.89c5aa866d")}</p>
                          <p className="text-[11px] text-bark-550 leading-normal">{pfUiT("ui.components.checkoutdrawer.a378c332bc")}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: CONTACT AND BILLING */}
              {step === 'details' && (
                <form onSubmit={handleDetailsSubmit} className="p-6 space-y-5" id="form-details">
                  <h4 className="text-sm font-semibold text-clay-800 font-serif uppercase tracking-widest flex items-center gap-1.5" id="details-section-title">
                    <Mail className="w-4 h-4 text-clay-605" id="mail-icon" />{pfUiT("ui.components.checkoutdrawer.897f585934")}</h4>

                  <div id="field-email-box">
                    <label className="block text-[10px] font-semibold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-email">{pfUiT("ui.components.checkoutdrawer.e752c37d3c")}</label>
                    <input
                      type="email"
                      id="input-email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder={pfUiT("ui.components.checkoutdrawer.6c40513a4c")}
                      className="w-full bg-sand-50/40 border border-sand-250 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500"
                    />
                    {formErrors.email && <p className="text-xs text-red-650 mt-1" id="err-email">{formErrors.email}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4" id="name-fields-grid">
                    <div>
                      <label className="block text-[10px] font-semibold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-firstName">{pfUiT("ui.components.checkoutdrawer.941ff6edf4")}</label>
                      <input
                        type="text"
                        id="input-firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder={pfUiT("ui.components.checkoutdrawer.5cbef1d2b9")}
                        className="w-full bg-sand-50/40 border border-sand-250 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500"
                      />
                      {formErrors.firstName && <p className="text-xs text-red-650 mt-1" id="err-firstname">{formErrors.firstName}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-lastName">{pfUiT("ui.components.checkoutdrawer.0a413efb20")}</label>
                      <input
                        type="text"
                        id="input-lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder={pfUiT("ui.components.checkoutdrawer.019e2bb2a9")}
                        className="w-full bg-sand-50/40 border border-sand-250 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500"
                      />
                      {formErrors.lastName && <p className="text-xs text-red-650 mt-1" id="err-lastname">{formErrors.lastName}</p>}
                    </div>
                  </div>

                  {/* Billing fields */}
                  <div className="p-4 rounded-[4px] border transition-all bg-clay-50/50 border-clay-200" id="shipping-address-container">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-bark-800 flex items-center gap-1.5" id="shipping-title-label">
                        <MapPin className="w-3.5 h-3.5 text-bark-450" id="map-pin-icon" />{pfUiT("ui.components.checkoutdrawer.a9d77f43b2")}</span>
                      <span className="text-[9px] bg-clay-200 text-clay-800 font-bold px-2 py-0.5 rounded uppercase" id="ship-alert-badge">{pfUiT("ui.components.checkoutdrawer.4325f8e562")}</span>
                    </div>

                    <div className="space-y-3" id="shipping-input-fields">
                      <div>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder={pfUiT("ui.components.checkoutdrawer.cf5118387a")}
                          className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-550"
                          id="input-address"
                        />
                        {formErrors.address && <p className="text-xs text-red-655 mt-1" id="err-address">{formErrors.address}</p>}
                      </div>

                      <div className="grid grid-cols-3 gap-2" id="address-block">
                        <div>
                          <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleInputChange}
                            placeholder={pfUiT("ui.components.checkoutdrawer.cdf454532f")}
                            className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                            id="input-city"
                          />
                          {formErrors.city && <p className="text-xs text-red-655 mt-1" id="err-city">{formErrors.city}</p>}
                        </div>

                        <div>
                          <input
                            type="text"
                            name="state"
                            value={formData.state}
                            onChange={handleInputChange}
                            placeholder={pfUiT("ui.components.checkoutdrawer.13ed9d9242")}
                            className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                            id="input-state"
                          />
                          {formErrors.state && <p className="text-xs text-red-655 mt-1" id="err-state">{formErrors.state}</p>}
                        </div>

                        <div>
                          <input
                            type="text"
                            name="postalCode"
                            value={formData.postalCode}
                            onChange={handleInputChange}
                            placeholder={pfUiT("ui.components.checkoutdrawer.b94a9a50a4")}
                            className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                            id="input-zip"
                          />
                          {formErrors.postalCode && <p className="text-xs text-red-655 mt-1" id="err-zip">{formErrors.postalCode}</p>}
                        </div>
                      </div>

                      <div>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer text-bark-800"
                          id="select-country"
                        >
                          <option value="United States">{pfUiT("ui.components.checkoutdrawer.1199c2578d")}</option>
                          <option value="United Kingdom">{pfUiT("ui.components.checkoutdrawer.c54c43bce9")}</option>
                          <option value="Canada">{pfUiT("ui.components.checkoutdrawer.8e3ce84000")}</option>
                          <option value="Australia">{pfUiT("ui.components.checkoutdrawer.293571e5f0")}</option>
                          <option value="France">{pfUiT("ui.components.checkoutdrawer.2ed9f5b51a")}</option>
                          <option value="Japan">{pfUiT("ui.components.checkoutdrawer.899ace48ef")}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="hidden" id="details-submit-hidden" />
                </form>
              )}

              {/* STEP 3: SECURE PAYMENT */}
              {step === 'payment' && (
                <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5" id="form-payment">
                  <h4 className="text-sm font-semibold text-clay-800 font-serif uppercase tracking-widest flex items-center gap-1.5" id="payment-section-title">
                    <CreditCard className="w-4 h-4 text-clay-605" id="card-icon" />{pfUiT("ui.components.checkoutdrawer.8b4ae0e7aa")}</h4>

                  <div className="bg-bark-900 border border-bark-950 text-sand-100 rounded-[4px] p-5 shadow-lg relative overflow-hidden" id="virtual-card">
                    <div className="absolute right-0 bottom-0 top-0 left-0 bg-radial from-bark-800/15 to-bark-950/50 pointer-events-none" />
                    <div className="flex justify-between items-start mb-6 z-10 relative">
                     <div id="card-style">
                        <span className="text-[10px] uppercase text-sand-400 tracking-widest font-mono">{pfUiT("ui.components.checkoutdrawer.b9a30a1ea8")}</span>
                        <p className="text-xs text-sand-300 font-serif italic mt-0.5">{pfUiT("ui.components.checkoutdrawer.8264516338")}</p>
                      </div>
                      <div className="w-10 h-7 bg-white/10 rounded-md backdrop-blur-xs flex items-center justify-center font-mono text-[9px] tracking-wider text-sand-50 font-bold" id="card-secure">
                        SECURE
                      </div>
                    </div>

                    <div className="space-y-4 z-10 relative" id="card-digits-holder">
                      <p className="text-xl font-mono tracking-[0.2em]" id="card-digits-preview">
                        {formData.cardNumber || '•••• •••• •••• ••••'}
                      </p>

                      <div className="flex justify-between items-end text-xs font-mono" id="card-names-preview">
                        <div>
                          <span className="text-[9px] text-sand-500 uppercase block mb-0.5">{pfUiT("ui.components.checkoutdrawer.0416ba169e")}</span>
                          <span className="text-sand-100 uppercase tracking-wider line-clamp-1 max-w-[150px]">
                            {formData.cardName || 'YOUR FULL NAME'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-sand-500 uppercase block mb-0.5">{pfUiT("ui.components.checkoutdrawer.0088656797")}</span>
                          <span className="text-sand-100 font-mono">
                            {formData.cardExpiry || 'MM/YY'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4" id="credit-payment-inputs">
                    <div>
                      <label className="block text-[10px] font-semibold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-cardName">{pfUiT("ui.components.checkoutdrawer.c5f2e5b036")}</label>
                      <input
                        type="text"
                        id="input-cardName"
                        name="cardName"
                        value={formData.cardName}
                        onChange={handleInputChange}
                        placeholder={pfUiT("ui.components.checkoutdrawer.dd53a6fab6")}
                        className="w-full bg-sand-50/40 border border-sand-250 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500"
                      />
                      {formErrors.cardName && <p className="text-xs text-red-655 mt-1" id="err-cardname">{formErrors.cardName}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-cardNumber">{pfUiT("ui.components.checkoutdrawer.fc87597780")}</label>
                      <input
                        type="text"
                        id="input-cardNumber"
                        name="cardNumber"
                        value={formData.cardNumber}
                        onChange={(e) => {
                          const formatted = formatCardNumber(e.target.value);
                          setFormData((prev) => ({ ...prev, cardNumber: formatted }));
                        }}
                        maxLength={19}
                        placeholder="4111 2222 3333 4444"
                        className="w-full bg-sand-50/40 border border-sand-250 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500"
                      />
                      {formErrors.cardNumber && <p className="text-xs text-red-655 mt-1" id="err-cardnumber">{formErrors.cardNumber}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4" id="cvc-dates-block">
                      <div>
                        <label className="block text-[10px] font-semibold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-cardExpiry">{pfUiT("ui.components.checkoutdrawer.2a24d96885")}</label>
                        <input
                          type="text"
                          id="input-cardExpiry"
                          name="cardExpiry"
                          maxLength={5}
                          value={formData.cardExpiry}
                          onChange={(e) => {
                            const formatted = formatCardExpiry(e.target.value);
                            setFormData((prev) => ({ ...prev, cardExpiry: formatted }));
                          }}
                          placeholder={pfUiT("ui.components.checkoutdrawer.2f858a3649")}
                          className="w-full bg-sand-50/40 border border-sand-250 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-550"
                        />
                        {formErrors.cardExpiry && <p className="text-xs text-red-655 mt-1" id="err-cardexpiry">{formErrors.cardExpiry}</p>}
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-cardCVC">{pfUiT("ui.components.checkoutdrawer.3904abbeba")}</label>
                        <input
                          type="text"
                          id="input-cardCVC"
                          name="cardCVC"
                          maxLength={3}
                          value={formData.cardCVC}
                          onChange={handleInputChange}
                          placeholder="245"
                          className="w-full bg-sand-50/40 border border-sand-250 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-550"
                        />
                        {formErrors.cardCVC && <p className="text-xs text-red-655 mt-1" id="err-cardcvc">{formErrors.cardCVC}</p>}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="hidden" id="payment-submit-hidden" />
                </form>
              )}

              {/* STEP 4: SEWING PATTERNS DOWNLOAD SLATE (RECEIPT) */}
              {step === 'receipt' && order && (
                <div className="p-6 space-y-6" id="receipt-step">
                  <div className="text-center py-2 space-y-2 border-b border-sand-200 pb-6" id="receipt-splash">
                    <div className="w-12 h-12 bg-clay-50 rounded-full flex items-center justify-center mx-auto text-clay-700 border border-clay-100" id="receipt-success-icon">
                      <CheckCircle className="w-6 h-6 animate-pulse" id="check-icon" />
                    </div>
                    <div>
                      <h4 className="font-sans font-semibold text-bark-900 text-lg">{pfUiT("ui.components.checkoutdrawer.f4636bd5cb")}</h4>
                      <p className="text-xs text-bark-550">
                        Thank you for your order, {order.customerDetails.firstName}! Your digital pattern files are ready.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end" id="receipt-invoice-actions">
                    <button
                      type="button"
                      onClick={handleDownloadInvoicePdf}
                      className="inline-flex items-center gap-2 rounded-lg border border-sand-250 bg-white px-3.5 py-2 text-xs font-semibold text-bark-800 transition-colors hover:bg-sand-50"
                      id="btn-download-invoice-pdf"
                    >
                      <FileText className="h-3.5 w-3.5" />{pfUiT("ui.components.checkoutdrawer.102a714427")}</button>
                  </div>

                  {/* Order Spec Specs */}
                  <div className="bg-sand-50 border border-sand-200 p-4 rounded-[4px] space-y-2.5 font-mono text-xs text-bark-600" id="receipt-details">
                    <div className="flex justify-between" id="r-id">
                      <span>{pfUiT("ui.components.checkoutdrawer.42bd7666d2")}</span>
                      <strong className="text-bark-900" id="span-order-id">{order.orderId}</strong>
                    </div>
                    <div className="flex justify-between" id="r-date">
                      <span>{pfUiT("ui.components.checkoutdrawer.7dca94392a")}</span>
                      <span className="text-bark-850">{order.date}</span>
                    </div>
                    <div className="flex justify-between" id="r-delivery">
                      <span>{pfUiT("ui.components.checkoutdrawer.02b65c912a")}</span>
                      <span className="text-bark-850" id="span-order-email">{order.customerDetails.email}</span>
                    </div>
                    <div className="border-t border-sand-150 pt-2 flex justify-between" id="r-subtotal">
                      <span>{pfUiT("ui.components.checkoutdrawer.aa0ee63f7a")}</span>
                      <span className="text-bark-850">${order.subtotal.toFixed(2)}</span>
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-semibold" id="r-discount-member">
                        <span>{pfUiT("ui.components.checkoutdrawer.d6227bc859")}</span>
                        <span>-${order.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {order.appliedPromo && (
                      <div className="flex justify-between text-emerald-700 font-semibold" id="r-discount-promo">
                        <span>Promo Code ({order.appliedPromo.code}):</span>
                        <span>-${order.promoDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between" id="r-shipping">
                      <span>{pfUiT("ui.components.checkoutdrawer.c7c382b622")}</span>
                      <span className="text-bark-850">{order.shipping > 0 ? `$${order.shipping.toFixed(2)}` : 'Free'}</span>
                    </div>
                    <div className="border-t border-sand-200 pt-2 flex justify-between font-serif text-sm font-semibold text-bark-900" id="r-total">
                      <span>{pfUiT("ui.components.checkoutdrawer.afdd04560d")}</span>
                      <span id="span-order-total">${order.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Dynamic digital downloads listed matching user choice */}
                  <div className="space-y-3" id="downloads-container">
                    <h5 className="text-[10px] font-bold text-bark-400 uppercase tracking-wider">
                      YOUR DIGITAL PATTERN FILES ({order.items.length})
                    </h5>

                    {order.items.map((item, idx) => (
                      (() => {
                        const receiptItemId = getReceiptItemId(item, idx);
                        const isDownloaded = downloadedItemIds.includes(receiptItemId);
                        return (
                      <div
                        key={receiptItemId}
                        className="p-3 bg-white border border-sand-250 rounded-[4px] flex items-center justify-between shadow-xs"
                        id={`downloadable-${idx}`}
                      >
                        <div className="flex items-center gap-3" id="dl-meta">
                          <div className="w-9 h-11 bg-sand-50 border border-sand-200 rounded-md flex items-center justify-center text-clay-800" id="dl-icon">
                            <FileText className="w-5 h-5 line-clamp-1 text-clay-700" id="file-icon" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-bark-900 leading-normal">{item.pattern.name}</p>
                            <span className="text-[9px] text-bark-450 uppercase tracking-wider block font-medium">{pfUiT("ui.components.checkoutdrawer.39b65452bf")}<b>{item.format}</b>{pfUiT("ui.components.checkoutdrawer.f0e9e5070f")}<b>{item.sizePreference || '8'}</b>
                            </span>
                          </div>
                        </div>

                        {/* Interactive download buttons simulating retrieval */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPattern(item, idx)}
                          className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-[10px] font-semibold cursor-pointer ${
                            isDownloaded
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-bark-900 text-sand-50 hover:bg-bark-950'
                          }`}
                          id="dl-btn"
                        >
                          {isDownloaded ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" id="dl-icon-done" />{pfUiT("ui.components.checkoutdrawer.b5a3b0229a")}</>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" id="dl-icon-down" />{pfUiT("ui.components.checkoutdrawer.4841e4eb79")}</>
                          )}
                        </button>
                      </div>
                        );
                      })()
                    ))}
                  </div>

                  {cartClearedAfterDownloads && (
                    <div className="rounded-[4px] border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" id="receipt-cart-cleared-note">
                      All purchased files have been retrieved. Your active cart has been cleared; the receipt remains available here until you close this drawer.
                    </div>
                  )}

                  <div className="space-y-3 bg-clay-50/40 rounded-[4px] p-4 border border-clay-100/60 text-bark-600" id="receipt-tips">
                    <h5 className="text-xs font-semibold text-clay-950 flex items-center gap-1.5" id="tips-title">
                      <Printer className="w-4 h-4 text-clay-705" id="print-icon" />{pfUiT("ui.components.checkoutdrawer.7d08231038")}</h5>
                    <ul className="list-disc list-inside text-[11px] leading-relaxed space-y-1.5 ml-1">
                      <li>{pfUiT("ui.components.checkoutdrawer.5bdaaa09fc")}<b>{pfUiT("ui.components.checkoutdrawer.0c5de71777")}</b>.</li>
                      <li>{pfUiT("ui.components.checkoutdrawer.35c62cb2f7")}</li>
                      <li>{pfUiT("ui.components.checkoutdrawer.a02f68141a")}</li>
                    </ul>
                  </div>

                  <div className="pt-2" id="receipt-close-bar">
                    <button
                      onClick={handleDrawerClose}
                      className="w-full py-3 bg-white border border-sand-250 hover:bg-sand-50 text-bark-800 font-sans font-semibold text-xs rounded-lg transition-colors cursor-pointer text-center"
                      id="btn-close-receipt-drawer"
                    >{pfUiT("ui.components.checkoutdrawer.9477b9c3c1")}</button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer containing Checkout actions or totals summary */}
            {step !== 'receipt' && (
              <div className="border-t border-sand-200 p-6 bg-sand-50 space-y-4" id="cart-footer">

                {/* Promo Code Input Section */}
                {step === 'cart' && (
                <div className="border-b border-sand-200/60 pb-3" id="promo-code-section">
                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 text-xs text-emerald-800" id="applied-promo-badge">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded uppercase">
                          {appliedPromo.code}
                        </span>
                        <span className="text-[10px] font-sans">Applied successfully ({appliedPromo.discountPercent}% off subtotal)</span>
                      </div>
                      <button
                        onClick={() => {
                          setAppliedPromo(null);
                          if (window.showToast) {
                            window.showToast("Promo code removed.", "info", "Promo Removed");
                          }
                        }}
                        className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-[10.5px] cursor-pointer"
                        id="remove-promo-btn"
                        type="button"
                      >{pfUiT("ui.components.checkoutdrawer.4968b1299d")}</button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={pfUiT("ui.components.checkoutdrawer.8b9edb7816")}
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            setPromoError('');
                          }}
                          className="flex-1 bg-white border border-sand-250 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500 uppercase font-mono"
                          id="input-promo-code"
                        />
                        <button
                          onClick={() => {
                            const trimmed = promoCodeInput.trim().toUpperCase();
                            if (!trimmed) {
                              setPromoError('Please enter a promo code');
                              return;
                            }
                            const promotion = resolvePromotionByCode(commercialPromotions, trimmed, currentUser);
                            if (promotion) {
                              setAppliedPromo(promotion);
                              setPromoCodeInput('');
                              setPromoError('');
                              if (window.showToast) {
                                window.showToast(`Promo code "${trimmed}" applied successfully!`, "success", `${promotion.discountPercent}% Discount`);
                              }
                            } else {
                              setPromoError('This promo code is invalid, inactive, expired, or unavailable for this account.');
                            }
                          }}
                          className="bg-bark-800 hover:bg-bark-900 text-white font-mono text-[10.5px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          id="btn-apply-promo"
                          type="button"
                        >{pfUiT("ui.components.checkoutdrawer.55957c56a4")}</button>
                      </div>
                      {promoError && (
                        <p className="text-[10px] text-red-655 font-medium" id="promo-error-msg">{promoError}</p>
                      )}
                      <div className="flex gap-1.5 overflow-x-auto py-0.5">
                        <span className="text-[9px] text-bark-450 whitespace-nowrap">{pfUiT("ui.components.checkoutdrawer.3ad4df46db")}</span>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Billing Summary List */}
                <div className="space-y-1.5 text-xs text-bark-605" id="billing-summary-box">
                  <div className="flex justify-between" id="sum-subtotal">
                    <span>{pfUiT("ui.components.checkoutdrawer.1c94a028de")}</span>
                    <strong className="text-bark-900 font-mono">${subtotal.toFixed(2)}</strong>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold" id="sum-member-discount">
                      <span className="flex items-center gap-1">✦ Artisan Member Discount (-{discountPercent}%)</span>
                      <strong className="font-mono">-${discountAmount.toFixed(2)}</strong>
                    </div>
                  )}
                  {promoDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold" id="sum-promo-discount">
                      <span className="flex items-center gap-1">🏷️ Promo Discount ({appliedPromo?.code} -{appliedPromo?.discountPercent}%)</span>
                      <strong className="font-mono">-${promoDiscountAmount.toFixed(2)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between" id="sum-shipping">
                    <span>{pfUiT("ui.components.checkoutdrawer.7a9b4e3c99")}</span>
                    <strong className="text-bark-900 font-mono">
                      {shipping > 0 ? `$${shipping.toFixed(2)}` : 'Free'}
                    </strong>
                  </div>
                  <div className="border-t border-sand-200 pt-2.5 flex justify-between text-sm font-semibold text-bark-900" id="sum-total">
                    <span>{pfUiT("ui.components.checkoutdrawer.236b892fed")}</span>
                    <strong className="text-bark-950 font-mono font-bold text-base">${total.toFixed(2)}</strong>
                  </div>
                </div>

                {/* Main Action CTAs based on active step status */}
                {step === 'cart' && (
                  <button
                    onClick={() => setStep('details')}
                    disabled={cartItems.length === 0}
                    className="w-full py-3 bg-bark-900 hover:bg-bark-950 disabled:bg-sand-150 disabled:text-bark-300 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed font-sans"
                    id="cta-continue-details"
                  >{pfUiT("ui.components.checkoutdrawer.809e1ce075")}<ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {step === 'details' && (
                  <div className="grid grid-cols-2 gap-3" id="details-actions">
                    <button
                      onClick={() => setStep('cart')}
                      className="py-3 bg-white border border-sand-250 hover:bg-sand-50 text-bark-600 font-medium text-xs rounded-lg transition-colors cursor-pointer font-sans"
                      id="cta-details-back"
                    >{pfUiT("ui.components.checkoutdrawer.104fb63b6c")}</button>
                    <button
                      onClick={() => {
                        // Trigger invisible native form validation on click
                        const submitBtn = document.getElementById('details-submit-hidden');
                        if (submitBtn) submitBtn.click();
                      }}
                      className="py-3 bg-bark-900 hover:bg-bark-955 text-white font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-1 justify-center cursor-pointer font-sans"
                      id="cta-details-next"
                    >{pfUiT("ui.components.checkoutdrawer.0d0005ffca")}</button>
                  </div>
                )}

                {step === 'payment' && (
                  <div className="grid grid-cols-2 gap-3" id="payment-actions">
                    <button
                      onClick={() => setStep('details')}
                      disabled={isSubmitting}
                      className="py-3 bg-white border border-sand-250 hover:bg-sand-50 text-bark-600 font-medium text-xs rounded-lg transition-all disabled:opacity-50 cursor-pointer font-sans"
                      id="cta-payment-back"
                    >{pfUiT("ui.components.checkoutdrawer.6be7c4a9eb")}</button>
                    <button
                      onClick={() => {
                        const submitBtn = document.getElementById('payment-submit-hidden');
                        if (submitBtn) submitBtn.click();
                      }}
                      disabled={isSubmitting}
                      className="py-3 bg-clay-700 hover:bg-clay-800 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1 justify-center disabled:bg-sand-200 cursor-pointer font-sans"
                      id="cta-payment-complete"
                    >
                      {isSubmitting ? 'Processing payment...' : `Complete secure order ($${total.toFixed(2)})`}
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
