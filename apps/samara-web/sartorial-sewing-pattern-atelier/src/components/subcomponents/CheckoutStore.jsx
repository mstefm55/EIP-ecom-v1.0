import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Trash2, ArrowRight, ShieldCheck, Mail,
  MapPin, CreditCard, ChevronRight, CheckCircle, Download, FileText, Printer, Scissors,
  Plus, Minus, Tag, Check, Award, Flame, Coins, Sparkles, ChevronLeft, RefreshCw, AlertCircle
} from 'lucide-react';
import { SEWING_PATTERNS, MASTER_SIZING_TABLE } from '../../data.js';

export default function CheckoutStore() {
  // Use first 8 patterns as the store items for curated choices
  const storePatterns = SEWING_PATTERNS.slice(0, 8);

  // Core Mock Cart State
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_mock_store_cart');
      return saved ? JSON.parse(saved) : [
        // Seed with one default item to look initialized and gorgeous immediately
        {
          id: 'sartorial-01-PDF',
          pattern: SEWING_PATTERNS[0],
          format: 'PDF',
          sizePreference: '8',
          price: SEWING_PATTERNS[0].pricePDF,
          quantity: 1
        }
      ];
    } catch {
      return [];
    }
  });

  // Keep mock cart state persisted in localStorage
  useEffect(() => {
    localStorage.setItem('sartorial_mock_store_cart', JSON.stringify(cart));
  }, [cart]);

  // Stepper state: 'cart' | 'details' | 'payment' | 'receipt'
  const [step, setStep] = useState('cart');

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState({ code: '', percentage: 0 });
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Selected size specifications display state
  const [selectedSizeForSpec, setSelectedSizeForSpec] = useState('8');

  // Form states
  const [formData, setFormData] = useState({
    email: 'couture.sewer@atelier.com',
    firstName: 'Margot',
    lastName: 'Leone',
    address: '142 Rue de l\'Atelier',
    city: 'Paris',
    state: 'Île-de-France',
    postalCode: '75001',
    country: 'France',
    cardName: 'Margot Leone',
    cardNumber: '',
    cardExpiry: '',
    cardCVC: '',
    paymentMethod: 'credit-card',
    shippingSpeed: 'standard'
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Catalog item choices for adding
  const [catalogSelections, setCatalogSelections] = useState(
    storePatterns.reduce((acc, p) => {
      acc[p.id] = { format: 'PDF', size: '8' };
      return acc;
    }, {})
  );

  // Handle format and size selection changes for catalog items
  const handleCatalogSelectionChange = (patternId, key, value) => {
    setCatalogSelections(prev => ({
      ...prev,
      [patternId]: {
        ...prev[patternId],
        [key]: value
      }
    }));
    if (key === 'size') {
      setSelectedSizeForSpec(value);
    }
  };

  // Add to cart operation
  const handleAddToCart = (pattern) => {
    const selection = catalogSelections[pattern.id] || { format: 'PDF', size: '8' };
    const format = selection.format;
    const size = selection.size;
    const compositeId = `${pattern.id}-${format}`;
    const price = format === 'PDF' ? pattern.pricePDF : pattern.pricePrinted;

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.id === compositeId);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [
          ...prevCart,
          {
            id: compositeId,
            pattern,
            format,
            sizePreference: size,
            price,
            quantity: 1
          }
        ];
      }
    });

    if (window.showToast) {
      window.showToast(
        `"${pattern.name}" (${format}) added to your store cart.`,
        'cart',
        'Added to Cart',
        { image: pattern.image, size: selection.size, format }
      );
    }
  };

  // Increment / Decrement Quantity
  const handleUpdateQuantity = (id, delta) => {
    setCart(prevCart =>
      prevCart.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  // Remove Item
  const handleRemoveItem = (id) => {
    setCart(prevCart => {
      const removed = prevCart.find(item => item.id === id);
      if (removed && window.showToast) {
        window.showToast(`Removed "${removed.pattern.name}" from cart.`, 'info', 'Item Removed');
      }
      return prevCart.filter(item => item.id !== id);
    });
  };

  // Calculate Totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = (subtotal * appliedDiscount.percentage) / 100;
  const discountedSubtotal = subtotal - discountAmount;

  // Shipping: printed goods standard shipping, digital is free
  const hasPrintedItems = cart.some(item => item.format === 'Printed');
  const shippingCost = hasPrintedItems
    ? (formData.shippingSpeed === 'express' ? 12.00 : 4.50)
    : 0.00;

  const total = discountedSubtotal + shippingCost;

  // Sizing specs for selected size
  const sizeSpec = MASTER_SIZING_TABLE.find(row => row.size === selectedSizeForSpec) || MASTER_SIZING_TABLE[4];

  // Apply Coupon
  const handleApplyCoupon = (e) => {
    e.preventDefault();
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) return;

    if (cleanCode === 'SARTORIAL20') {
      setAppliedDiscount({ code: 'SARTORIAL20', percentage: 20 });
      setCouponSuccess('Success! 20% discount applied to your order.');
      setCouponError('');
      if (window.showToast) window.showToast('20% coupon code applied!', 'success', 'Coupon Active');
    } else if (cleanCode === 'WELCOME10') {
      setAppliedDiscount({ code: 'WELCOME10', percentage: 10 });
      setCouponSuccess('Success! 10% discount applied.');
      setCouponError('');
      if (window.showToast) window.showToast('10% coupon code applied!', 'success', 'Coupon Active');
    } else {
      setCouponError('Invalid coupon code. Try SARTORIAL20 or WELCOME10.');
      setCouponSuccess('');
    }
  };

  // Remove Coupon
  const handleRemoveCoupon = () => {
    setAppliedDiscount({ code: '', percentage: 0 });
    setCouponCode('');
    setCouponSuccess('');
    setCouponError('');
    if (window.showToast) window.showToast('Coupon removed.', 'info', 'Coupon Cleared');
  };

  // Input fields handling
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => {
        const errors = { ...prev };
        delete errors[name];
        return errors;
      });
    }
  };

  // Step validation
  const validateDetails = () => {
    const errors = {};
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Valid email required for file delivery';
    }
    if (!formData.firstName) errors.firstName = 'First name required';
    if (!formData.lastName) errors.lastName = 'Last name required';

    if (hasPrintedItems) {
      if (!formData.address) errors.address = 'Mailing address is required for printed paper patterns';
      if (!formData.city) errors.city = 'City is required';
      if (!formData.postalCode) errors.postalCode = 'Postal code is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePayment = () => {
    const errors = {};
    const cleanNum = formData.cardNumber.replace(/\s+/g, '');
    if (!formData.cardName) errors.cardName = 'Name on card is required';
    if (!cleanNum || cleanNum.length < 16) errors.cardNumber = 'Valid 16-digit card number required';
    if (!formData.cardExpiry || !/^\d{2}\/\d{2}$/.test(formData.cardExpiry)) errors.cardExpiry = 'Expiry MM/YY format required';
    if (!formData.cardCVC || formData.cardCVC.length < 3) errors.cardCVC = '3-digit security CVC required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Navigate to Step 2
  const handleProceedToDetails = () => {
    if (cart.length === 0) return;
    setStep('details');
  };

  // Navigate to Step 3
  const handleProceedToPayment = (e) => {
    e.preventDefault();
    if (validateDetails()) {
      setStep('payment');
    }
  };

  // Complete Simulated Checkout
  const handleCompleteCheckout = (e) => {
    e.preventDefault();
    if (validatePayment()) {
      setIsSubmitting(true);

      // Simulate credit validation and authorization lag
      setTimeout(() => {
        const generatedId = `SRT-${Math.floor(100000 + Math.random() * 900000)}`;
        const receipt = {
          orderId: generatedId,
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          items: [...cart],
          subtotal,
          discountAmount,
          discountPercent: appliedDiscount.percentage,
          shippingCost,
          total,
          customer: { ...formData }
        };

        setOrderReceipt(receipt);
        setIsSubmitting(false);
        setStep('receipt');
        setCart([]); // Clear mock store cart upon success

        if (window.showToast) {
          window.showToast(`Order ${generatedId} processed! Download files ready.`, 'success', 'Purchase Complete');
        }
      }, 1800);
    }
  };

  // Helper formats
  const formatCardNumber = (val) => {
    const v = val.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const parts = [];
    for (let i = 0; i < v.length; i += 4) {
      parts.push(v.substring(i, i + 4));
    }
    return parts.length > 0 ? parts.join(' ').substring(0, 19) : v;
  };

  const formatCardExpiry = (val) => {
    const v = val.replace(/\D/g, '');
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`.substring(0, 5);
    }
    return v;
  };

  return (
    <div className="bg-white border border-sand-200 rounded-[4px] p-6 md:p-8 space-y-8 shadow-lux" id="atelier-mock-store-center">

      {/* Dynamic Header */}
      <div className="border-b border-sand-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-serif text-bark-950 font-light tracking-wide flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-clay-700" /> Seamless Checkout &amp; Selected Patterns View
          </h3>
          <p className="text-xs text-bark-600 mt-1 max-w-2xl leading-relaxed font-sans">
            Draft, choose, and securely buy patterns. Test checkout validation flows, virtual credit card flipping, and retrieve live blueprint PDF downloads.
          </p>
        </div>

        {/* Floating Mini Cart State indicator */}
        <div className="flex items-center gap-3 bg-sand-50 border border-sand-250 py-2 px-4 rounded-lg self-start md:self-auto shadow-3xs" id="store-mini-cart-pill">
          <div className="w-8 h-8 bg-clay-50 rounded-full flex items-center justify-center text-clay-700 relative">
            <ShoppingBag className="w-4 h-4" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-clay-700 text-white text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white animate-bounce">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
          <div className="text-left font-sans">
            <p className="text-[10px] text-bark-400 font-mono uppercase tracking-wider">Store Cart Value</p>
            <p className="text-xs font-bold text-bark-900">${total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Grid: Patterns Showcase (Left/Top) vs Checkout Wizard (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="store-layouts-row">

        {/* Left Column: Curated Store Catalog (5 cols) */}
        <div className="lg:col-span-5 space-y-6" id="store-patterns-column">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-bark-500 uppercase tracking-widest flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-clay-605" /> Pick Curated Blueprints
            </h4>
            <span className="text-[10px] font-mono text-bark-400">({storePatterns.length} items available)</span>
          </div>

          {/* Simple scrollable array of store items */}
          <div className="space-y-4 max-h-[640px] overflow-y-auto pr-2 custom-scrollbar" id="catalog-scroll-list">
            {storePatterns.map((pattern) => {
              const selection = catalogSelections[pattern.id] || { format: 'PDF', size: '8' };
              const currentPrice = selection.format === 'PDF' ? pattern.pricePDF : pattern.pricePrinted;

              return (
                <div
                  key={pattern.id}
                  className="bg-[#FAF8F5]/50 border border-sand-200/80 rounded-[4px] p-4 flex gap-4 hover:bg-white hover:border-clay-200 transition-all shadow-4xs group"
                  id={`catalog-card-${pattern.id}`}
                >
                  {/* Pattern Image Thumbnail */}
                  <div className="w-16 h-20 sm:w-20 sm:h-24 bg-sand-100 rounded-[3px] overflow-hidden flex-shrink-0 border border-sand-200" id={`catalog-img-${pattern.id}`}>
                    <img src={pattern.image} alt={pattern.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>

                  {/* Pattern Controls & Text */}
                  <div className="flex-1 flex flex-col justify-between" id={`catalog-meta-${pattern.id}`}>
                    <div>
                      <div className="flex justify-between items-start">
                        <h5 className="font-serif font-bold text-bark-900 text-sm">{pattern.name}</h5>
                        <span className="font-mono text-xs font-bold text-clay-700 bg-clay-50/80 border border-clay-100 px-1.5 py-0.5 rounded">
                          ${currentPrice.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] text-bark-450 mt-0.5 line-clamp-1">{pattern.tagline}</p>

                      {/* Configuration selectors row */}
                      <div className="flex gap-2 mt-2.5" id="catalog-selectors-row">
                        {/* Format Selection Selector */}
                        <div className="flex-1">
                          <label className="block text-[8px] font-mono text-bark-400 uppercase mb-0.5">Format</label>
                          <select
                            value={selection.format}
                            onChange={(e) => handleCatalogSelectionChange(pattern.id, 'format', e.target.value)}
                            className="w-full text-[10px] bg-white border border-sand-250 py-1 px-1.5 rounded focus:outline-none focus:border-clay-500 text-bark-800 font-sans font-medium"
                          >
                            <option value="PDF">PDF Blueprint</option>
                            <option value="Printed">Printed Tissue</option>
                          </select>
                        </div>

                        {/* Sizing Selector */}
                        <div className="w-18">
                          <label className="block text-[8px] font-mono text-bark-400 uppercase mb-0.5">Size</label>
                          <select
                            value={selection.size}
                            onChange={(e) => handleCatalogSelectionChange(pattern.id, 'size', e.target.value)}
                            className="w-full text-[10px] bg-white border border-sand-250 py-1 px-1.5 rounded focus:outline-none focus:border-clay-500 text-bark-800 font-mono font-medium"
                          >
                            {pattern.sizes.map(size => (
                              <option key={size} value={size}>Size {size}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Add to Cart button */}
                    <button
                      onClick={() => handleAddToCart(pattern)}
                      className="mt-3 py-1.5 w-full bg-bark-900 hover:bg-bark-955 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add To Mock Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Active Sizing Guide Specs panel */}
          <div className="bg-[#FAF8F5] border border-sand-200 p-4 rounded-[4px] space-y-3 shadow-4xs" id="sizing-quick-reference-specs">
            <span className="text-[9px] font-mono uppercase text-bark-400 block tracking-wider font-bold flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-clay-605" /> Verified Sizing Matrix (Size {selectedSizeForSpec})
            </span>
            <div className="grid grid-cols-3 gap-2 text-center" id="matrix-metrics-grid">
              <div className="bg-white border border-sand-200 p-2 rounded">
                <span className="text-[8px] font-mono text-bark-400 block uppercase">Bust</span>
                <span className="text-xs font-bold text-bark-800 font-mono">{sizeSpec.bust}"</span>
              </div>
              <div className="bg-white border border-sand-200 p-2 rounded">
                <span className="text-[8px] font-mono text-bark-400 block uppercase">Waist</span>
                <span className="text-xs font-bold text-bark-800 font-mono">{sizeSpec.waist}"</span>
              </div>
              <div className="bg-white border border-sand-200 p-2 rounded">
                <span className="text-[8px] font-mono text-bark-400 block uppercase">Hips</span>
                <span className="text-xs font-bold text-bark-800 font-mono">{sizeSpec.hips}"</span>
              </div>
            </div>
            <p className="text-[10px] text-bark-500 leading-relaxed italic text-center">
              *All patterns include 1.5cm standard seam allowances on drafting templates.
            </p>
          </div>
        </div>

        {/* Right Column: Interactive Multi-Step Checkout Wizard (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-start bg-[#FAF8F5]/30 border border-sand-200 rounded-[4px] p-5 sm:p-6 shadow-4xs" id="checkout-wizard-column">

          {/* Stepper Header Progress */}
          <div className="flex items-center justify-between border-b border-sand-200 pb-4 text-[10px] font-bold font-mono text-bark-400 select-none mb-6" id="checkout-stepper-header">
            <button
              onClick={() => step !== 'receipt' && setStep('cart')}
              className={`pb-1 border-b-2 transition-colors ${
                step === 'cart' ? 'text-clay-700 border-clay-700 font-extrabold' : 'border-transparent text-bark-500 hover:text-bark-900'
              }`}
            >
              01 Summary
            </button>
            <ChevronRight className="w-3 h-3 text-sand-300" />
            <button
              onClick={() => step !== 'receipt' && cart.length > 0 && setStep('details')}
              disabled={cart.length === 0 || step === 'receipt'}
              className={`pb-1 border-b-2 transition-colors ${
                step === 'details' ? 'text-clay-700 border-clay-700 font-extrabold' :
                cart.length > 0 && step !== 'receipt' ? 'border-transparent text-bark-500 hover:text-bark-900' : 'border-transparent text-sand-300 pointer-events-none'
              }`}
            >
              02 Address
            </button>
            <ChevronRight className="w-3 h-3 text-sand-300" />
            <button
              onClick={() => step !== 'receipt' && validateDetails() && setStep('payment')}
              disabled={cart.length === 0 || step === 'receipt'}
              className={`pb-1 border-b-2 transition-colors ${
                step === 'payment' ? 'text-clay-700 border-clay-700 font-extrabold' : 'border-transparent text-sand-300 pointer-events-none'
              }`}
            >
              03 Payment
            </button>
            <ChevronRight className="w-3 h-3 text-sand-300" />
            <span className={`pb-1 border-b-2 ${step === 'receipt' ? 'text-clay-700 border-clay-700 font-extrabold' : 'border-transparent text-sand-300'}`}>
              04 Download
            </span>
          </div>

          {/* Active Step Panel */}
          <div className="flex-1 min-h-[380px]" id="checkout-step-body">

            {/* STEP 1: CART SUMMARY REVIEW */}
            {step === 'cart' && (
              <div className="space-y-6" id="checkout-step-cart">
                {cart.length === 0 ? (
                  <div className="text-center py-16 space-y-3" id="mock-cart-empty-canvas">
                    <div className="w-14 h-14 bg-sand-100 rounded-full flex items-center justify-center mx-auto text-bark-400">
                      <Scissors className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-bark-900 text-sm">Your store cart is currently empty</h4>
                      <p className="text-xs text-bark-450 mt-1 max-w-xs mx-auto leading-relaxed">
                        Pick premium patterns from the curated showroom catalog on the left to initialize a dynamic checkout run.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4" id="mock-cart-populated-canvas">
                    <span className="text-[10px] font-mono uppercase text-bark-400 block tracking-wider font-bold">Review Selected Patterns &amp; Formats</span>

                    {/* Items List */}
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1" id="cart-items-scroll">
                      {cart.map((item) => (
                        <div key={item.id} className="bg-white border border-sand-200 rounded-[4px] p-3 flex justify-between items-center gap-4 shadow-3xs" id={`cart-item-${item.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-13 bg-sand-50 rounded overflow-hidden flex-shrink-0 border border-sand-200">
                              <img src={item.pattern.image} alt={item.pattern.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <h5 className="font-sans font-semibold text-bark-900 text-xs">{item.pattern.name}</h5>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                  item.format === 'PDF' ? 'bg-clay-50 text-clay-750 border border-clay-100' : 'bg-sand-100 text-bark-800 border border-sand-200'
                                }`}>
                                  {item.format} Pattern
                                </span>
                                <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-sand-100 text-bark-600 font-mono">
                                  Size {item.sizePreference}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Price and Quantities */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center border border-sand-200 rounded bg-sand-50/40 font-mono" id="cart-item-stepper">
                              <button
                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                className="px-1.5 py-0.5 text-bark-500 hover:bg-sand-200 rounded-l cursor-pointer text-xs"
                              >
                                -
                              </button>
                              <span className="px-2 text-xs font-semibold text-bark-800">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                className="px-1.5 py-0.5 text-bark-500 hover:bg-sand-200 rounded-r cursor-pointer text-xs"
                              >
                                +
                              </button>
                            </div>

                            <div className="text-right w-16">
                              <span className="text-xs font-mono font-bold text-bark-900 block">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-bark-300 hover:text-red-650 transition-colors p-1 shrink-0"
                              title="Remove item"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Coupons Promo Form */}
                    <form onSubmit={handleApplyCoupon} className="bg-white border border-sand-200 p-4 rounded-[4px] flex flex-col sm:flex-row items-stretch gap-3 mt-4" id="cart-coupons-panel">
                      <div className="flex-1 relative">
                        <Tag className="w-4 h-4 text-bark-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Coupon code (Try SARTORIAL20)"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="w-full bg-sand-50/40 border border-sand-250 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          Apply Code
                        </button>
                        {appliedDiscount.percentage > 0 && (
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </form>

                    {couponError && <p className="text-[11px] text-red-650 flex items-center gap-1.5" id="coupon-err-msg"><AlertCircle className="w-3.5 h-3.5" /> {couponError}</p>}
                    {couponSuccess && <p className="text-[11px] text-emerald-700 flex items-center gap-1.5" id="coupon-ok-msg"><Check className="w-3.5 h-3.5" /> {couponSuccess}</p>}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: ADDRESS & COURIER DETAIL */}
            {step === 'details' && (
              <form onSubmit={handleProceedToPayment} className="space-y-4" id="checkout-step-details">
                <span className="text-[10px] font-mono uppercase text-bark-400 block tracking-wider font-bold">Courier Records &amp; PDF Delivery</span>

                <div id="dt-email-field">
                  <label className="block text-[9px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="dt-email">
                    Email Address (For Printable PDF Delivery)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-bark-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      id="dt-email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="maker@atelier.com"
                      className="w-full bg-white border border-sand-250 rounded-lg pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500"
                    />
                  </div>
                  {formErrors.email && <p className="text-[10px] text-red-650 mt-1" id="dt-email-err">{formErrors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4" id="dt-names-row">
                  <div>
                    <label className="block text-[9px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="dt-firstName">First Name</label>
                    <input
                      type="text"
                      id="dt-firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="Margot"
                      className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500"
                    />
                    {formErrors.firstName && <p className="text-[10px] text-red-650 mt-1" id="dt-firstname-err">{formErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="dt-lastName">Last Name</label>
                    <input
                      type="text"
                      id="dt-lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Leone"
                      className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500"
                    />
                    {formErrors.lastName && <p className="text-[10px] text-red-650 mt-1" id="dt-lastname-err">{formErrors.lastName}</p>}
                  </div>
                </div>

                {/* Mailing sections, highlighted if printed paper tissues exist */}
                <div className={`p-4 rounded border ${
                  hasPrintedItems ? 'bg-clay-50/50 border-clay-200 shadow-3xs' : 'bg-sand-50/50 border-sand-200'
                }`} id="dt-shipping-section">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-bark-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-bark-450" />
                      Mailing Details (Physical Shipments)
                    </span>
                    {hasPrintedItems ? (
                      <span className="text-[8px] bg-clay-200 text-clay-800 font-bold px-2 py-0.5 rounded uppercase font-mono">PRINTED ITEMS REQUIRE SHIPPING</span>
                    ) : (
                      <span className="text-[9px] text-bark-450 italic">Digital delivery is instant and free</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Street Address"
                        className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500"
                        id="dt-address"
                      />
                      {formErrors.address && <p className="text-[10px] text-red-650 mt-1" id="dt-address-err">{formErrors.address}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-2" id="dt-city-block">
                      <div>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="City"
                          className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500"
                          id="dt-city"
                        />
                        {formErrors.city && <p className="text-[10px] text-red-650 mt-1" id="dt-city-err">{formErrors.city}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          placeholder="State"
                          className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2 text-xs focus:outline-none"
                          id="dt-state"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                          placeholder="ZIP Code"
                          className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500"
                          id="dt-zip"
                        />
                        {formErrors.postalCode && <p className="text-[10px] text-red-650 mt-1" id="dt-zip-err">{formErrors.postalCode}</p>}
                      </div>
                    </div>

                    {/* Shipping speed selection if physical */}
                    {hasPrintedItems && (
                      <div className="bg-white border border-sand-150 p-2.5 rounded-lg flex justify-between items-center mt-2 font-sans" id="dt-speed-toggles">
                        <span className="text-[10px] font-bold text-bark-600">Courier Delivery Option:</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, shippingSpeed: 'standard' }))}
                            className={`px-2 py-1 text-[9px] font-bold uppercase rounded ${
                              formData.shippingSpeed === 'standard' ? 'bg-bark-900 text-white' : 'bg-sand-100 text-bark-600 hover:bg-sand-200'
                            }`}
                          >
                            Standard ($4.50)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, shippingSpeed: 'express' }))}
                            className={`px-2 py-1 text-[9px] font-bold uppercase rounded ${
                              formData.shippingSpeed === 'express' ? 'bg-bark-900 text-white' : 'bg-sand-100 text-bark-600 hover:bg-sand-200'
                            }`}
                          >
                            Express ($12.00)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="hidden" id="details-submit-trigger" />
              </form>
            )}

            {/* STEP 3: PAYMENTS & BANK VERIFICATION */}
            {step === 'payment' && (
              <form onSubmit={handleCompleteCheckout} className="space-y-5" id="checkout-step-payment">
                <span className="text-[10px] font-mono uppercase text-bark-400 block tracking-wider font-bold">Secure Bank Verification (Sandbox Trial)</span>

                {/* Animated Virtual Credit Card */}
                <div
                  className="bg-bark-900 text-sand-50 rounded-xl p-5 shadow-lg relative overflow-hidden h-44 cursor-pointer select-none border border-bark-950 flex flex-col justify-between"
                  id="store-virtual-card"
                  onClick={() => setIsCardFlipped(!isCardFlipped)}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-bark-800/20 to-bark-950/60 pointer-events-none" />

                  <AnimatePresence mode="wait">
                    {!isCardFlipped ? (
                      <motion.div
                        key="front"
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        exit={{ opacity: 0, rotateY: -90 }}
                        transition={{ duration: 0.3 }}
                        className="h-full flex flex-col justify-between w-full relative z-10"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] uppercase text-sand-400 tracking-widest font-mono">THREAD &amp; PERFECT FIT</span>
                            <p className="text-[11px] text-sand-300 font-serif italic mt-0.5">Perfect Fit Couture</p>
                          </div>
                          <div className="px-2 py-1 bg-white/10 rounded font-mono text-[8px] tracking-wider text-sand-50 font-bold border border-white/5">
                            DEMO WORKSPACE
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-base sm:text-lg font-mono tracking-[0.18em]" id="front-card-number">
                            {formData.cardNumber || '•••• •••• •••• ••••'}
                          </p>
                          <div className="flex justify-between items-end text-xs font-mono">
                            <div>
                              <span className="text-[8px] text-sand-500 uppercase block mb-0.5">Cardholder</span>
                              <span className="text-sand-100 uppercase tracking-wider block truncate max-w-[150px]">
                                {formData.cardName || 'YOUR FULL NAME'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] text-sand-500 uppercase block mb-0.5">Expires</span>
                              <span className="text-sand-100 block">{formData.cardExpiry || 'MM/YY'}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="back"
                        initial={{ opacity: 0, rotateY: -90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        exit={{ opacity: 0, rotateY: 90 }}
                        transition={{ duration: 0.3 }}
                        className="h-full flex flex-col justify-between w-full relative z-10"
                      >
                        <div className="w-full h-8 bg-stone-950 absolute -left-5 -right-5 top-1" />

                        <div className="mt-11 flex justify-end items-center pr-3">
                          <span className="text-[8px] text-sand-500 uppercase font-mono mr-2">Secure Code</span>
                          <div className="bg-white text-bark-900 px-3 py-1 font-mono text-xs font-bold rounded tracking-widest bg-stripes">
                            {formData.cardCVC || '•••'}
                          </div>
                        </div>

                        <div className="text-[8.5px] font-mono text-sand-400 text-center leading-normal max-w-xs mx-auto">
                          SECURE SIMULATION WORKSPACE FOR COUTURE DEVS. NO TRANSFERS ACTIVE. CLICK CARD TO FLIP.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Card input forms */}
                <div className="space-y-4" id="credit-card-inputs">
                  <div>
                    <label className="block text-[9px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="cardName">Cardholder Name</label>
                    <input
                      type="text"
                      id="cardName"
                      name="cardName"
                      value={formData.cardName}
                      onChange={handleInputChange}
                      placeholder="Margot Leone"
                      className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500 font-sans"
                    />
                    {formErrors.cardName && <p className="text-[10px] text-red-650 mt-1" id="cardName-err">{formErrors.cardName}</p>}
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="cardNumber">Card Number</label>
                    <input
                      type="text"
                      id="cardNumber"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={(e) => {
                        const formatted = formatCardNumber(e.target.value);
                        setFormData(prev => ({ ...prev, cardNumber: formatted }));
                      }}
                      maxLength={19}
                      placeholder="4111 2222 3333 4444"
                      className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500 font-mono"
                      onFocus={() => setIsCardFlipped(false)}
                    />
                    {formErrors.cardNumber && <p className="text-[10px] text-red-650 mt-1" id="cardNumber-err">{formErrors.cardNumber}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4" id="card-cvc-dates-block">
                    <div>
                      <label className="block text-[9px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="cardExpiry">Expiration Date</label>
                      <input
                        type="text"
                        id="cardExpiry"
                        name="cardExpiry"
                        maxLength={5}
                        value={formData.cardExpiry}
                        onChange={(e) => {
                          const formatted = formatCardExpiry(e.target.value);
                          setFormData(prev => ({ ...prev, cardExpiry: formatted }));
                        }}
                        placeholder="MM/YY"
                        className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500 font-mono"
                        onFocus={() => setIsCardFlipped(false)}
                      />
                      {formErrors.cardExpiry && <p className="text-[10px] text-red-655 mt-1" id="cardExpiry-err">{formErrors.cardExpiry}</p>}
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="cardCVC">Security Code CVC</label>
                      <input
                        type="text"
                        id="cardCVC"
                        name="cardCVC"
                        maxLength={3}
                        value={formData.cardCVC}
                        onChange={handleInputChange}
                        placeholder="245"
                        className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-clay-500 font-mono"
                        onFocus={() => setIsCardFlipped(true)}
                        onBlur={() => setIsCardFlipped(false)}
                      />
                      {formErrors.cardCVC && <p className="text-[10px] text-red-655 mt-1" id="cardCVC-err">{formErrors.cardCVC}</p>}
                    </div>
                  </div>
                </div>

                <button type="submit" className="hidden" id="payment-submit-trigger" />
              </form>
            )}

            {/* STEP 4: ORDER RECEIPTS & DOWNLOAD SLATES */}
            {step === 'receipt' && orderReceipt && (
              <div className="space-y-6" id="checkout-step-receipt">
                <div className="text-center space-y-2 border-b border-sand-200 pb-5">
                  <div className="w-12 h-12 bg-clay-50 rounded-full flex items-center justify-center mx-auto text-clay-700 border border-clay-100">
                    <CheckCircle className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-bark-900 text-base">Atelier Invoice Paid &amp; Authorized</h4>
                    <p className="text-xs text-bark-550">
                      Order Reference: <b className="font-mono text-clay-700" id="receipt-order-id-label">{orderReceipt.orderId}</b>
                    </p>
                  </div>
                </div>

                {/* Sizing, invoice totals and date details ledger */}
                <div className="bg-white border border-sand-200 p-4 rounded-[4px] space-y-2 font-mono text-[11px] text-bark-600 shadow-3xs" id="invoice-details-card">
                  <div className="flex justify-between">
                    <span>Date Handled:</span>
                    <span className="text-bark-900 font-semibold">{orderReceipt.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Authorized To:</span>
                    <span className="text-bark-900 font-semibold truncate max-w-[180px]">{orderReceipt.customer.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Courier Address:</span>
                    <span className="text-bark-900 font-semibold truncate max-w-[180px]">{orderReceipt.customer.address}, {orderReceipt.customer.city}</span>
                  </div>
                  <div className="border-t border-sand-200 pt-2 flex justify-between font-serif text-xs font-bold text-bark-900">
                    <span>Invoice Net Paid:</span>
                    <span>${orderReceipt.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Downloadable blueprints buttons */}
                <div className="space-y-3" id="invoice-downloads-list">
                  <span className="text-[9px] font-mono uppercase text-bark-400 block tracking-wider font-bold">Authorized Pattern Downloads</span>
                  {orderReceipt.items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-white border border-sand-250 p-3 rounded-[4px] flex items-center justify-between shadow-3xs"
                      id={`receipt-download-${index}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-10 bg-sand-50 border border-sand-200 rounded flex items-center justify-center text-clay-800 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <h6 className="font-sans font-bold text-bark-900 text-xs">{item.pattern.name}</h6>
                          <span className="text-[9px] text-bark-500 font-mono uppercase block">
                            Size {item.sizePreference} • <b>{item.format}</b> Package
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (window.showToast) {
                            window.showToast(`Simulated download for "${item.pattern.name}" size ${item.sizePreference} package started.`, 'success', 'Blueprint Saved');
                          } else {
                            alert(`Downloading simulated ${item.pattern.name} complete pattern package! Includes sizing handbook and grading blueprints.`);
                          }
                        }}
                        className="p-1.5 bg-bark-900 hover:bg-bark-955 text-white rounded transition-all cursor-pointer flex items-center gap-1 text-[9.5px] font-semibold"
                        id={`btn-receipt-dl-${index}`}
                      >
                        <Download className="w-3.5 h-3.5" /> Retrieve Files
                      </button>
                    </div>
                  ))}
                </div>

                {/* Print instructions guidelines */}
                <div className="bg-clay-50/30 border border-clay-100 p-4 rounded-[4px] space-y-2" id="print-instructions-panel">
                  <h5 className="text-xs font-bold text-clay-950 flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-clay-700" /> Pattern Printing Guidelines
                  </h5>
                  <ul className="list-disc list-inside text-[11px] text-bark-600 leading-relaxed space-y-1 ml-1 font-sans">
                    <li>Always print PDF drafting schematics at <b>"Actual Size" / 100% scale</b>.</li>
                    <li>Verify the 2-inch calibration reference block on page 1 of drawings prior to pinning fabrics.</li>
                    <li>Detailed step-by-step assembly tips are nested in the illustrated digital handbook.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Footer Summaries and Action CTAs */}
          {step !== 'receipt' && (
            <div className="border-t border-sand-200 pt-5 mt-6 space-y-4" id="checkout-stepper-footer">

              {/* Grand summary of calculations list */}
              <div className="space-y-1.5 text-xs text-bark-600 font-sans" id="checkout-calculations-matrix">
                <div className="flex justify-between">
                  <span>Cart Items Subtotal:</span>
                  <strong className="text-bark-900 font-mono">${subtotal.toFixed(2)}</strong>
                </div>

                {appliedDiscount.percentage > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold" id="calc-discount">
                    <span className="flex items-center gap-1">✦ Applied Discount (-{appliedDiscount.percentage}%)</span>
                    <strong className="font-mono">-${discountAmount.toFixed(2)}</strong>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    Shipping &amp; Courier Fee
                    {hasPrintedItems && <span className="text-[9px] text-bark-400">({formData.shippingSpeed === 'express' ? 'Express Courier' : 'Standard Delivery'})</span>}
                  </span>
                  <strong className="text-bark-900 font-mono">
                    {shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : 'FREE (Digital PDF)'}
                  </strong>
                </div>

                <div className="border-t border-sand-200 pt-2 flex justify-between text-sm font-bold text-bark-900" id="calc-grand-total">
                  <span>Grand Total Net Invoice:</span>
                  <strong className="text-bark-950 font-mono text-base">${total.toFixed(2)}</strong>
                </div>
              </div>

              {/* Master trigger buttons based on step */}
              <div id="checkout-actions-row">
                {step === 'cart' && (
                  <button
                    onClick={handleProceedToDetails}
                    disabled={cart.length === 0}
                    className="w-full py-3 bg-bark-900 hover:bg-bark-955 disabled:bg-sand-150 disabled:text-bark-300 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider font-sans shadow-3xs"
                    id="btn-goto-address"
                  >
                    Proceed to Customer Address <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {step === 'details' && (
                  <div className="grid grid-cols-2 gap-3" id="details-step-actions">
                    <button
                      type="button"
                      onClick={() => setStep('cart')}
                      className="py-2.5 bg-white border border-sand-250 hover:bg-sand-50 text-bark-600 font-semibold text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      id="btn-details-back"
                    >
                      Back to Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const triggerBtn = document.getElementById('details-submit-trigger');
                        if (triggerBtn) triggerBtn.click();
                      }}
                      className="py-2.5 bg-bark-900 hover:bg-bark-955 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer uppercase tracking-wider shadow-3xs"
                      id="btn-details-next"
                    >
                      Payment Methods <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {step === 'payment' && (
                  <div className="grid grid-cols-2 gap-3" id="payment-step-actions">
                    <button
                      type="button"
                      onClick={() => setStep('details')}
                      disabled={isSubmitting}
                      className="py-2.5 bg-white border border-sand-250 hover:bg-sand-50 text-bark-600 font-semibold text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider disabled:opacity-50"
                      id="btn-payment-back"
                    >
                      Back to Address
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const triggerBtn = document.getElementById('payment-submit-trigger');
                        if (triggerBtn) triggerBtn.click();
                      }}
                      disabled={isSubmitting}
                      className="py-2.5 bg-clay-700 hover:bg-clay-800 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer uppercase tracking-wider disabled:bg-sand-200 shadow-3xs"
                      id="btn-payment-complete"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4.5 h-4.5 animate-spin mr-1" />
                          Verifying Card...
                        </>
                      ) : (
                        `Pay Total $${total.toFixed(2)}`
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Secure sandbox warning info */}
              <div className="p-3 bg-sand-100/50 rounded flex gap-2 items-start border border-sand-200/60" id="checkout-trust-banner">
                <ShieldCheck className="w-4 h-4 text-clay-700 mt-0.5 shrink-0" />
                <p className="text-[9.5px] text-bark-500 leading-normal">
                  <b>Sandbox Mode Security:</b> This storefront runs entirely on client local state. No real money is transferred, and card authorization details are simulated locally.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
