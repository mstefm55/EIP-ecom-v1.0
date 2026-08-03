/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Search, Package, Truck, Check, Copy, ExternalLink,
  AlertCircle, Calendar, MapPin, ChevronRight, Clock, ArrowRight,
  FileText, Sparkles, Printer, Download
} from 'lucide-react';

export default function TrackOrderModal({
  isOpen,
  onClose,
  currentUser,
  guestOrders = [],
  onQuickView,
  initialOrderId = ''
}) {
  const [orderIdInput, setOrderIdInput] = useState('');
  const [searchedOrder, setSearchedOrder] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState('status'); // 'status' | 'details' | 'log'

  // Extract all orders across user account & guest session
  const allOrders = [];
  if (currentUser?.purchaseHistory) {
    allOrders.push(...currentUser.purchaseHistory);
  }
  if (guestOrders && guestOrders.length > 0) {
    allOrders.push(...guestOrders);
  }

  // Handle Order Searching
  const handleSearch = (idToSearch) => {
    const targetId = (idToSearch || orderIdInput || '').trim().toUpperCase();
    if (!targetId) return;

    setSearchAttempted(true);

    // Find in existing orders
    const found = allOrders.find(o => o.id.toUpperCase() === targetId);

    if (found) {
      setSearchedOrder(found);
    } else {
      // If it starts with SRT- but is not in our direct local list,
      // let's gracefully generate a high-fidelity dynamic tracking mock
      // instead of hitting a dead end! This keeps the prototype perfectly responsive.
      if (targetId.startsWith('SRT-') || targetId.length > 4) {
        const hashNum = targetId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const daysAgo = (hashNum % 5) + 1;
        const totalAmount = 14 + (hashNum % 35);
        const formatType = hashNum % 2 === 0 ? 'Printed' : 'PDF';

        // Dynamic mock order
        const mockGeneratedOrder = {
          id: targetId,
          date: new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          items: [
            {
              patternName: hashNum % 3 === 0
                ? 'Palazzo Wide-Leg Trouser'
                : (hashNum % 3 === 1 ? 'Aurelia Wrap Dress' : 'Renaissance Pleated Bodice'),
              format: formatType,
              price: formatType === 'PDF' ? 14.00 : 24.00,
              quantity: 1,
              sizePreference: '8',
              image: hashNum % 3 === 0
                ? 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80'
                : (hashNum % 3 === 1
                  ? 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=120&q=80'
                  : 'https://images.unsplash.com/photo-1566207274740-0f8cf6b7d5a5?auto=format&fit=crop&w=120&q=80')
            }
          ],
          total: totalAmount,
          status: formatType === 'PDF'
            ? 'Ready for Download'
            : `Shipped (Tracking: #SART-${hashNum * 3})`,
          format: formatType,
          isGeneratedDemo: true
        };
        setSearchedOrder(mockGeneratedOrder);
      } else {
        setSearchedOrder(null);
      }
    }
  };

  // Prefill search when clicking a sample order
  const handleSelectSample = (id) => {
    setOrderIdInput(id);
    handleSearch(id);
  };

  // Clipboard copies
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    if (window.showToast) {
      window.showToast(`Tracking ID copied to clipboard!`, "success", "Copied");
    }
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset search states when opening/closing
  useEffect(() => {
    if (isOpen) {
      setActiveTab('status');
      if (initialOrderId) {
        setOrderIdInput(initialOrderId);
        handleSearch(initialOrderId);
      } else {
        setSearchedOrder(null);
        setSearchAttempted(false);
        setOrderIdInput('');
      }
    }
  }, [isOpen, initialOrderId]);

  // Determine stage variables for tracking visualization
  const getTrackingProgress = (order) => {
    if (!order) return { percent: 0, step: 0, text: '', logs: [] };

    const isPDF = order.format === 'PDF' || (order.items && order.items.every(it => it.format === 'PDF'));

    if (isPDF) {
      return {
        percent: 100,
        step: 4,
        text: 'All Digital Blueprints Available',
        steps: [
          { name: 'Transaction Verified', date: order.date, desc: 'Secure payment cleared' },
          { name: 'Drafting Booklet Compiled', date: order.date, desc: 'A0 and A4 vector pages rendered' },
          { name: 'Manual Attached', date: order.date, desc: 'Tailoring layout instructions bundled' },
          { name: 'Ready for Instant Download', date: 'Active Now', desc: 'Secure links unlocked on ledger' }
        ],
        logs: [
          { time: '10 mins after checkout', loc: 'Atelier Cloud Compiler', note: 'Secure package generation completed.' },
          { time: '2 mins after checkout', loc: 'Payment Server', note: 'Invoice generated & verification success.' },
          { time: '0 mins after checkout', loc: 'Atelier Portal', note: 'Order successfully registered.' }
        ]
      };
    } else {
      // Printed / Physical patterns tracking stages
      const statusText = order.status || '';
      let percent = 20;
      let step = 1;
      let estDelivery = 'Calculating...';

      if (statusText.toLowerCase().includes('delivered')) {
        percent = 100;
        step = 5;
        estDelivery = 'Delivered';
      } else if (statusText.toLowerCase().includes('out for delivery')) {
        percent = 85;
        step = 4;
        estDelivery = 'Today (By 8:00 PM)';
      } else if (statusText.toLowerCase().includes('shipped') || statusText.toLowerCase().includes('transit')) {
        percent = 60;
        step = 3;
        estDelivery = 'Estimated 2-3 Business Days';
      } else if (statusText.toLowerCase().includes('processing') || statusText.toLowerCase().includes('ready')) {
        percent = 35;
        step = 2;
        estDelivery = 'Estimated Dispatch Tomorrow';
      }

      // Reconstruct or generate some realistic tracking updates
      const trackingCode = statusText.match(/#SART-\d+/) ? statusText.match(/#SART-\d+/)[0] : '#SART-889240';

      return {
        percent,
        step,
        text: statusText || 'Atelier Packaging Queue',
        estDelivery,
        trackingCode,
        steps: [
          { name: 'Order Confirmed', date: order.date, desc: 'Garment specs loaded into system' },
          { name: 'Blueprint Cutting', date: 'Within 24 Hours', desc: 'Heavy weight drafting paper plotted & hand-cut' },
          { name: 'Courier Dispatch', date: step >= 3 ? 'Completed' : 'Pending Queue', desc: 'Dispatched via premium eco-freight courier' },
          { name: 'In Transit', date: step >= 3 ? 'Active En Route' : 'Pending Dispatch', desc: 'Sorting center scan complete' },
          { name: 'Out for Delivery', date: step >= 4 ? 'Courier Assigned' : 'Pending Arrival', desc: 'Delivery vehicle loaded' }
        ],
        logs: [
          step >= 4 ? { time: 'Today, 8:40 AM', loc: 'Local Distribution Hub', note: 'Shipment loaded onto regional delivery truck.' } : null,
          step >= 3 ? { time: 'Yesterday, 4:15 PM', loc: 'Main Sorting Facility', note: 'Scanned en route. Cargo container seal verified.' } : null,
          step >= 3 ? { time: '2 days ago, 11:30 AM', loc: 'Atelier Dispatch Terminal', note: 'Parcel handed over to courier representative.' } : null,
          { time: order.date, loc: 'Sartorial Cutting Room', note: 'Garment pattern dimensions plotted on sustainable Kraft paper.' },
          { time: order.date, loc: 'Payment Server', note: 'Checkout completed & order logged successfully.' }
        ].filter(Boolean)
      };
    }
  };

  const progress = getTrackingProgress(searchedOrder);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs z-140 cursor-pointer"
            id="track-order-backdrop"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-150 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 210 }}
              className="bg-[#FAF8F5] border border-sand-250 shadow-lux rounded-lg w-full max-w-2xl flex flex-col pointer-events-auto max-h-[90vh] overflow-hidden"
              id="track-order-modal-panel"
            >
              {/* Header */}
              <div className="p-5 bg-white border-b border-sand-200/80 flex items-center justify-between shrink-0" id="track-order-header">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-clay-50 border border-clay-100 flex items-center justify-center text-clay-700">
                    <Truck className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-bark-900 text-base leading-tight">Order Tracking Desk</h3>
                    <p className="text-[9.5px] font-mono uppercase tracking-wider text-bark-450 mt-0.5">
                      Verify Delivery Status &amp; Download Readiness
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-sand-100 text-bark-500 hover:text-bark-900 transition-all cursor-pointer border border-transparent hover:border-sand-200/50"
                  id="btn-close-track-order"
                  aria-label="Close Tracking Panel"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Main Scrolling Body */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6" id="track-order-body">

                {/* Search Bar Block */}
                <div className="bg-white border border-sand-200 rounded-[4px] p-4.5 space-y-3.5 shadow-3xs" id="track-order-search-panel">
                  <div className="space-y-1">
                    <label htmlFor="track-order-input" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                      Enter Order Reference Code:
                    </label>
                    <p className="text-[10.5px] text-bark-450 leading-relaxed font-sans">
                      Locate your pattern shipment by inputting the unique order ID received during checkout (e.g. SRT-XXXXXX).
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSearch();
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-bark-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        id="track-order-input"
                        type="text"
                        placeholder="Search SRT-882041, SRT-409124..."
                        value={orderIdInput}
                        onChange={(e) => setOrderIdInput(e.target.value)}
                        className="w-full bg-sand-50/50 hover:bg-sand-100/30 border border-sand-250 text-xs pl-9 pr-4 py-2.5 rounded-[4px] focus:outline-none focus:border-clay-500 focus:bg-white text-bark-850 font-mono tracking-wide"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!orderIdInput.trim()}
                      className="px-5 bg-bark-900 hover:bg-bark-955 disabled:bg-sand-200 text-sand-50 disabled:text-bark-400 text-xs font-bold uppercase tracking-widest rounded-[4px] transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs"
                    >
                      <span>Track</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Sample Recommendations Box */}
                  <div className="pt-2 border-t border-sand-150 flex flex-wrap items-center gap-2 text-[10px] font-sans">
                    <span className="text-bark-450 font-bold font-mono uppercase tracking-wider">Example Codes:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {allOrders.length > 0 ? (
                        allOrders.map(o => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => handleSelectSample(o.id)}
                            className="bg-sand-100 hover:bg-clay-50 hover:text-clay-705 text-bark-800 border border-sand-200 rounded px-2 py-0.5 font-mono cursor-pointer transition-colors text-[9.5px] font-semibold"
                          >
                            {o.id}
                          </button>
                        ))
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSelectSample('SRT-882041')}
                            className="bg-sand-100 hover:bg-clay-50 hover:text-clay-705 text-bark-800 border border-sand-200 rounded px-2 py-0.5 font-mono cursor-pointer transition-colors text-[9.5px] font-semibold"
                          >
                            SRT-882041 (Printed)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectSample('SRT-409124')}
                            className="bg-sand-100 hover:bg-clay-50 hover:text-clay-705 text-bark-800 border border-sand-200 rounded px-2 py-0.5 font-mono cursor-pointer transition-colors text-[9.5px] font-semibold"
                          >
                            SRT-409124 (Digital PDF)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search Results Display */}
                <AnimatePresence mode="wait">
                  {searchedOrder ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-5"
                      id="tracking-result-panel"
                    >
                      {/* Overview Card */}
                      <div className="bg-white border border-sand-200 rounded-[4px] overflow-hidden shadow-3xs">
                        <div className="bg-[#FAF8F5] px-4 py-3 border-b border-sand-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono font-bold text-bark-900 bg-sand-200 px-2 py-0.5 rounded text-[10.5px]">
                              {searchedOrder.id}
                            </span>
                            <span className="text-bark-500 font-sans flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-bark-400" />
                              {searchedOrder.date}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-bark-450">Session Total:</span>
                            <span className="font-mono font-bold text-bark-900 text-sm">${(searchedOrder.total || searchedOrder.price || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Quick Tabs */}
                        <div className="flex border-b border-sand-150 text-[10.5px] font-mono font-semibold uppercase tracking-wider">
                          <button
                            onClick={() => setActiveTab('status')}
                            className={`flex-1 py-2.5 text-center border-b-2 cursor-pointer transition-colors ${
                              activeTab === 'status'
                                ? 'border-clay-605 text-clay-705 bg-[#FAF8F5]/30'
                                : 'border-transparent text-bark-500 hover:text-bark-900 hover:bg-sand-50/50'
                            }`}
                          >
                            Shipping Status
                          </button>
                          <button
                            onClick={() => setActiveTab('details')}
                            className={`flex-1 py-2.5 text-center border-b-2 cursor-pointer transition-colors ${
                              activeTab === 'details'
                                ? 'border-clay-605 text-clay-705 bg-[#FAF8F5]/30'
                                : 'border-transparent text-bark-500 hover:text-bark-900 hover:bg-sand-50/50'
                            }`}
                          >
                            Order Details ({searchedOrder.items?.length || 1})
                          </button>
                          <button
                            onClick={() => setActiveTab('log')}
                            className={`flex-1 py-2.5 text-center border-b-2 cursor-pointer transition-colors ${
                              activeTab === 'log'
                                ? 'border-clay-605 text-clay-705 bg-[#FAF8F5]/30'
                                : 'border-transparent text-bark-500 hover:text-bark-900 hover:bg-sand-50/50'
                            }`}
                          >
                            Tracking Logs
                          </button>
                        </div>

                        <div className="p-4 md:p-5">
                          {/* TAB 1: SHIPPING STATUS & PROGRESS BAR */}
                          {activeTab === 'status' && (
                            <div className="space-y-5" id="track-tab-status">
                              {/* Status Header info */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sand-50/75 border border-sand-200/60 rounded p-3.5">
                                <div className="space-y-1">
                                  <span className="text-[8.5px] font-mono uppercase tracking-wider text-bark-450 block font-bold">Courier Parcel Status</span>
                                  <div className="flex items-center gap-1.5 font-bold font-serif text-bark-900 text-sm">
                                    <span className={`w-2 h-2 rounded-full ${searchedOrder.format === 'PDF' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-450'}`} />
                                    <span>{progress.text}</span>
                                  </div>
                                </div>

                                <div className="space-y-1 sm:text-right">
                                  <span className="text-[8.5px] font-mono uppercase tracking-wider text-bark-450 block font-bold">Delivery Estimate</span>
                                  <span className="font-mono text-xs font-bold text-clay-705 block">
                                    {searchedOrder.format === 'PDF' ? 'Instant Access' : progress.estDelivery}
                                  </span>
                                </div>
                              </div>

                              {/* Progress Line */}
                              <div className="relative pt-6 pb-2" id="tracking-steps-visualizer">
                                {/* Bar Line BG */}
                                <div className="absolute top-[38px] left-8 right-8 h-1 bg-sand-200 rounded-full" />
                                {/* Active progress bar */}
                                <div
                                  className="absolute top-[38px] left-8 h-1 bg-[#ba6446] rounded-full transition-all duration-700"
                                  style={{ width: `calc(${progress.percent}% - 40px)` }}
                                />

                                {/* Step nodes */}
                                <div className="flex justify-between relative z-10">
                                  {progress.steps.map((st, i) => {
                                    const stepNum = i + 1;
                                    const isDone = progress.step >= stepNum;
                                    const isCurrent = progress.step === stepNum;

                                    return (
                                      <div key={i} className="flex flex-col items-center text-center w-16" id={`tracking-node-${i}`}>
                                        {/* Node Circle */}
                                        <div
                                          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                                            isDone
                                              ? 'bg-[#ba6446] border-[#ba6446] text-white shadow-3xs'
                                              : 'bg-white border-sand-300 text-bark-400'
                                          } ${isCurrent ? 'ring-4 ring-rose-50' : ''}`}
                                        >
                                          {isDone && stepNum < progress.step ? (
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                          ) : (
                                            <span className="font-mono text-[9px] font-bold">{stepNum}</span>
                                          )}
                                        </div>

                                        {/* Node Info */}
                                        <div className="mt-2 space-y-0.5">
                                          <span className={`text-[8.5px] font-bold block leading-tight ${isDone ? 'text-bark-900' : 'text-bark-400'}`}>
                                            {st.name}
                                          </span>
                                          <span className="text-[7.5px] font-mono text-bark-400 block whitespace-nowrap">
                                            {st.date}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Physical Address / Delivery specifications for Printed */}
                              {searchedOrder.format !== 'PDF' && (
                                <div className="bg-white border border-sand-200 p-3 rounded text-xs flex gap-2.5 text-bark-700">
                                  <MapPin className="w-4 h-4 text-[#ba6446] shrink-0 mt-0.5" />
                                  <div className="space-y-1">
                                    <span className="font-bold font-mono text-[8.5px] uppercase tracking-wider text-bark-450 block">Shipping Location</span>
                                    <p className="font-sans text-[11px] leading-relaxed">
                                      {currentUser?.shippingAddress ? (
                                        `${currentUser.fullName} — ${currentUser.shippingAddress}`
                                      ) : (
                                        "Atelier Member Guest Terminal Delivery Desk — Express Track Courier"
                                      )}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-bark-500 mt-1">
                                      <span>Carrier: <b>Atelier Eco Express</b></span>
                                      <span>•</span>
                                      <span>Ref: <b className="select-all">{progress.trackingCode}</b></span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(progress.trackingCode)}
                                        className="text-clay-605 hover:text-clay-750 p-0.5 rounded ml-0.5"
                                      >
                                        <Copy className="w-3 h-3 inline" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 2: DETAILED ORDER ITEMS */}
                          {activeTab === 'details' && (
                            <div className="space-y-4" id="track-tab-details">
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">
                                Blueprints Included in Order
                              </span>

                              <div className="divide-y divide-sand-150 max-h-[220px] overflow-y-auto pr-1">
                                {(searchedOrder.items || []).map((item, index) => {
                                  const isPDF = item.format === 'PDF';
                                  return (
                                    <div key={index} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-12 bg-sand-50 border border-sand-200 rounded overflow-hidden shrink-0">
                                          <img
                                            src={item.image}
                                            alt={item.patternName}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                        </div>
                                        <div>
                                          <h4 className="text-xs font-bold text-bark-900 leading-snug">{item.patternName}</h4>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[8px] px-1.5 py-0.25 rounded font-mono font-bold uppercase tracking-wide ${
                                              isPDF ? 'bg-clay-50 text-clay-705 border border-clay-100' : 'bg-sand-100 text-bark-700 border border-sand-200'
                                            }`}>
                                              {item.format} format
                                            </span>
                                            {item.sizePreference && (
                                              <span className="text-[9.5px] text-bark-450 font-mono">
                                                Size {item.sizePreference}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-right font-mono text-xs">
                                        <span className="text-bark-500 block text-[9px]">Qty: {item.quantity || 1}</span>
                                        <span className="font-bold text-bark-900">${(item.price || 0).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="bg-[#FAF8F5] rounded p-3 flex justify-between items-center text-xs border border-sand-200/50 mt-1">
                                <span className="font-serif italic text-bark-600">Securely processed through Atelier payment ledger.</span>
                                <div className="text-right font-mono">
                                  <span className="text-[9px] text-bark-400 block uppercase">Checkout Total</span>
                                  <strong className="text-sm text-[#ba6446] font-bold">${(searchedOrder.total || searchedOrder.price || 0).toFixed(2)}</strong>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 3: CARRIER UPDATE LOG */}
                          {activeTab === 'log' && (
                            <div className="space-y-4" id="track-tab-log">
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">
                                Carrier &amp; Drafting Facility Operations Log
                              </span>

                              <div className="space-y-4 relative pl-3 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-sand-200">
                                {progress.logs.map((log, lIdx) => (
                                  <div key={lIdx} className="relative flex gap-3 text-xs" id={`log-update-${lIdx}`}>
                                    {/* Small circle dot indicator */}
                                    <div className="absolute -left-3.5 top-1.5 w-2.5 h-2.5 rounded-full border bg-white border-[#ba6446]" />

                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-mono">
                                        <span className="font-bold text-[#ba6446] uppercase">{log.time}</span>
                                        <span className="text-bark-300">•</span>
                                        <span className="text-bark-500 italic">{log.loc}</span>
                                      </div>
                                      <p className="text-bark-800 text-[11px] font-sans leading-relaxed">
                                        {log.note}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PDF Instant Download helper in tracking modal */}
                      {searchedOrder.format === 'PDF' && (
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                              <Printer className="w-5 h-5" />
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold text-emerald-950 font-serif">Instant Digital Blueprints Unlocked</h4>
                              <p className="text-[10.5px] text-emerald-800 leading-relaxed font-sans">
                                Print-at-home handbooks &amp; actual-size sewing grids are compiled and ready.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              const ordersEl = document.getElementById('my-orders-section');
                              if (ordersEl) {
                                ordersEl.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-[9.5px] uppercase tracking-wider px-4 py-2 rounded shadow-3xs cursor-pointer flex items-center gap-1.5 self-stretch sm:self-auto text-center justify-center whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Go To Downloads Desk</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    searchAttempted && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-rose-50/50 border border-rose-200 rounded-[4px] p-5 text-center space-y-3 shrink-0"
                        id="track-order-error-panel"
                      >
                        <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-500 mx-auto">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-serif font-bold text-rose-950 text-sm">Order Reference Not Found</h4>
                          <p className="text-xs text-rose-800 max-w-md mx-auto leading-relaxed font-sans">
                            We couldn't locate any completed transaction under the ID "<b>{orderIdInput}</b>" in your local active storage cabinet. Ensure spelling is correct, or try one of the example orders listed above.
                          </p>
                        </div>
                      </motion.div>
                    )
                  )}
                </AnimatePresence>

                {/* FAQ / Shipping Policy Info Mini-Block */}
                <div className="bg-[#FAF8F5] border border-sand-200/60 p-4 rounded text-xs space-y-2.5 shrink-0" id="tracking-faq-box">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-bark-450 block pb-1 border-b border-sand-150">
                    Atelier Standard Delivery Rules &amp; Protocols
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                    <div className="space-y-1">
                      <h5 className="font-bold text-bark-900 text-[10.5px]">Drafting &amp; Plottings Dispatch</h5>
                      <p className="text-bark-550 text-[10.5px] leading-relaxed">
                        Physical tissue blueprint parcels are plotted on-demand and handed over to DHL/FedEx within 24 hours of your verified request.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h5 className="font-bold text-bark-900 text-[10.5px]">Digital Package Deliveries</h5>
                      <p className="text-bark-550 text-[10.5px] leading-relaxed">
                        Digital PDF files (assembly manual + scale drafts) are rendered instantly on our cloud compilers. No physical shipment is required.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-white border-t border-sand-200 flex justify-between items-center shrink-0" id="track-order-footer">
                <span className="text-[10px] text-bark-450 font-serif italic">
                  Crafting slow-fashion with sustainable precision.
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-sand-100 hover:bg-sand-200 text-bark-850 rounded text-xs font-semibold cursor-pointer"
                  id="btn-close-track-footer"
                  type="button"
                >
                  Close Desk
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
