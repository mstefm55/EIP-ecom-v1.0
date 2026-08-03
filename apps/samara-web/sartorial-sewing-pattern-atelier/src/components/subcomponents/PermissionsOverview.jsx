import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Search, Filter,
  Info, Layers, Fingerprint, Sparkles, RefreshCw, Eye, EyeOff,
  HelpCircle, ChevronRight, Check, X, FileJson, Cpu, ShieldAlert as AlertIcon
} from 'lucide-react';
import rolePermissions from '../../rolePermissions.json';
import { ComponentRegistry } from '../ComponentRegistry';

export default function PermissionsOverview() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [activeRules, setActiveRules] = useState({});
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'cards' | 'json'
  const [showOverrideOnly, setShowOverrideOnly] = useState(false);

  // Load live sandbox rules from localStorage
  const loadActiveRules = () => {
    try {
      const saved = localStorage.getItem('sartorial_layout_rules');
      if (saved) {
        setActiveRules(JSON.parse(saved));
      } else {
        // Build fallback rules from JSON structure
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
    loadActiveRules();

    // Listen to local storage changes to keep it in sync live
    const handleStorageChange = () => {
      loadActiveRules();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sartorial_layout_rules_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sartorial_layout_rules_updated', handleStorageChange);
    };
  }, []);

  const roles = rolePermissions.roles;
  const meta = rolePermissions.meta;

  // Filter components based on search and optional override filters
  const filteredComponentKeys = Object.keys(ComponentRegistry).filter(componentKey => {
    const comp = ComponentRegistry[componentKey] || { name: componentKey, description: '' };
    const matchesSearch =
      comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      componentKey.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (showOverrideOnly) {
      // Check if any role's active permission differs from standard permission
      const hasOverride = Object.keys(roles).some(roleId => {
        const isAllowedNow = roleId === 'professional' || (activeRules[componentKey] || []).includes(roleId);
        const standardAllowed = roles[roleId].permissions[componentKey] === 'allowed';
        return isAllowedNow !== standardAllowed && roleId !== 'professional';
      });
      return hasOverride;
    }

    return true;
  });

  // Calculate some analytics summaries
  const totalRolesCount = Object.keys(roles).length;
  const totalComponentsCount = Object.keys(ComponentRegistry).length;

  // Count current live overrides
  const totalLiveOverridesCount = Object.keys(ComponentRegistry).reduce((sum, componentKey) => {
    const componentOverrides = Object.keys(roles).filter(roleId => {
      if (roleId === 'professional') return false; // Professional is always allowed
      const isAllowedNow = (activeRules[componentKey] || []).includes(roleId);
      const standardAllowed = roles[roleId].permissions[componentKey] === 'allowed';
      return isAllowedNow !== standardAllowed;
    });
    return sum + componentOverrides.length;
  }, 0);

  return (
    <div className="bg-[#FAF9F6] border border-sand-200 rounded-2xl p-5 md:p-8 space-y-8 shadow-ux font-sans text-bark-800 animate-fadeIn" id="permissions-overview-container">

      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 pb-5 border-b border-sand-200">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-lg">
              <Shield className="w-4 h-4 animate-pulse" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-clay-700 font-bold">
              Dynamic Security Protocol Engine
            </span>
          </div>
          <h3 className="text-2xl font-serif text-bark-950 font-semibold tracking-tight">
            Atelier Permissions & Access Overview
          </h3>
          <p className="text-xs text-bark-600 leading-relaxed font-sans max-w-2xl">
            Audit high-contrast functional access gates dynamically matched to role credentials.
            Real-time local overrides are highlighted in amber when altered by the control panel.
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center bg-sand-100 p-1 rounded-xl border border-sand-200/60 self-start lg:self-center shrink-0 shadow-4xs">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-white text-bark-900 shadow-3xs'
                : 'text-bark-500 hover:text-bark-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Matrix Table</span>
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'cards'
                ? 'bg-white text-bark-900 shadow-3xs'
                : 'text-bark-500 hover:text-bark-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Role Cards</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-white text-bark-900 shadow-3xs'
                : 'text-bark-500 hover:text-bark-800'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Config JSON</span>
          </button>
        </div>
      </div>

      {/* METRIC BADGE ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="permissions-stats-grid">
        <div className="bg-white border border-sand-200 p-4 rounded-xl flex items-center gap-3 shadow-4xs text-left">
          <div className="p-2.5 bg-sand-50 border border-sand-150 rounded-lg text-bark-600">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-bark-450 uppercase font-semibold">Configured Roles</span>
            <strong className="text-lg text-bark-950 font-serif font-semibold">{totalRolesCount} Tiers</strong>
          </div>
        </div>

        <div className="bg-white border border-sand-200 p-4 rounded-xl flex items-center gap-3 shadow-4xs text-left">
          <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg text-indigo-700">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-bark-450 uppercase font-semibold">Interactive Units</span>
            <strong className="text-lg text-bark-950 font-serif font-semibold">{totalComponentsCount} Blocks</strong>
          </div>
        </div>

        <div className="bg-white border border-sand-200 p-4 rounded-xl flex items-center gap-3 shadow-4xs text-left">
          <div className={`p-2.5 rounded-lg ${totalLiveOverridesCount > 0 ? 'bg-amber-50 border border-amber-200 text-amber-700 animate-pulse' : 'bg-emerald-50 border border-emerald-150 text-emerald-700'}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-bark-450 uppercase font-semibold">Active Overrides</span>
            <strong className="text-lg text-bark-950 font-serif font-semibold">{totalLiveOverridesCount} Live Gates</strong>
          </div>
        </div>

        <div className="bg-white border border-sand-200 p-4 rounded-xl flex items-center gap-3 shadow-4xs text-left col-span-2 md:col-span-1">
          <div className="p-2.5 bg-stone-900 border border-stone-800 rounded-lg text-sand-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="overflow-hidden truncate">
            <span className="block text-[10px] font-mono text-bark-450 uppercase font-semibold truncate">Security Standard</span>
            <strong className="text-xs text-bark-900 font-mono block leading-tight truncate" title={meta.authStandard}>
              ISO-27001 Secure
            </strong>
          </div>
        </div>
      </div>

      {/* SEARCH AND CONTROLS SECTION */}
      {activeTab !== 'json' && (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 border border-sand-200 rounded-xl shadow-4xs">

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-bark-400" />
            <input
              type="text"
              placeholder="Search components or keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-sand-50 border border-sand-200 rounded-lg text-xs font-sans text-bark-850 placeholder:text-bark-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-sand-200 text-bark-450"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter options */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

            {/* Override Filter */}
            <label className="flex items-center gap-2 cursor-pointer bg-sand-50/60 hover:bg-sand-100/50 border border-sand-200/80 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all">
              <input
                type="checkbox"
                checked={showOverrideOnly}
                onChange={(e) => setShowOverrideOnly(e.target.checked)}
                className="rounded border-sand-300 text-indigo-600 focus:ring-indigo-500/30"
              />
              <span className="text-bark-700">Show Overrides Only</span>
              {totalLiveOverridesCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                  {totalLiveOverridesCount}
                </span>
              )}
            </label>

            {/* Quick Helper Info */}
            <div className="text-[10px] text-bark-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              <span>Standard permissions defined in <code className="bg-sand-100 px-1 py-0.2 rounded font-mono">rolePermissions.json</code>.</span>
            </div>

          </div>

        </div>
      )}

      {/* CORE DISPLAY WORKSPACE */}
      <AnimatePresence mode="wait">

        {/* MATRIX TABLE VIEW */}
        {activeTab === 'matrix' && (
          <motion.div
            key="matrix-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="overflow-x-auto border border-sand-200 rounded-xl bg-white shadow-3xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-sand-50 border-b border-sand-200 text-[10px] font-mono uppercase text-bark-500 tracking-wider">
                    <th className="p-4 pl-5 font-bold">Workspace Component Block</th>
                    {Object.keys(roles).map(roleKey => (
                      <th key={roleKey} className="p-4 text-center font-bold">
                        <div className="flex flex-col items-center">
                          <span className="text-bark-900 font-bold">{roles[roleKey].name}</span>
                          <span className="text-[8px] text-bark-400 font-mono font-normal tracking-wider lowercase mt-0.5">({roleKey})</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100 font-sans text-bark-800">
                  {filteredComponentKeys.length > 0 ? (
                    filteredComponentKeys.map(componentKey => {
                      const comp = ComponentRegistry[componentKey] || { name: componentKey, description: 'Component not registered in workspace registry.', icon: HelpCircle };
                      const IconComponent = comp.icon || HelpCircle;

                      return (
                        <tr key={componentKey} className="hover:bg-sand-50/40 transition-colors">

                          {/* Component Details */}
                          <td className="p-4 pl-5 max-w-sm">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-sand-100 border border-sand-200/60 rounded-lg text-bark-600 shrink-0 mt-0.5">
                                <IconComponent className="w-4 h-4 text-bark-700" />
                              </div>
                              <div className="text-left">
                                <span className="font-bold text-[13px] text-bark-900 block font-serif">
                                  {comp.name}
                                </span>
                                <span className="text-[10px] text-bark-450 font-mono uppercase block tracking-tight leading-none mt-0.5">
                                  KEY: {componentKey}
                                </span>
                                <p className="text-[11px] text-bark-550 leading-relaxed font-sans font-light mt-1.5">
                                  {comp.description}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Role Permissions Badges */}
                          {Object.keys(roles).map(roleId => {
                            // Professional is ALWAYS allowed by default, otherwise check live overrides
                            const isAllowedNow = roleId === 'professional' || (activeRules[componentKey] || []).includes(roleId);
                            const standardAllowed = roles[roleId].permissions[componentKey] === 'allowed';
                            const isOverride = isAllowedNow !== standardAllowed && roleId !== 'professional';

                            return (
                              <td key={roleId} className="p-4 text-center">
                                <div className="flex flex-col items-center justify-center gap-1.5">

                                  {/* Current Access Badge */}
                                  {isAllowedNow ? (
                                    <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2.5 py-1 rounded-full font-mono text-[9.5px] font-bold">
                                      <Unlock className="w-3 h-3 text-emerald-600" />
                                      <span>ALLOWED</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 bg-rose-50/50 text-rose-800 border border-rose-200/40 px-2.5 py-1 rounded-full font-mono text-[9.5px] font-bold">
                                      <Lock className="w-3 h-3 text-rose-600" />
                                      <span>GATED</span>
                                    </div>
                                  )}

                                  {/* Override Marker */}
                                  {isOverride ? (
                                    <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.2 rounded font-mono text-[8.5px] font-bold animate-pulse" title="This gate rule has been altered in the live workspace">
                                      <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '4s' }} />
                                      <span>OVERRIDE</span>
                                    </div>
                                  ) : (
                                    <span className="text-[8px] font-mono text-bark-350 select-none">DEFAULT</span>
                                  )}

                                </div>
                              </td>
                            );
                          })}

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={totalRolesCount + 1} className="p-8 text-center text-bark-450 space-y-2">
                        <AlertIcon className="w-8 h-8 text-bark-300 mx-auto" />
                        <strong className="block text-bark-750 font-serif text-sm">No workspace elements match filters</strong>
                        <p className="text-xs max-w-md mx-auto leading-relaxed">
                          Try clearing the search string or disabling the override filter to view cataloged system permissions.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend guide */}
            <div className="p-4 bg-sand-50/70 border border-sand-200/80 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-xs text-bark-600">
              <div className="flex flex-wrap items-center gap-4 text-left">
                <span className="font-bold font-mono text-[10px] uppercase text-bark-500">Legend:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
                  <span>Allowed (Role can execute & interact with component)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span>
                  <span>Gated (Component is blocked/unrendered to protect data)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block animate-pulse"></span>
                  <span>Override (Admin has toggled standard defaults on-the-fly)</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ROLE CARDS VIEW */}
        {activeTab === 'cards' && (
          <motion.div
            key="cards-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {Object.entries(roles).map(([roleId, roleData]) => {

              // Count allowed vs gated modules for this role
              const currentAllowedKeys = Object.keys(ComponentRegistry).filter(componentKey => {
                return roleId === 'professional' || (activeRules[componentKey] || []).includes(roleId);
              });

              const currentGatedKeys = Object.keys(ComponentRegistry).filter(componentKey => {
                return !currentAllowedKeys.includes(componentKey);
              });

              return (
                <div
                  key={roleId}
                  className="bg-white border border-sand-200 rounded-2xl p-5 md:p-6 space-y-4 hover:border-sand-300 transition-all shadow-ux text-left relative overflow-hidden"
                >
                  {/* Subtle top decoration */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    roleId === 'professional' ? 'bg-amber-500' :
                    roleId === 'partner' ? 'bg-indigo-500' :
                    roleId === 'member' ? 'bg-clay-500' :
                    'bg-slate-500'
                  }`} />

                  {/* Role Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-clay-700 font-bold block">
                        CREDENTIAL TIER
                      </span>
                      <h4 className="text-lg font-serif text-bark-950 font-semibold flex items-center gap-2">
                        <span>{roleData.name}</span>
                        <code className="text-[10px] font-mono font-normal bg-sand-100 border border-sand-200 text-bark-600 px-1.5 py-0.2 rounded-md">
                          {roleId}
                        </code>
                      </h4>
                    </div>

                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                      roleId === 'professional' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      roleId === 'partner' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                      roleId === 'member' ? 'bg-clay-50 text-clay-800 border-clay-200' :
                      'bg-slate-50 text-slate-800 border-slate-200'
                    }`}>
                      {roleId === 'professional' ? 'Root Bypass' : `${currentAllowedKeys.length} / ${totalComponentsCount} Allowed`}
                    </span>
                  </div>

                  {/* Role Description */}
                  <p className="text-xs text-bark-600 leading-relaxed font-sans font-light bg-sand-50/50 p-3 rounded-xl border border-sand-200/50">
                    {roleData.description}
                  </p>

                  {/* Allowed Features Checkboxes list */}
                  <div className="space-y-3.5 pt-1">
                    <div>
                      <span className="text-[9px] font-mono uppercase text-emerald-800 font-bold tracking-wider block mb-2">
                        Active Privileges ({currentAllowedKeys.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentAllowedKeys.map(key => {
                          const comp = ComponentRegistry[key] || { name: key };
                          const compName = comp.name.split(' ').slice(1).join(' ') || comp.name;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-150 text-emerald-800 text-[10px] font-medium font-sans px-2.5 py-0.75 rounded-md shadow-3xs"
                            >
                              <Unlock className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{compName}</span>
                            </span>
                          );
                        })}
                        {currentAllowedKeys.length === 0 && (
                          <span className="text-[11px] text-bark-400 italic">No modules allowed for this credential tier.</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase text-rose-800 font-bold tracking-wider block mb-2">
                        Gated Features ({currentGatedKeys.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentGatedKeys.map(key => {
                          const comp = ComponentRegistry[key] || { name: key };
                          const compName = comp.name.split(' ').slice(1).join(' ') || comp.name;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 bg-rose-50/50 border border-rose-150/50 text-rose-800/80 text-[10px] font-sans px-2.5 py-0.75 rounded-md"
                            >
                              <Lock className="w-2.5 h-2.5 text-rose-500/70" />
                              <span className="line-through decoration-rose-250/50">{compName}</span>
                            </span>
                          );
                        })}
                        {currentGatedKeys.length === 0 && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200/50 text-amber-850 text-[10px] font-mono px-2.5 py-0.75 rounded-md">
                            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                            <span>Full Bypass (Standard Root Privileges)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </motion.div>
        )}

        {/* CONFIG JSON CODE VIEW */}
        {activeTab === 'json' && (
          <motion.div
            key="json-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 text-left"
          >
            {/* Context header */}
            <div className="p-4 bg-indigo-50/40 border border-indigo-150/50 rounded-xl flex items-start gap-3">
              <FileJson className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs text-indigo-950 font-serif font-bold block">Security Standard JSON Definition</strong>
                <p className="text-[11px] text-bark-650 leading-relaxed font-sans">
                  The JSON structure is evaluated by the DynamicLayout gate compilation algorithm.
                  Administrators can audit version control headers and hard-coded fallbacks directly in the compiled asset file.
                </p>
              </div>
            </div>

            {/* Code editor pane */}
            <div className="relative border border-stone-800 rounded-xl overflow-hidden bg-stone-950 shadow-lg font-mono text-xs">

              {/* Editor Tab bar */}
              <div className="bg-stone-900 border-b border-stone-850 px-4 py-2 flex items-center justify-between text-stone-400 text-[10px] font-mono uppercase tracking-wider font-semibold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span>
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"></span>
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
                  <span className="ml-2 font-bold text-stone-300">rolePermissions.json</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-stone-850 px-2 py-0.5 rounded border border-stone-800">UTF-8</span>
                  <span className="bg-stone-850 px-2 py-0.5 rounded border border-stone-800">JSON</span>
                </div>
              </div>

              {/* Code print */}
              <pre className="p-4 md:p-6 overflow-x-auto text-stone-150 leading-relaxed max-h-[480px]">
                {JSON.stringify(rolePermissions, null, 2)}
              </pre>

              {/* Info ribbon */}
              <div className="bg-stone-900 border-t border-stone-850 p-2 px-4 flex justify-between items-center text-[10px] text-stone-400">
                <span>Security Ledger: {meta.authStandard}</span>
                <span>Version: {meta.version}</span>
              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* FOOTER AUDIT LOG BLOCK */}
      <div className="pt-4 border-t border-sand-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[10px] font-mono text-bark-450 text-left">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
          <span>Active Policy matched to standard build <strong className="font-bold text-bark-600">{meta.engine}</strong></span>
        </div>
        <div>
          <span>Last policy seed audit signed on: <strong className="font-bold text-bark-600">{meta.lastUpdated}</strong></span>
        </div>
      </div>

    </div>
  );
}
