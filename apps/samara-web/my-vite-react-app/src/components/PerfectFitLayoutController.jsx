import React, { useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders, ArrowUp, ArrowDown, Eye, EyeOff, RefreshCw,
  Settings, Check, Layout, Code, HelpCircle, Save, SlidersHorizontal, ChevronRight, Sparkles
} from 'lucide-react';

export default function PerfectFitLayoutController({ appLayout, setAppLayout, onReset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [editSectionId, setEditSectionId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempDesc, setTempDesc] = useState('');

  const handleToggle = (id) => {
    setAppLayout(prev => prev.map(sec =>
      sec.id === id ? { ...sec, isEnabled: !sec.isEnabled } : sec
    ));
  };

  const handleMove = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === appLayout.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newLayout = [...appLayout];
    const temp = newLayout[index];
    newLayout[index] = newLayout[targetIndex];
    newLayout[targetIndex] = temp;
    setAppLayout(newLayout);
  };

  const handleStartEdit = (sec) => {
    setEditSectionId(sec.id);
    setTempTitle(sec.title || sec.name);
    setTempDesc(sec.description || '');
  };

  const handleSaveEdit = (id) => {
    setAppLayout(prev => prev.map(sec =>
      sec.id === id ? { ...sec, title: tempTitle, description: tempDesc } : sec
    ));
    setEditSectionId(null);
  };

  return (
    <div className="bg-white rounded-[4px] border border-sand-200 p-6 md:p-8 space-y-6 shadow-lux relative overflow-hidden" id="atelier-layout-controller-wrapper">
      <div className="absolute right-0 top-0 w-32 h-32 opacity-[0.02] bg-[radial-gradient(#ba6446_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="controller-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-clay-700 bg-clay-50 border border-clay-100/50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{pfUiT("ui.components.perfectfitlayoutcontroller.24937abf5f")}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <h3 className="text-2xl font-serif text-bark-950 font-light" id="controller-title">{pfUiT("ui.components.perfectfitlayoutcontroller.2351c5fd6c")}</h3>
          <p className="text-xs text-bark-500 font-sans">{pfUiT("ui.components.perfectfitlayoutcontroller.22f5945667")}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-4 py-2 bg-bark-900 hover:bg-bark-950 text-white text-[10px] font-mono font-bold uppercase rounded-[3px] shadow-3xs flex items-center gap-1.5 cursor-pointer select-none transition-all duration-300"
            id="btn-toggle-layout-manager"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-clay-400" />
            <span>{isOpen ? 'Close Engine Deck' : 'Open Engine Deck'}</span>
          </button>

          <button
            onClick={onReset}
            className="p-2 border border-sand-250 hover:bg-sand-100/30 text-bark-600 hover:text-bark-900 rounded-[3px] shadow-3xs transition-all cursor-pointer flex items-center justify-center"
            title={pfUiT("ui.components.perfectfitlayoutcontroller.6293ffea73")}
            id="btn-reset-layout-manager"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="pt-4 border-t border-sand-100 space-y-6"
            id="controller-expandable-panel"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: List of sections to manage */}
              <div className="lg:col-span-8 space-y-3" id="controller-sections-list">
                <div className="text-[10px] font-mono font-bold text-clay-700 tracking-wider uppercase pb-1 border-b border-sand-100">
                  Homepage Section Ordering &amp; Visibility Matrix
                </div>

                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2" id="sections-scroll-area">
                  {appLayout.map((sec, idx) => {
                    const isEditing = editSectionId === sec.id;
                    return (
                      <motion.div
                        key={sec.id}
                        layoutId={`sec-card-${sec.id}`}
                        className={`p-3.5 rounded-[3px] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FAF8F5]/60 hover:bg-white ${
                          sec.isEnabled ? 'border-sand-200' : 'border-sand-200/50 opacity-60 bg-sand-50/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-bark-400 w-6">
                            {String(idx + 1).padStart(2, '0')}
                          </span>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-bark-900 font-serif">
                                {sec.name}
                              </span>
                              <span className="text-[8px] font-mono font-semibold px-1.5 py-0.5 bg-sand-100 text-bark-500 rounded uppercase">
                                {sec.component}
                              </span>
                              <span className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                                sec.isEnabled
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {sec.isEnabled ? 'DISPLAYED' : 'DO NOT DISPLAY'}
                              </span>
                            </div>

                            {isEditing ? (
                              <div className="space-y-1.5 pt-2 max-w-md">
                                <input
                                  type="text"
                                  value={tempTitle}
                                  onChange={e => setTempTitle(e.target.value)}
                                  placeholder={pfUiT("ui.components.perfectfitlayoutcontroller.f84d53b6dd")}
                                  className="w-full text-xs font-sans p-1.5 border border-sand-250 bg-white rounded focus:outline-none focus:border-clay-500"
                                />
                                <input
                                  type="text"
                                  value={tempDesc}
                                  onChange={e => setTempDesc(e.target.value)}
                                  placeholder={pfUiT("ui.components.perfectfitlayoutcontroller.e8e066a0f4")}
                                  className="w-full text-[10px] font-sans p-1.5 border border-sand-250 bg-white rounded focus:outline-none focus:border-clay-500"
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleSaveEdit(sec.id)}
                                    className="px-2 py-1 bg-clay-600 text-white font-mono text-[9px] font-bold uppercase rounded cursor-pointer"
                                  >{pfUiT("ui.components.perfectfitlayoutcontroller.1e7d9e60f1")}</button>
                                  <button
                                    onClick={() => setEditSectionId(null)}
                                    className="px-2 py-1 bg-sand-200 text-bark-700 font-mono text-[9px] font-bold uppercase rounded cursor-pointer"
                                  >{pfUiT("ui.components.perfectfitlayoutcontroller.6868f41b22")}</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-bark-500 font-sans">
                                {sec.title ? `Title Override: "${sec.title}"` : 'Using original template tags'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 shrink-0 border-t md:border-t-0 pt-2.5 md:pt-0 border-sand-100">
                          {/* Reordering */}
                          <div className="flex items-center bg-sand-100 rounded p-0.5">
                            <button
                              onClick={() => handleMove(idx, 'up')}
                              disabled={idx === 0}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                idx === 0 ? 'text-sand-300 pointer-events-none' : 'text-bark-500 hover:bg-white hover:text-bark-900'
                              }`}
                              title={pfUiT("ui.components.perfectfitlayoutcontroller.f6b446e187")}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMove(idx, 'down')}
                              disabled={idx === appLayout.length - 1}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                idx === appLayout.length - 1 ? 'text-sand-300 pointer-events-none' : 'text-bark-500 hover:bg-white hover:text-bark-900'
                              }`}
                              title={pfUiT("ui.components.perfectfitlayoutcontroller.36d01468e5")}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Explicit Display / Do Not Display Buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => { if (!sec.isEnabled) handleToggle(sec.id); }}
                              className={`px-2.5 py-1.5 rounded-[3px] text-[9.5px] font-mono font-bold uppercase border transition-all cursor-pointer flex items-center gap-1 ${
                                sec.isEnabled
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-3xs font-black'
                                  : 'bg-white text-bark-600 border-sand-250 hover:bg-emerald-50 hover:text-emerald-800'
                              }`}
                              title={pfUiT("ui.components.perfectfitlayoutcontroller.b094c31154")}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{pfUiT("ui.components.perfectfitlayoutcontroller.7222400b76")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { if (sec.isEnabled) handleToggle(sec.id); }}
                              className={`px-2.5 py-1.5 rounded-[3px] text-[9.5px] font-mono font-bold uppercase border transition-all cursor-pointer flex items-center gap-1 ${
                                !sec.isEnabled
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-3xs font-black'
                                  : 'bg-white text-bark-600 border-sand-250 hover:bg-amber-50 hover:text-amber-800'
                              }`}
                              title={pfUiT("ui.components.perfectfitlayoutcontroller.8cc0cea6bd")}
                            >
                              <EyeOff className="w-3 h-3" />
                              <span>{pfUiT("ui.components.perfectfitlayoutcontroller.af6fd3025c")}</span>
                            </button>
                          </div>

                          {/* Quick Edit */}
                          {!isEditing && (
                            <button
                              onClick={() => handleStartEdit(sec)}
                              className="p-1.5 rounded border border-sand-200 text-bark-600 hover:bg-sand-50 hover:text-bark-900 cursor-pointer"
                              title={pfUiT("ui.components.perfectfitlayoutcontroller.bfc01a8c5d")}
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Code viewer & Live telemetry */}
              <div className="lg:col-span-4 space-y-4" id="controller-sidebar">
                <div className="space-y-3 p-4 bg-sand-50/50 border border-sand-200 rounded-[3px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-clay-700 tracking-wider uppercase">{pfUiT("ui.components.perfectfitlayoutcontroller.f02adaaf4e")}</span>
                    <button
                      onClick={() => setShowJson(!showJson)}
                      className="text-[9px] font-mono font-semibold text-bark-450 hover:text-clay-605 transition-colors uppercase cursor-pointer"
                    >
                      {showJson ? 'Hide JSON' : 'Show JSON'}
                    </button>
                  </div>

                  {showJson ? (
                    <div className="space-y-2">
                      <pre className="text-[8px] font-mono text-stone-700 bg-stone-950 text-stone-100 p-3 rounded overflow-x-auto max-h-[300px] leading-tight">
                        {JSON.stringify(appLayout, null, 2)}
                      </pre>
                      <div className="text-[8px] font-mono text-bark-450 text-right">{pfUiT("ui.components.perfectfitlayoutcontroller.73a3e60098")}</div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs text-bark-600 leading-relaxed font-sans">
                      <p>{pfUiT("ui.components.perfectfitlayoutcontroller.3cd15a663f")}<b>{pfUiT("ui.components.perfectfitlayoutcontroller.af0c6ef9c3")}</b>{pfUiT("ui.components.perfectfitlayoutcontroller.9e872d92a1")}</p>
                      <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-bark-550">
                        <li>{pfUiT("ui.components.perfectfitlayoutcontroller.7a4ea609f6")}</li>
                        <li>{pfUiT("ui.components.perfectfitlayoutcontroller.c1d3468e08")}</li>
                        <li>{pfUiT("ui.components.perfectfitlayoutcontroller.ff2b68f33b")}</li>
                        <li>{pfUiT("ui.components.perfectfitlayoutcontroller.fadee856a6")}</li>
                      </ul>
                      <div className="pt-2 border-t border-sand-200 flex items-center gap-1.5 text-[10px] text-clay-700 font-mono font-bold uppercase">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        <span>{pfUiT("ui.components.perfectfitlayoutcontroller.033d985d36")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
