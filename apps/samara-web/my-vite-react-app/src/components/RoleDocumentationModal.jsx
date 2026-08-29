import React from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ShieldAlert, KeyRound, Eye, Briefcase, Award,
  UserCheck, ShieldCheck, CheckCircle2, LockKeyhole, Info
} from 'lucide-react';
import { UI_LAYERS } from '../lib/uiLayers';

export default function RoleDocumentationModal({ isOpen, onClose, currentRole }) {
  // Strict admin check: Only users with the 'professional' role can view this documentation
  if (currentRole !== 'professional') {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: UI_LAYERS.modalBackdrop }}
          id="role-documentation-modal-wrapper"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs"
          />

          {/* Modal Card Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            style={{ zIndex: UI_LAYERS.modal }}
            className="relative bg-white border border-sand-250 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col"
            id="role-documentation-modal-card"
          >
            {/* Header banner */}
            <div className="bg-stone-950 p-6 text-sand-50 relative shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-clay-600/25 rounded-lg border border-clay-500/20 text-clay-400">
                  <KeyRound className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-clay-400 font-bold block">{pfUiT("ui.components.roledocumentationmodal.a46adf4ce5")}</span>
                  <h3 className="text-xl font-serif font-light tracking-tight text-white">{pfUiT("ui.components.roledocumentationmodal.723ed11bfe")}</h3>
                </div>
              </div>

              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-2 bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-sand-250 hover:text-white rounded-full transition-all cursor-pointer"
                title={pfUiT("ui.components.roledocumentationmodal.ac114cc11b")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content area */}
            <div className="overflow-y-auto p-6 md:p-8 space-y-6 flex-1 font-sans">

              {/* Context Summary */}
              <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-clay-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-bark-750 leading-relaxed">{pfUiT("ui.components.roledocumentationmodal.f9bb9fe645")}</p>
                </div>
              </div>

              {/* Roles Breakdown Grid */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-clay-700 font-bold">{pfUiT("ui.components.roledocumentationmodal.8f3f04fabf")}</h4>

                <div className="grid grid-cols-1 gap-4">

                  {/* Visitor Card */}
                  <div className="p-4 border border-sand-200 rounded-xl bg-white hover:border-sand-350 transition-colors space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-50 text-slate-650 rounded border border-slate-200/50">
                          <Eye className="w-4 h-4" />
                        </div>
                        <strong className="text-xs font-mono uppercase tracking-wider text-bark-900">
                          Casual Visitor (visitor)
                        </strong>
                      </div>
                      <span className="text-[9px] font-mono bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-150">{pfUiT("ui.components.roledocumentationmodal.b4da5620c2")}</span>
                    </div>
                    <p className="text-xs text-bark-600 leading-relaxed">{pfUiT("ui.components.roledocumentationmodal.4cd1daeec6")}</p>
                    <div className="pt-2 border-t border-sand-100 flex flex-wrap gap-1.5 text-[9px] font-mono">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.7df8909677")}</span>
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-150 font-bold flex items-center gap-1">
                        <LockKeyhole className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.35bad16b83")}</span>
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-150 font-bold flex items-center gap-1">
                        <LockKeyhole className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.ff9810ec74")}</span>
                    </div>
                  </div>

                  {/* Member Card */}
                  <div className="p-4 border border-sand-200 rounded-xl bg-white hover:border-sand-350 transition-colors space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-clay-50 text-clay-650 rounded border border-clay-200/50">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <strong className="text-xs font-mono uppercase tracking-wider text-bark-900">
                          Atelier Member (member)
                        </strong>
                      </div>
                      <span className="text-[9px] font-mono bg-clay-50 text-clay-600 px-2 py-0.5 rounded border border-clay-150">{pfUiT("ui.components.roledocumentationmodal.e4fd53e690")}</span>
                    </div>
                    <p className="text-xs text-bark-600 leading-relaxed">{pfUiT("ui.components.roledocumentationmodal.0db10f2616")}</p>
                    <div className="pt-2 border-t border-sand-100 flex flex-wrap gap-1.5 text-[9px] font-mono">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.a739b73b80")}</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.948063458f")}</span>
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-150 font-bold flex items-center gap-1">
                        <LockKeyhole className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.d0d9818de7")}</span>
                    </div>
                  </div>

                  {/* Partner Card */}
                  <div className="p-4 border border-sand-200 rounded-xl bg-white hover:border-sand-350 transition-colors space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-650 rounded border border-indigo-200/50">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <strong className="text-xs font-mono uppercase tracking-wider text-bark-900">
                          Creative Partner (partner)
                        </strong>
                      </div>
                      <span className="text-[9px] font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-150">{pfUiT("ui.components.roledocumentationmodal.17529e4c07")}</span>
                    </div>
                    <p className="text-xs text-bark-600 leading-relaxed">{pfUiT("ui.components.roledocumentationmodal.454497995b")}</p>
                    <div className="pt-2 border-t border-sand-100 flex flex-wrap gap-1.5 text-[9px] font-mono">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.c472fe9136")}</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.4fcb9e6c9c")}</span>
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-150 font-bold flex items-center gap-1">
                        <LockKeyhole className="w-2.5 h-2.5" />{pfUiT("ui.components.roledocumentationmodal.74764148e9")}</span>
                    </div>
                  </div>

                  {/* Professional Card */}
                  <div className="p-4 border border-amber-200 rounded-xl bg-amber-50/20 hover:border-amber-300 transition-colors space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded border border-amber-200">
                          <Award className="w-4 h-4" />
                        </div>
                        <strong className="text-xs font-mono uppercase tracking-wider text-amber-900">
                          Master Professional (professional)
                        </strong>
                      </div>
                      <span className="text-[9px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-bold">{pfUiT("ui.components.roledocumentationmodal.e75762180f")}</span>
                    </div>
                    <p className="text-xs text-bark-600 leading-relaxed">{pfUiT("ui.components.roledocumentationmodal.897aff7411")}</p>
                    <div className="pt-2 border-t border-amber-100 flex flex-wrap gap-1.5 text-[9px] font-mono">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />{pfUiT("ui.components.roledocumentationmodal.1321373542")}</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />{pfUiT("ui.components.roledocumentationmodal.33dc3913ec")}</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-150 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />{pfUiT("ui.components.roledocumentationmodal.9059aceaf6")}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Security Advisory */}
              <div className="p-4 bg-rose-50/40 border border-rose-150 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{pfUiT("ui.components.roledocumentationmodal.c8e208199e")}</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed font-sans">{pfUiT("ui.components.roledocumentationmodal.f292ab838e")}</p>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-sand-50 p-4 border-t border-sand-200 flex justify-end shrink-0">
              <button
                onClick={onClose}
                className="bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold px-5 py-2.5 rounded-lg cursor-pointer transition-all shadow-3xs"
              >{pfUiT("ui.components.roledocumentationmodal.6cb895f307")}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
