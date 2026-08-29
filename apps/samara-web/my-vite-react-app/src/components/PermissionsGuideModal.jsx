import { clientPreferences } from '../lib/clientPreferences';
import React, { useState, useEffect } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ShieldCheck, ShieldAlert, KeyRound, Eye, EyeOff, Info,
  Settings2, RefreshCw, Layers, Check, AlertTriangle, Fingerprint,
  Compass, TrendingUp, Briefcase, BarChart3, HelpCircle
} from 'lucide-react';
import rolePermissions from '../rolePermissions.js';
import { ComponentRegistry } from './ComponentRegistry';
import { UI_LAYERS } from '../lib/uiLayers';

export default function PermissionsGuideModal({ isOpen, onClose, currentRole, onResetRules }) {
  // Strict security boundary: Only Master Professional (administrator) can render this guide
  if (currentRole !== 'professional') {
    return null;
  }

  const [activeComponentId, setActiveComponentId] = useState('gallery');
  const [activeRules, setActiveRules] = useState({});

  // Sync state with local storage to reflect sandbox rule changes
  const loadActiveRules = () => {
    try {
      const saved = clientPreferences.getItem('sartorial_layout_rules');
      if (saved) {
        setActiveRules(JSON.parse(saved));
      } else {
        // Fallback to generating initial allowed roles from permissions file
        const fallback = {};
        Object.keys(ComponentRegistry).forEach(key => {
          const allowedRoles = [];
          Object.entries(rolePermissions.roles).forEach(([roleId, roleData]) => {
            if (roleData.permissions[key] === 'allowed') {
              allowedRoles.push(roleId);
            }
          });
          fallback[key] = allowedRoles;
        });
        setActiveRules(fallback);
      }
    } catch {
      setActiveRules({});
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadActiveRules();
    }
  }, [isOpen]);

  // Sync when local storage triggers updates
  useEffect(() => {
    const handleStorageChange = () => {
      loadActiveRules();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleReset = () => {
    if (onResetRules) {
      onResetRules();
      // Reload rules after resetting
      setTimeout(() => {
        loadActiveRules();
        if (window.showToast) {
          window.showToast(
            'Successfully reverted layout gates to standard ISO security defaults.',
            'success',
            'Policy Reseeded'
          );
        }
      }, 50);
    }
  };

  const getComponentMetadata = (id) => {
    return ComponentRegistry[id] || { name: id, description: '', icon: HelpCircle };
  };

  const selectedComp = getComponentMetadata(activeComponentId);
  const IconComp = selectedComp.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden"
          style={{ zIndex: UI_LAYERS.modalBackdrop }}
          id="permissions-guide-modal-wrapper"
        >
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-950/65 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: 'spring', duration: 0.45 }}
            style={{ zIndex: UI_LAYERS.modal }}
            className="relative bg-white border border-sand-250 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden relative z-10"
            id="permissions-guide-modal-card"
          >
            {/* Header with Dark Technical Theme */}
            <div className="bg-stone-950 p-5 md:p-6 text-sand-50 shrink-0 relative flex justify-between items-center border-b border-stone-850">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <Fingerprint className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-clay-400 font-bold">{pfUiT("ui.components.permissionsguidemodal.ef81114355")}</span>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.2 rounded font-mono uppercase font-bold">{pfUiT("ui.components.permissionsguidemodal.c791b39439")}</span>
                  </div>
                  <h3 className="text-xl font-serif text-white tracking-tight">{pfUiT("ui.components.permissionsguidemodal.226c853447")}</h3>
                </div>
              </div>

              <div className="flex items-center gap-3 pr-10">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-850 text-sand-300 hover:text-white text-[10px] font-mono px-3 py-1.5 rounded-lg border border-stone-800 hover:border-stone-750 transition-all cursor-pointer shadow-3xs"
                  title={pfUiT("ui.components.permissionsguidemodal.618da847ef")}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{pfUiT("ui.components.permissionsguidemodal.d5d1a85dcf")}</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-1.5 bg-stone-900 hover:bg-stone-850 border border-stone-800 hover:border-stone-750 text-sand-250 hover:text-white rounded-full transition-all cursor-pointer"
                title={pfUiT("ui.components.permissionsguidemodal.8394f36f39")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-sand-50/20">

              {/* LEFT SIDE: Core Matrix Grid Table */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 border-r border-sand-150">

                {/* Security Standard Metadata Header */}
                <div className="p-4 bg-indigo-50/50 border border-indigo-150/70 rounded-xl space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <strong className="text-xs text-indigo-950 font-serif font-bold block">{pfUiT("ui.components.permissionsguidemodal.efdc37062b")}</strong>
                      <p className="text-[11px] text-bark-650 leading-relaxed font-sans">{pfUiT("ui.components.permissionsguidemodal.5278cf8f8f")}<strong className="font-mono text-[10px] bg-indigo-50 border border-indigo-100 px-1 rounded mx-0.5">{rolePermissions.meta.authStandard}</strong>{pfUiT("ui.components.permissionsguidemodal.cdf175ce32")}</p>
                    </div>
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="space-y-3">
                  <h4 className="text-[9.5px] font-mono uppercase tracking-widest text-clay-700 font-bold block">{pfUiT("ui.components.permissionsguidemodal.4601b2ea68")}</h4>

                  <div className="overflow-x-auto border border-sand-200 rounded-xl bg-white shadow-3xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-sand-50/85 border-b border-sand-200 text-[10px] font-mono uppercase text-bark-500 tracking-wider">
                          <th className="p-3.5 pl-4 font-bold">{pfUiT("ui.components.permissionsguidemodal.0d8f99881f")}</th>
                          {Object.keys(rolePermissions.roles).map(roleKey => (
                            <th key={roleKey} className="p-3.5 text-center font-bold">
                              {roleKey}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-100 font-sans text-bark-800">
                        {Object.keys(ComponentRegistry).map(componentKey => {
                          const comp = ComponentRegistry[componentKey];
                          const isActiveRow = activeComponentId === componentKey;

                          return (
                            <tr
                              key={componentKey}
                              onClick={() => setActiveComponentId(componentKey)}
                              className={`cursor-pointer transition-all ${
                                isActiveRow
                                  ? 'bg-indigo-50/40 text-indigo-950 font-medium border-l-2 border-l-indigo-600'
                                  : 'hover:bg-sand-50/60'
                              }`}
                            >
                              <td className="p-3.5 pl-4 flex items-center gap-2">
                                <span className={`p-1 rounded ${isActiveRow ? 'bg-indigo-100 text-indigo-800' : 'bg-sand-100 text-bark-550'}`}>
                                  {React.createElement(comp.icon || HelpCircle, { className: 'w-3.5 h-3.5' })}
                                </span>
                                <div>
                                  <span className="font-bold block text-[11px] text-bark-900">{comp.name.split(' ').slice(1).join(' ') || comp.name}</span>
                                  <span className="text-[9.5px] text-bark-450 font-mono tracking-tight uppercase block leading-none mt-0.5">{componentKey}</span>
                                </div>
                              </td>

                              {Object.keys(rolePermissions.roles).map(roleId => {
                                // Master Professional ALWAYS has access
                                const isAllowed = roleId === 'professional' || (activeRules[componentKey] || []).includes(roleId);
                                const standardAllowed = rolePermissions.roles[roleId].permissions[componentKey] === 'allowed';
                                const isOverride = isAllowed !== standardAllowed && roleId !== 'professional';

                                return (
                                  <td key={roleId} className="p-3.5 text-center">
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      {isAllowed ? (
                                        <div className="flex items-center gap-1 text-emerald-700 font-bold font-mono text-[10px]">
                                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                          <span className="sr-only">{pfUiT("ui.components.permissionsguidemodal.2302089d18")}</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 text-rose-700 font-bold font-mono text-[10px]">
                                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                                          <span className="sr-only">{pfUiT("ui.components.permissionsguidemodal.af1ff6cfbd")}</span>
                                        </div>
                                      )}

                                      {isOverride && (
                                        <span
                                          className="text-[7.5px] font-mono bg-amber-50 text-amber-700 border border-amber-250/70 px-1 py-0.1 rounded uppercase font-bold animate-pulse"
                                          title={pfUiT("ui.components.permissionsguidemodal.76520f199f")}
                                        >{pfUiT("ui.components.permissionsguidemodal.141dfc3377")}</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ISO Meta & Auth Certification Sign-off block */}
                <div className="grid grid-cols-2 gap-4 text-[10px] font-mono text-bark-450 pt-2">
                  <div className="bg-white border border-sand-150 p-2.5 rounded-lg flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="block uppercase font-bold text-[8.5px] text-bark-500">{pfUiT("ui.components.permissionsguidemodal.59c721e05b")}</span>
                      <strong className="text-bark-800 font-bold">{rolePermissions.meta.version}</strong>
                    </div>
                  </div>
                  <div className="bg-white border border-sand-150 p-2.5 rounded-lg flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="block uppercase font-bold text-[8.5px] text-bark-500">{pfUiT("ui.components.permissionsguidemodal.a00da0b5c9")}</span>
                      <strong className="text-bark-800 font-bold">{rolePermissions.meta.engine}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT SIDE: SELECTED COMPONENT OPERATIONAL INSPECTOR */}
              <div className="w-full md:w-80 bg-stone-900 text-stone-200 p-5 md:p-6 space-y-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-5">
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-clay-400 font-bold block">{pfUiT("ui.components.permissionsguidemodal.93104c7449")}</span>
                    <h4 className="text-base font-serif text-white font-medium flex items-center gap-2">
                      <span className="p-1 bg-stone-800 text-clay-400 rounded-lg border border-stone-750">
                        {IconComp && <IconComp className="w-4 h-4 text-clay-400" />}
                      </span>
                      <span>{pfUiT("ui.components.permissionsguidemodal.8adbfca5c5")}</span>
                    </h4>
                  </div>

                  {/* Component Info Card */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-mono uppercase text-white tracking-wider font-bold">
                      {selectedComp.name}
                    </h5>
                    <p className="text-xs text-stone-350 leading-relaxed font-sans font-light">
                      {selectedComp.description}
                    </p>
                  </div>

                  <hr className="border-stone-800" />

                  {/* Role Access Declarations & Rationale Checklist */}
                  <div className="space-y-3 text-xs">
                    <h5 className="text-[9px] font-mono uppercase text-clay-400 tracking-wider font-bold">{pfUiT("ui.components.permissionsguidemodal.88a3b43c3b")}</h5>

                    <div className="space-y-3.5">
                      {Object.entries(rolePermissions.roles).map(([roleId, roleData]) => {
                        const isAllowed = roleId === 'professional' || (activeRules[activeComponentId] || []).includes(roleId);

                        return (
                          <div key={roleId} className="space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <strong className="font-mono text-stone-300 capitalize">{roleId}</strong>
                              <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded ${
                                isAllowed ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' : 'bg-rose-950/40 text-rose-400 border border-rose-900/40'
                              }`}>
                                {isAllowed ? 'Allowed' : 'Gated'}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-stone-400 leading-relaxed font-sans font-light">
                              {roleId === 'visitor' && isAllowed && "Anonymous spectators can view public media and dynamic mock galleries."}
                              {roleId === 'visitor' && !isAllowed && "Unverified guest bypass blocked to protect premium client media databases."}

                              {roleId === 'member' && isAllowed && "Tailoring club members can create design portfolios and measure avatars."}
                              {roleId === 'member' && !isAllowed && "Member sandbox blocked. Upgrade system context to authenticate blueprints."}

                              {roleId === 'partner' && isAllowed && "Creative partners can update material rolls and log active assembly work."}
                              {roleId === 'partner' && !isAllowed && "Supply chain ledger visibility restricted. Re-verify partner certificate keys."}

                              {roleId === 'professional' && "Master administrator holds bypass keys, logs telemetry, and edits rules live."}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-800 text-[10px] text-stone-400 leading-relaxed font-sans space-y-1.5 mt-4">
                  <div className="flex items-center gap-1 text-clay-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-clay-500 shrink-0" />
                    <span className="font-mono font-bold uppercase text-[8.5px]">{pfUiT("ui.components.permissionsguidemodal.9c1647ef04")}</span>
                  </div>
                  <p className="font-light">{pfUiT("ui.components.permissionsguidemodal.7516a39750")}</p>
                </div>
              </div>

            </div>

            {/* Footer with Actions */}
            <div className="bg-sand-50 p-4 border-t border-sand-200 shrink-0 flex justify-end gap-3" id="permissions-guide-modal-footer">
              <button
                onClick={onClose}
                className="bg-stone-900 hover:bg-stone-850 text-white text-xs font-mono font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer shadow-3xs transition-all"
              >{pfUiT("ui.components.permissionsguidemodal.79c68accd7")}</button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
