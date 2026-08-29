import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import { localizeMetadataTree } from '../../lib/localizedMetadata';
import React, { useState, useEffect, useMemo } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { useLayoutAnalytics } from '../../hooks/useLayoutAnalytics';
import {
  BarChart3, Activity, ShieldAlert, Key, Settings, RefreshCw,
  Trash2, Search, Filter, Calendar, Users, Eye, ArrowRight,
  Sparkles, CheckCircle2, ChevronRight, HelpCircle, HardDrive
} from 'lucide-react';

export default function WorkspaceAnalyticsPanel() {
  const analyticsUi = localizeMetadataTree(perfectFitMetadata.componentUi.workspaceAnalytics, 'component.workspaceAnalytics', pfUiT);
  const { logs, clearAnalytics, refreshLogs } = useLayoutAnalytics();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  // Trigger immediate refresh on mount and listen to storage updates
  useEffect(() => {
    refreshLogs();
    const handleUpdate = () => refreshLogs();
    window.addEventListener('layout_analytics_updated', handleUpdate);
    return () => window.removeEventListener('layout_analytics_updated', handleUpdate);
  }, [refreshLogs]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = logs.length;

    // Actions frequency count
    const actionsMap = {};
    // Roles frequency count
    const rolesMap = {};
    let accessDeniedCount = 0;
    let ruleToggledCount = 0;

    logs.forEach(log => {
      // Action mapping
      actionsMap[log.actionType] = (actionsMap[log.actionType] || 0) + 1;

      // Role mapping
      rolesMap[log.role] = (rolesMap[log.role] || 0) + 1;

      if (log.actionType === 'access_denied') {
        accessDeniedCount++;
      }
      if (log.actionType === 'rule_toggled') {
        ruleToggledCount++;
      }
    });

    // Find most active simulated role
    let activeRole = 'N/A';
    let maxRoleCount = 0;
    Object.entries(rolesMap).forEach(([roleName, count]) => {
      if (count > maxRoleCount) {
        maxRoleCount = count;
        activeRole = roleName;
      }
    });

    return {
      total,
      activeRole,
      accessDeniedCount,
      ruleToggledCount,
      actionsMap,
      rolesMap
    };
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search matches actionType, role, details values
      const detailsStr = JSON.stringify(log.details || '').toLowerCase();
      const actionMatches = log.actionType.toLowerCase().includes(searchTerm.toLowerCase());
      const roleMatches = log.role.toLowerCase().includes(searchTerm.toLowerCase());
      const detailsMatches = detailsStr.includes(searchTerm.toLowerCase());

      const searchMatch = !searchTerm || actionMatches || roleMatches || detailsMatches;
      const actionFilterMatch = actionFilter === 'all' || log.actionType === actionFilter;
      const roleFilterMatch = roleFilter === 'all' || log.role === roleFilter;

      return searchMatch && actionFilterMatch && roleFilterMatch;
    });
  }, [logs, searchTerm, actionFilter, roleFilter]);

  // Unique list of action types and roles for filter dropdowns
  const uniqueActionTypes = useMemo(() => {
    const set = new Set(logs.map(l => l.actionType));
    return Array.from(set);
  }, [logs]);

  const uniqueRoles = useMemo(() => {
    const set = new Set(logs.map(l => l.role));
    return Array.from(set);
  }, [logs]);

  // Render friendly action labels and icon badges
  const getActionBadge = (type) => {
    switch (type) {
      case 'role_switched':
        return {
          label: analyticsUi.actionTypes.role_switched.label,
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
          icon: <Users className="w-3.5 h-3.5" />
        };
      case 'rule_toggled':
        return {
          label: analyticsUi.actionTypes.rule_altered.label,
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          icon: <Key className="w-3.5 h-3.5" />
        };
      case 'access_denied':
        return {
          label: analyticsUi.actionTypes.access_denied.label,
          bg: 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse',
          icon: <ShieldAlert className="w-3.5 h-3.5" />
        };
      case 'feature_accessed':
        return {
          label: analyticsUi.actionTypes.feature_accessed.label,
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          icon: <Eye className="w-3.5 h-3.5 text-emerald-700" />
        };
      case 'config_toggled':
        return {
          label: analyticsUi.actionTypes.config_pane_toggled.label,
          bg: 'bg-stone-100 border-stone-200 text-stone-700',
          icon: <Settings className="w-3.5 h-3.5" />
        };
      case 'guidelines_opened':
        return {
          label: analyticsUi.actionTypes.guidelines_viewed.label,
          bg: 'bg-clay-50 border-clay-200 text-clay-700',
          icon: <HelpCircle className="w-3.5 h-3.5" />
        };
      default:
        return {
          label: type.replace(/_/g, ' ').toUpperCase(),
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
          icon: <Activity className="w-3.5 h-3.5" />
        };
    }
  };

  const getRoleLabel = (roleId) => {
    switch (roleId) {
      case 'visitor': return 'Casual Visitor';
      case 'member': return 'Atelier Member';
      case 'partner': return 'Creative Partner';
      case 'professional': return 'Master Professional';
      default: return roleId;
    }
  };

  return (
    <div className="space-y-6" id="workspace-analytics-dashboard">

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-sand-200 shadow-ux">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-stone-100 text-stone-700 rounded-lg border border-stone-200">
              <BarChart3 className="w-4 h-4 text-clay-600" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-clay-700 font-bold">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.00a69f7a82")}</span>
          </div>
          <h3 className="text-lg font-serif text-bark-950 font-light">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.cc8b26b5d9")}</h3>
          <p className="text-xs text-bark-550 max-w-lg">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.075d317898")}</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={refreshLogs}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-white hover:bg-sand-50/50 text-bark-800 text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg border border-sand-250 transition-all cursor-pointer shadow-4xs"
            title={pfUiT("ui.components.subcomponents.workspaceanalyticspanel.d8b25aa892")}
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
            <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.a6ad4064a0")}</span>
          </button>

          <button
            onClick={clearAnalytics}
            disabled={logs.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg border border-rose-200 transition-all cursor-pointer shadow-4xs"
            title={pfUiT("ui.components.subcomponents.workspaceanalyticspanel.5a4ca0785c")}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.3804e3796a")}</span>
          </button>
        </div>
      </div>

      {/* METRIC PILLS & STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* Metric 1: Total Captured */}
        <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-4xs space-y-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.7263f4f499")}</span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-2xl font-serif text-bark-900">{metrics.total}</strong>
            <span className="text-[10px] font-mono text-bark-500">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.9ed0ff1229")}</span>
          </div>
          <div className="h-1 w-full bg-sand-100 rounded-full overflow-hidden">
            <div className="h-full bg-clay-505 rounded-full" style={{ width: `${Math.min(100, (metrics.total / 100) * 100)}%` }} />
          </div>
        </div>

        {/* Metric 2: Access Denied Hits */}
        <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-4xs space-y-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.87c542f644")}</span>
          <div className="flex items-baseline gap-1.5">
            <strong className={`text-2xl font-serif ${metrics.accessDeniedCount > 0 ? 'text-rose-700 animate-pulse' : 'text-bark-900'}`}>
              {metrics.accessDeniedCount}
            </strong>
            <span className="text-[10px] font-mono text-bark-500">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.ac242b69c9")}</span>
          </div>
          <div className="h-1 w-full bg-sand-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all"
              style={{ width: `${metrics.total > 0 ? (metrics.accessDeniedCount / metrics.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Top Simulated Persona */}
        <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-4xs space-y-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.1b956dfe62")}</span>
          <div className="flex items-baseline gap-1">
            <strong className="text-sm font-serif font-semibold text-bark-900 block truncate max-w-full">
              {getRoleLabel(metrics.activeRole)}
            </strong>
          </div>
          <span className="text-[9px] font-mono text-clay-650 uppercase block font-bold">
            {metrics.rolesMap[metrics.activeRole] || 0} Actions logged
          </span>
        </div>

        {/* Metric 4: Rule Adjustments */}
        <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-4xs space-y-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.fda5663ef8")}</span>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-2xl font-serif text-bark-900">{metrics.ruleToggledCount}</strong>
            <span className="text-[10px] font-mono text-bark-500">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.f71f98dab8")}</span>
          </div>
          <div className="h-1 w-full bg-sand-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${metrics.total > 0 ? (metrics.ruleToggledCount / metrics.total) * 100 : 0}%` }}
            />
          </div>
        </div>

      </div>

      {/* CHARTS & LIVE LEDGER ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (col-span-4): Usage Frequency Breakdowns */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-ux">
            <div className="border-b border-sand-150 pb-2">
              <h4 className="text-xs font-serif font-bold text-bark-900 uppercase tracking-wider">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.72b335db0b")}</h4>
              <p className="text-[10px] text-bark-450 font-sans">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.0cd090195f")}</p>
            </div>

            <div className="space-y-3 pt-1">
              {['visitor', 'member', 'partner', 'professional'].map(roleId => {
                const count = metrics.rolesMap[roleId] || 0;
                const percentage = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;

                // Color mapping
                const colorClass =
                  roleId === 'professional' ? 'bg-amber-500' :
                  roleId === 'partner' ? 'bg-indigo-500' :
                  roleId === 'member' ? 'bg-clay-605' : 'bg-slate-500';

                return (
                  <div key={roleId} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="font-mono text-bark-800 font-semibold">{getRoleLabel(roleId)}</span>
                      <span className="font-mono text-bark-500 font-bold">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-sand-100 rounded-full overflow-hidden relative">
                      <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-ux">
            <div className="border-b border-sand-150 pb-2">
              <h4 className="text-xs font-serif font-bold text-bark-900 uppercase tracking-wider">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.de147e0a8e")}</h4>
              <p className="text-[10px] text-bark-450 font-sans font-medium">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.612c4ce723")}</p>
            </div>

            <div className="space-y-3.5 max-h-[180px] overflow-y-auto pr-1">
              {Object.entries(metrics.actionsMap).map(([actionName, count]) => {
                const percentage = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                return (
                  <div key={actionName} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-bark-700 font-bold uppercase truncate max-w-[70%]">{actionName.replace(/_/g, ' ')}</span>
                      <span className="text-clay-700 font-bold">{count} hits</span>
                    </div>
                    <div className="w-full h-1.5 bg-sand-100 rounded-full overflow-hidden">
                      <div className="h-full bg-clay-505 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}

              {Object.keys(metrics.actionsMap).length === 0 && (
                <div className="text-center p-4 text-[10.5px] font-sans text-bark-400">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.3653f01924")}</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (col-span-8): Audit Ledger Table & Filters */}
        <div className="lg:col-span-8 bg-white border border-sand-200 rounded-xl shadow-ux overflow-hidden flex flex-col">

          {/* SEARCH & FILTERS CONTROLS */}
          <div className="p-4 border-b border-sand-150 bg-sand-50/30 flex flex-col md:flex-row gap-3 justify-between items-center">

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-bark-450 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={pfUiT("ui.components.subcomponents.workspaceanalyticspanel.3c78a50193")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs font-sans placeholder-bark-400 focus:ring-1 focus:ring-clay-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <div className="flex items-center gap-1 bg-white border border-sand-250 px-2 py-1 rounded-lg text-xs">
                <Filter className="w-3 h-3 text-bark-400" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="bg-transparent border-0 py-0 pl-1 pr-6 text-[10.5px] font-mono uppercase font-bold focus:ring-0 text-bark-750"
                >
                  <option value="all">ALL ACTIONS</option>
                  {uniqueActionTypes.map(act => (
                    <option key={act} value={act}>{act.replace(/_/g, ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-white border border-sand-250 px-2 py-1 rounded-lg text-xs">
                <Users className="w-3 h-3 text-bark-400" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-transparent border-0 py-0 pl-1 pr-6 text-[10.5px] font-mono uppercase font-bold focus:ring-0 text-bark-750"
                >
                  <option value="all">ALL PERSONAS</option>
                  {uniqueRoles.map(rl => (
                    <option key={rl} value={rl}>{rl.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* EVENTS STREAM LEDGER */}
          <div className="divide-y divide-sand-100 max-h-[360px] overflow-y-auto flex-1">
            <AnimatePresence initial={false}>
              {filteredLogs.map((log) => {
                const badgeInfo = getActionBadge(log.actionType);
                const readableTime = new Date(log.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="p-3.5 hover:bg-[#FAF8F5]/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-all"
                  >
                    <div className="space-y-1 max-w-[75%]">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Timestamp */}
                        <span className="text-[10px] font-mono text-bark-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {readableTime}
                        </span>

                        {/* Action Badge */}
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1.5 ${badgeInfo.bg}`}>
                          {badgeInfo.icon}
                          {badgeInfo.label}
                        </span>

                        {/* Role Context */}
                        <span className="text-[9.5px] font-mono text-bark-600">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.8e4e3b0758")}<strong>{getRoleLabel(log.role)}</strong>
                        </span>
                      </div>

                      {/* Details / Payload description */}
                      <p className="text-[10.5px] text-bark-700 font-mono bg-sand-50/60 border border-sand-150 px-2 py-1 rounded">
                        {log.actionType === 'role_switched' && (
                          <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.aa833a6d6d")}<strong className="text-indigo-800">{log.details.nextRole}</strong></span>
                        )}
                        {log.actionType === 'rule_toggled' && (
                          <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.c2da1ae4b1")}<strong className="text-amber-800">"{log.details.componentKey}"</strong>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.9268810272")}<strong className="text-amber-800">"{log.details.roleId}"</strong></span>
                        )}
                        {log.actionType === 'access_denied' && (
                          <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.b846ea40b2")}<strong className="text-rose-700">"{log.details.componentKey}"</strong>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.432113412f")}<strong className="text-rose-700">[{log.details.requiredRoles?.join(', ')}]</strong></span>
                        )}
                        {log.actionType === 'feature_accessed' && (
                          <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.f613ec52fc")}<strong className="text-emerald-800">"{log.details.componentName}"</strong> (<span className="font-mono text-[9.5px] text-emerald-700">{log.details.componentKey}</span>)</span>
                        )}
                        {log.actionType === 'config_toggled' && (
                          <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.fe3d5d89dd")}<strong className="text-stone-700">{log.details.show ? 'Open' : 'Collapsed'}</strong></span>
                        )}
                        {log.actionType === 'guidelines_opened' && (
                          <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.73a711bed7")}</span>
                        )}
                        {!['role_switched', 'rule_toggled', 'access_denied', 'feature_accessed', 'config_toggled', 'guidelines_opened'].includes(log.actionType) && (
                          <span>{JSON.stringify(log.details)}</span>
                        )}
                      </p>
                    </div>

                    {/* Right side Metadata indicators */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center text-right shrink-0">
                      <span className="text-[9px] font-mono text-bark-450 uppercase block">
                        Actual user: {getRoleLabel(log.actualRole)}
                      </span>
                      <span className="text-[8.5px] font-mono text-clay-500 italic">
                        {log.id.substr(0, 14)}
                      </span>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredLogs.length === 0 && (
              <div className="text-center p-12 text-bark-500 font-sans text-xs space-y-2">
                <HardDrive className="w-8 h-8 text-bark-300 mx-auto" />
                <p>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.2d40bd10ff")}</p>
              </div>
            )}
          </div>

          {/* FOOTER AUDITING STANDARDS STATEMENT */}
          <div className="p-3 bg-sand-50/10 border-t border-sand-150 text-[9.5px] text-bark-500 font-mono flex items-center justify-between">
            <span>{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.3cf93ad41b")}</span>
            <span className="text-emerald-700 font-bold">{pfUiT("ui.components.subcomponents.workspaceanalyticspanel.df19862a85")}</span>
          </div>

        </div>

      </div>

    </div>
  );
}
