/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Heart, Trash2, ShoppingCart, Eye, Sparkles, BookOpen, ChevronRight
} from 'lucide-react';

export default function WishlistDrawer({
  isOpen,
  onClose,
  favorites = [],
  patterns = [],
  onToggleFavorite,
  onAddToCart,
  onQuickView
}) {
  // Find all patterns that are favorited
  const favoritedPatterns = patterns.filter(p => favorites.includes(p.id));

  const handleRemove = (e, patternId) => {
    e.stopPropagation();
    onToggleFavorite(patternId);
  };

  const handleQuickView = (e, pattern) => {
    e.stopPropagation();
    onQuickView(pattern);
  };

  const handleAddToCart = (e, pattern) => {
    e.stopPropagation();
    // Use PDF format and default size of "8" or the first size from the list as default
    const defaultSize = pattern.sizes && pattern.sizes.length > 0 ? pattern.sizes[0] : '8';
    onAddToCart(pattern, 'PDF', defaultSize);
    if (window.showToast) {
      window.showToast(`"${pattern.name}" added to your styling ledger.`, 'success', 'Added to Cart');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs z-130 cursor-pointer"
            id="wishlist-backdrop"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 27, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-[#FAF8F5] border-l border-sand-250 shadow-lux flex flex-col z-135"
            id="wishlist-drawer-panel"
          >
            {/* Header */}
            <div className="p-5 border-b border-sand-200/80 bg-white flex items-center justify-between" id="wishlist-header">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                <div>
                  <h3 className="font-serif font-bold text-bark-900 text-base leading-tight">My Archive Wishlist</h3>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-bark-450">
                    Saved Blueprint References
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-sand-100 text-bark-500 hover:text-bark-900 transition-all cursor-pointer active:scale-95 border border-transparent hover:border-sand-200/50"
                id="btn-close-wishlist"
                type="button"
                aria-label="Close Wishlist"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4" id="wishlist-body">
              {favoritedPatterns.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4" id="wishlist-empty-state">
                  <div className="w-16 h-16 bg-rose-50/60 border border-rose-100 rounded-full flex items-center justify-center text-rose-400" id="wishlist-empty-icon">
                    <Heart className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-serif font-semibold text-bark-900 text-sm">Your Wishlist is Empty</h4>
                    <p className="text-xs text-bark-500 max-w-xs leading-relaxed">
                      Wander through our curated drafting cabinets and save your favorite pattern blueprints using the heart icons.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      const el = document.getElementById('digital-pattern-catalog') || document.getElementById('atelier-blueprint-catalog') || document.getElementById('atelier-faq-section-wrapper');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        window.scrollTo({ top: 800, behavior: 'smooth' });
                      }
                    }}
                    className="px-4 py-2 bg-bark-900 hover:bg-bark-950 text-sand-50 rounded-[4px] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-3xs hover:shadow-2xs transition-all active:scale-[0.98]"
                    id="wishlist-browse-btn"
                    type="button"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#ba6446]" />
                    <span>Browse Catalog Cabinet</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3" id="wishlist-items-list">
                  <div className="flex justify-between items-center text-[10px] font-mono uppercase text-bark-400 font-bold px-1 pb-1 border-b border-sand-200/50">
                    <span>Blueprint Spec</span>
                    <span>Actions</span>
                  </div>

                  {favoritedPatterns.map((pattern) => {
                    const price = pattern.pricePDF !== undefined ? pattern.pricePDF : (pattern.price !== undefined ? pattern.price : 14.00);
                    return (
                      <div
                        key={pattern.id}
                        className="bg-white border border-sand-200/70 hover:border-sand-300 rounded-[4px] p-3 flex items-center justify-between gap-3 shadow-3xs transition-all duration-200 group"
                        id={`wishlist-item-${pattern.id}`}
                      >
                        {/* Thumbnail & Meta */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            onClick={(e) => handleQuickView(e, pattern)}
                            className="w-12 h-16 bg-sand-50 border border-sand-200 rounded-sm overflow-hidden shrink-0 relative cursor-pointer group-hover:scale-[1.02] transition-transform duration-300"
                            id={`wishlist-thumb-${pattern.id}`}
                          >
                            <img
                              src={pattern.image}
                              alt={pattern.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="text-[8px] font-mono uppercase tracking-wider text-clay-700 bg-clay-50/70 border border-clay-100 px-1 py-0.25 rounded font-semibold">
                              {pattern.category}
                            </span>
                            <h4
                              onClick={(e) => handleQuickView(e, pattern)}
                              className="text-xs font-bold text-bark-900 leading-tight truncate mt-1 hover:text-clay-700 cursor-pointer font-serif"
                            >
                              {pattern.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-bark-500 font-mono">
                              <span>Difficulty: <strong className="text-bark-700 font-bold">{pattern.difficulty}</strong></span>
                              <span>•</span>
                              <span className="text-bark-850 font-bold">${price.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0" id={`wishlist-actions-${pattern.id}`}>
                          <button
                            onClick={(e) => handleQuickView(e, pattern)}
                            className="p-1.5 rounded-full border border-sand-200 hover:border-sand-300 hover:bg-sand-50 text-bark-600 hover:text-bark-900 transition-all cursor-pointer active:scale-95 shadow-3xs bg-white"
                            title="Quick View Specs"
                            type="button"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleAddToCart(e, pattern)}
                            className="p-1.5 rounded-full border border-[#ba6446]/20 hover:border-[#ba6446]/40 hover:bg-rose-50/10 text-clay-700 hover:text-clay-800 transition-all cursor-pointer active:scale-95 shadow-3xs bg-white"
                            title="Add to styling ledger"
                            type="button"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 text-[#ba6446]" />
                          </button>

                          <button
                            onClick={(e) => handleRemove(e, pattern.id)}
                            className="p-1.5 rounded-full border border-sand-200 hover:border-rose-200 hover:bg-rose-50 text-bark-500 hover:text-rose-600 transition-all cursor-pointer active:scale-95 shadow-3xs bg-white"
                            title="Remove from wishlist"
                            type="button"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {favoritedPatterns.length > 0 && (
              <div className="border-t border-sand-200 p-5 bg-white space-y-3" id="wishlist-footer">
                <div className="flex justify-between items-center text-xs text-bark-600">
                  <span className="font-mono uppercase font-bold">Total Saved Blueprints:</span>
                  <span className="font-mono font-bold text-bark-900 bg-sand-100 px-2 py-0.5 rounded">
                    {favoritedPatterns.length} Items
                  </span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    // Scroll to the patterns section
                    const el = document.getElementById('digital-pattern-catalog') || document.getElementById('atelier-blueprint-catalog');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-2.5 bg-bark-900 hover:bg-bark-955 text-sand-50 font-medium text-xs rounded-[4px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sans shadow-3xs uppercase tracking-wider"
                  id="btn-wishlist-view-all"
                  type="button"
                >
                  <span>Continue Catalog Exploration</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
