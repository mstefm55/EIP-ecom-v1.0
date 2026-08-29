import { EDITORIAL_ARTICLE_SEED } from '../data/runtimeSeeds';
import { useRuntimeCollectionState } from '../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../lib/runtimeDomainContracts';
import React, { useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Award, CheckCircle, Clock, Lock, ArrowRight, Bookmark, Sparkles, Filter, Eye } from 'lucide-react';
import PrintingGuide from './PrintingGuide';
import { UI_LAYERS } from '../lib/uiLayers';

export default function EditorialAcademy({ isLoggedIn, userRole }) {
  const [editorialArticles] = useRuntimeCollectionState(
    RUNTIME_DOMAINS.EDITORIAL_ARTICLES,
    EDITORIAL_ARTICLE_SEED
  );
  const [activeTab, setActiveTab] = useState('All');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [savedArticles, setSavedArticles] = useState([]);

  const tabs = ['All', 'L\'Atelier Gazette', 'Atelier Academy', 'Textile Directory', 'Printing Guide'];

  const filteredArticles = editorialArticles.filter(
    (article) => activeTab === 'All' || article.category === activeTab
  );

  const toggleSaveArticle = (id, e) => {
    e.stopPropagation();
    if (savedArticles.includes(id)) {
      setSavedArticles(savedArticles.filter((item) => item !== id));
    } else {
      setSavedArticles([...savedArticles, id]);
    }
  };

  const handleOpenArticle = (article) => {
    // If premium content and user is not logged in, prompt sign in or show lock
    setSelectedArticle(article);
  };

  return (
    <div className="bg-white rounded-[4px] border border-sand-200 p-6 md:p-8 space-y-8" id="editorial-academy-section">

      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-sand-100 pb-6" id="editorial-header">
        <div>
          <h2 className="text-3xl font-serif text-bark-900 font-normal tracking-tight" id="editorial-title">
            Editorial Gazette &amp; Academy Masterclasses
          </h2>
          <p className="text-xs text-bark-500 mt-1 font-sans">{pfUiT("ui.components.editorialacademy.2463afa9ae")}</p>
        </div>

        {/* Saved indicator */}
        {savedArticles.length > 0 && (
          <div className="bg-sand-50 border border-sand-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono text-bark-650" id="saved-indicator">
            <Bookmark className="w-3.5 h-3.5 text-clay-605 fill-clay-605" />
            <span>{pfUiT("ui.components.editorialacademy.aeaee177dd")}<b className="font-bold text-bark-900">{savedArticles.length} articles</b></span>
          </div>
        )}
      </div>

      {/* Tabs Filter */}
      <div className="flex flex-wrap items-center gap-1.5" id="editorial-tabs-row">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xs px-3.5 py-2 rounded-xl border font-medium transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-bark-900 border-bark-900 text-sand-50 font-semibold shadow-3xs'
                : 'bg-sand-50/50 border-sand-200 hover:border-sand-450 text-bark-750'
            }`}
            id={`editorial-tab-${tab.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Articles Grid or Printing Guide */}
      {activeTab === 'Printing Guide' ? (
        <PrintingGuide />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="editorial-articles-grid">
          {filteredArticles.map((article) => {
            const isSaved = savedArticles.includes(article.id);
            const isLocked = article.isPremium && !isLoggedIn;

            return (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => handleOpenArticle(article)}
                className="group bg-sand-50/30 border border-sand-200 rounded-[4px] overflow-hidden hover:border-sand-400 hover:bg-white transition-all duration-300 flex flex-col justify-between cursor-pointer"
                id={`editorial-card-${article.id}`}
              >
                <div>
                  {/* Header Image or Category cover */}
                  <div className="relative h-48 w-full bg-sand-100 overflow-hidden" id="article-img-wrapper">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-bark-900/90 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-md text-[9px] font-mono font-semibold uppercase tracking-widest text-sand-50">
                      {article.category}
                    </div>

                    {article.isPremium && (
                      <div className="absolute top-3 right-3 bg-clay-700/90 backdrop-blur-md text-white border border-clay-550 px-2.5 py-1 rounded-md text-[9px] font-mono font-bold flex items-center gap-1 uppercase tracking-wider">
                        <Lock className="w-2.5 h-2.5 text-amber-300" />
                        <span>{isLocked ? 'VIP Access' : 'Unlocked'}</span>
                      </div>
                    )}
                  </div>

                  {/* Content Block */}
                  <div className="p-5 space-y-2.5" id="article-content-wrapper">
                    <div className="flex justify-between items-center text-[10px] text-bark-450 font-mono">
                      <span>{article.readTime}</span>
                      <span>By {article.author}</span>
                    </div>

                    <h3 className="text-base font-serif font-semibold text-bark-900 group-hover:text-clay-700 transition-colors leading-snug">
                      {article.title}
                    </h3>

                    <p className="text-xs text-bark-600 leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  </div>
                </div>

                {/* Footer row */}
                <div className="p-5 pt-0 flex justify-between items-center border-t border-sand-100/50 mt-4" id="article-card-footer">
                  <div className="flex gap-1">
                    {article.tags.map((tag, idx) => (
                      <span key={idx} className="text-[9px] font-mono text-bark-500 bg-sand-100 px-2 py-0.5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => toggleSaveArticle(article.id, e)}
                      className="p-1.5 rounded-lg border border-sand-200 bg-white hover:bg-sand-100 transition-colors text-bark-600 cursor-pointer"
                      title={isSaved ? 'Remove Bookmark' : 'Bookmark Article'}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-clay-605 text-clay-605 border-clay-605' : ''}`} />
                    </button>
                    <span className="text-clay-605 font-mono text-xs flex items-center gap-1 font-semibold group-hover:translate-x-0.5 transition-transform">
                      {isLocked ? 'Unlock' : 'Read'} <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Selected Article Detail Modal / Reader */}
      <AnimatePresence>
        {selectedArticle && (
          <div
            className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs flex items-center justify-center p-4"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
            id="reader-modal-overlay"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-sand-300 w-full max-w-2xl rounded-[4px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
              style={{ zIndex: UI_LAYERS.modal }}
              id="reader-modal-body"
            >
              {/* Cover cover */}
              <div className="relative h-56 bg-sand-200 flex-shrink-0" id="reader-cover">
                <img
                  src={selectedArticle.image}
                  alt={selectedArticle.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-sm font-semibold cursor-pointer border border-white/25"
                  id="reader-close-btn"
                >
                  ✕
                </button>

                <div className="absolute bottom-4 left-5 right-5 text-white space-y-1">
                  <span className="text-[10px] font-mono tracking-widest text-clay-300 uppercase block">
                    {selectedArticle.category}
                  </span>
                  <h3 className="text-lg md:text-xl font-serif font-bold text-white leading-tight">
                    {selectedArticle.title}
                  </h3>
                </div>
              </div>

              {/* Inner Content scrollable */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-5 flex-1 font-sans text-bark-800" id="reader-scrollable-body">

                <div className="flex justify-between items-center text-xs text-bark-450 border-b border-sand-100 pb-3" id="reader-meta-row">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-clay-100 text-clay-700 flex items-center justify-center font-bold text-[10px]">
                      {selectedArticle.author.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-bark-900 block leading-tight">{selectedArticle.author}</span>
                      <span className="text-[9px] uppercase font-mono">{selectedArticle.role}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono text-[10px]">{selectedArticle.readTime}</span>
                    <span className="text-[9px] bg-sand-100 px-2 py-0.5 rounded text-bark-550 inline-block mt-0.5">{pfUiT("ui.components.editorialacademy.89d6e044a3")}</span>
                  </div>
                </div>

                {selectedArticle.isPremium && !isLoggedIn ? (
                  /* Blocked Premium Content for Guest */
                  <div className="p-6 bg-sand-50 border border-sand-200 rounded-[4px] text-center space-y-4" id="reader-premium-gate">
                    <div className="w-12 h-12 rounded-full bg-clay-50 border border-clay-100 flex items-center justify-center mx-auto text-clay-605">
                      <Lock className="w-5 h-5 animate-bounce" />
                    </div>
                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <h4 className="text-sm font-serif font-bold text-bark-900">{pfUiT("ui.components.editorialacademy.bd1a68396f")}</h4>
                      <p className="text-xs text-bark-550 leading-relaxed">{pfUiT("ui.components.editorialacademy.d38038c6d1")}<b>{pfUiT("ui.components.editorialacademy.d2519f9c12")}</b>{pfUiT("ui.components.editorialacademy.668cf9a699")}<b>{pfUiT("ui.components.editorialacademy.ae7c242c45")}</b>.
                      </p>
                    </div>
                    <div className="pt-2">
                      <p className="text-[10px] text-clay-605 font-mono uppercase tracking-widest font-semibold mb-3">{pfUiT("ui.components.editorialacademy.27f5bc408c")}</p>
                      <button
                        onClick={() => {
                          setSelectedArticle(null);
                          const el = document.getElementById('navigation-bar');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                          // Open login popup via a synthetic trigger
                          const widget = document.getElementById('header-profile-widget');
                          if (widget) widget.click();
                        }}
                        className="bg-bark-900 hover:bg-bark-800 text-sand-50 px-5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        id="gate-signin-btn"
                      >{pfUiT("ui.components.editorialacademy.a0b1dccd7e")}</button>
                    </div>
                  </div>
                ) : (
                  /* Standard Read view */
                  <div className="space-y-4 leading-relaxed text-xs sm:text-sm text-bark-750 font-sans" id="reader-text">
                    <p className="font-serif text-bark-900 text-base italic leading-relaxed bg-sand-50/50 border-l-2 border-clay-500 p-4 rounded-r-xl">
                      "{selectedArticle.excerpt}"
                    </p>
                    <p className="whitespace-pre-line text-bark-700">
                      {selectedArticle.content}
                    </p>
                    <p className="text-bark-700 pt-2">{pfUiT("ui.components.editorialacademy.7668282934")}</p>

                    <div className="border-t border-sand-100 pt-4 flex flex-wrap gap-2" id="reader-tags">
                      {selectedArticle.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] font-mono text-clay-700 bg-clay-50 border border-clay-100/60 px-2.5 py-1 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-[4px] p-4 mt-6 flex items-start gap-3" id="reader-pro-tip">
                      <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="text-xs font-semibold text-emerald-900">{pfUiT("ui.components.editorialacademy.c2839c94fb")}</h5>
                        <p className="text-[11px] text-emerald-850 mt-0.5 leading-relaxed">{pfUiT("ui.components.editorialacademy.1c5d054663")}<b>{pfUiT("ui.components.editorialacademy.0322079ac2")}</b>{pfUiT("ui.components.editorialacademy.530dffdec0")}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Row */}
              <div className="bg-sand-50 px-6 py-4 border-t border-sand-200/85 flex justify-end" id="reader-footer">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="bg-bark-900 hover:bg-bark-800 text-sand-50 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  id="reader-done-btn"
                >{pfUiT("ui.components.editorialacademy.736ce2b134")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
