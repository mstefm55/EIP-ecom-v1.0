import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '../context/RoleContext';
import { ComponentRegistry } from './ComponentRegistry';
import RoleDocumentationModal from './RoleDocumentationModal';
import PermissionsGuideModal from './PermissionsGuideModal';
import AdminControlPanel from './AdminControlPanel';
import { useLayoutAnalytics } from '../hooks/useLayoutAnalytics';
import { DynamicLayoutProvider, useDynamicLayout } from '../context/DynamicLayoutContext';
import rolePermissions from '../rolePermissions.json';
import {
  Lock, Eye, EyeOff, Settings2, ShieldCheck,
  User, ArrowRight, ShieldAlert, KeyRound, CheckSquare,
  Layers, Sliders, ChevronDown, ChevronUp, LockKeyhole, HelpCircle,
  Mail
} from 'lucide-react';

const INITIAL_VISIBILITY_RULES = Object.keys(ComponentRegistry).reduce((acc, key) => {
  const allowedRoles = [];
  Object.entries(rolePermissions.roles).forEach(([roleId, roleData]) => {
    if (roleData.permissions[key] === 'allowed') {
      allowedRoles.push(roleId);
    }
  });
  acc[key] = allowedRoles;
  return acc;
}, {});

// Gated Access Tracker helper to securely log access denials when restricted blocks mount
function AccessDeniedTracker({ componentKey, requiredRoles }) {
  const { trackInteraction } = useLayoutAnalytics();

  useEffect(() => {
    trackInteraction('access_denied', {
      componentKey,
      requiredRoles
    });
  }, [componentKey, requiredRoles, trackInteraction]);

  return null;
}

// Feature Access Tracker helper to securely log successful access to layout blocks
function FeatureAccessTracker({ componentKey, componentName }) {
  const { trackInteraction } = useLayoutAnalytics();

  useEffect(() => {
    trackInteraction('feature_accessed', {
      componentKey,
      componentName
    });
  }, [componentKey, componentName, trackInteraction]);

  return null;
}

export default function DynamicLayout({ appLayout, setAppLayout, onResetLayout }) {
  return (
    <DynamicLayoutProvider>
      <DynamicLayoutInner
        appLayout={appLayout}
        setAppLayout={setAppLayout}
        onResetLayout={onResetLayout}
      />
    </DynamicLayoutProvider>
  );
}

function DynamicLayoutInner({ appLayout, setAppLayout, onResetLayout }) {
  const { role, setRole, availableRoles, simulationActive, resetRoleToActual, actualRole } = useRole();
  const { trackInteraction } = useLayoutAnalytics();

  const {
    rules,
    isAllowed,
    gatedRenderMode,
    setGatedRenderMode,
    handleToggleRule,
    handleResetRules
  } = useDynamicLayout();

  const [showDocModal, setShowDocModal] = useState(false);
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqRole, setReqRole] = useState('member');
  const [reqJustification, setReqJustification] = useState('');

  const handleRequestSubmit = (e) => {
    e.preventDefault();
    const newRequest = {
      id: `req-${Date.now()}`,
      name: reqName,
      email: reqEmail,
      requestedRole: reqRole,
      justification: reqJustification,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    try {
      const existing = localStorage.getItem('sartorial_access_requests');
      const list = existing ? JSON.parse(existing) : [];
      list.push(newRequest);
      localStorage.setItem('sartorial_access_requests', JSON.stringify(list));
      window.dispatchEvent(new Event('sartorial_requests_updated'));
    } catch {}

    trackInteraction('access_request_submitted', { requestedRole: reqRole });

    if (window.showToast) {
      // Toast for user confirmation
      window.showToast(
        "Your access request was successfully submitted and queued.",
        "success",
        "Request Logged"
      );

      // Instant admin notification toast
      setTimeout(() => {
        window.showToast(
          `Admin Notification: New access request from ${reqName} for ${reqRole.toUpperCase()} role.`,
          "info",
          "Security Petition Received"
        );
      }, 1200);
    }

    // Reset fields
    setReqName('');
    setReqEmail('');
    setReqRole('member');
    setReqJustification('');
    setShowRequestModal(false);
  };

  const openGuidelines = () => {
    setShowDocModal(true);
    trackInteraction('guidelines_opened', { role });
  };

  const getRuleDescription = (componentKey) => {
    const allowed = rules[componentKey] || [];
    if (allowed.length === 5) return 'Publicly Available';
    if (allowed.length === 0) return 'Restricted to Everyone';
    return `Restricted to [${allowed.map(r => r.toUpperCase()).join(', ')}]`;
  };

  return (
    <div className="space-y-10" id="role-based-dynamic-layout-section">

      {/* SECTION CONTAINER HEADER */}
      <div className="border-b border-sand-200 pb-5">
        <span className="text-[9px] text-clay-700 font-bold uppercase tracking-[0.25em] block mb-1.5">
          Data-Driven Interface Architecture
        </span>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-serif font-light text-bark-950 tracking-tight">
              Role-Based Dynamic Layout Workspace
            </h2>
            <p className="text-xs text-bark-600 font-sans mt-1 max-w-2xl leading-relaxed">
              Accepts JSON-styled conditional visibility rules to morph the available workspace in real time based on active client credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {role === 'professional' && (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={openGuidelines}
                  className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100/80 text-amber-900 text-[11px] font-mono font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-amber-200 cursor-pointer transition-all shadow-4xs"
                  title="View dynamic layout documentation ledger"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                  <span>Access Guidelines</span>
                </button>
                <button
                  onClick={() => setShowPermissionsGuide(true)}
                  className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100/85 text-indigo-900 text-[11px] font-mono font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-indigo-200 cursor-pointer transition-all shadow-4xs animate-fadeIn"
                  title="View administrative roles and component permissions matrix"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Permissions Guide</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VISITOR UPGRADE PETITION BANNER */}
      {role === 'visitor' && (
        <div className="bg-indigo-50/75 border border-indigo-200 rounded-xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-ux animate-fadeIn" id="visitor-access-request-banner">
          <div className="space-y-1.5 max-w-2xl text-left">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-indigo-100 text-indigo-700 rounded border border-indigo-250 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-indigo-600 animate-pulse" />
              </span>
              <strong className="text-[10px] font-mono uppercase tracking-wider text-indigo-800">
                Authorized Workspace Upgrades
              </strong>
            </div>
            <h3 className="text-base font-serif text-bark-950 font-semibold">
              Drafting custom blueprints or coordinating fabric supplies?
            </h3>
            <p className="text-xs text-bark-650 leading-relaxed font-sans">
              Request authorized credential sets (such as Member, Creative Partner, or Admin) to unlock step-by-step checkers, textile inventory ledgers, and real-time labor productivity clocks.
            </p>
          </div>

          <button
            onClick={() => setShowRequestModal(true)}
            className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-mono font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer shadow-3xs"
          >
            <KeyRound className="w-4 h-4" />
            <span>Request Access</span>
          </button>
        </div>
      )}



      {/* CORE DYNAMIC LAYOUT CONTAINER */}
      <div className="space-y-12" id="dynamic-workspace-canvas">
        <AnimatePresence mode="popLayout">
          {Object.values(ComponentRegistry)
            .map((regItem, index) => {
            const componentKey = regItem.id;
            const SelectedComponent = regItem.component;
            const Icon = regItem.icon;
            const allowed = isAllowed(componentKey);

            // If hide completely mode is active, completely skip rendering this block section
            if (!allowed && gatedRenderMode === 'hide') {
              return (
                <AccessDeniedTracker
                  key={componentKey}
                  componentKey={componentKey}
                  requiredRoles={rules[componentKey] || []}
                />
              );
            }

            return (
              <motion.div
                key={componentKey}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-4"
                id={`canvas-${componentKey}-block`}
              >
                <div className="flex justify-between items-center border-b border-sand-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase text-bark-500">Block {String.fromCharCode(65 + index)}:</span>
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-4 h-4 text-clay-600 shrink-0" />
                      <h3 className="text-sm font-bold text-bark-900 uppercase tracking-wider font-mono">
                        {regItem.name}
                      </h3>
                    </div>
                  </div>

                  {allowed ? (
                    <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Granted
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>

                {allowed ? (
                  <div className="p-1">
                    <FeatureAccessTracker componentKey={componentKey} componentName={regItem.name} />
                    <SelectedComponent />
                  </div>
                ) : (
                  <>
                    <AccessDeniedTracker componentKey={componentKey} requiredRoles={rules[componentKey] || []} />
                    {gatedRenderMode === 'lock-screen' ? (
                      <div className="bg-[#FAF8F5] border border-dashed border-sand-300 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[160px] relative overflow-hidden">
                        <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-600">
                          <LockKeyhole className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 max-w-sm">
                          <h4 className="text-xs font-bold text-bark-900 uppercase tracking-wider">Access Restricted</h4>
                          <p className="text-[11px] text-bark-500 leading-relaxed font-sans">
                            The {regItem.name} block requires <strong>{(rules[componentKey] || []).map(r => r.toUpperCase()).join(', ')}</strong> credentials. Activate a higher role or modify the rules matrix to render this panel.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* CENTRALIZED COMPREHENSIVE ADMINISTRATOR CONTROL PANEL */}
      <div className="mt-12 animate-fadeIn" id="administrator-control-panel-section">
        <div className="border-b border-sand-200 pb-4 mb-6">
          <span className="text-[9px] text-clay-700 font-bold uppercase tracking-[0.25em] block mb-1">
            Super Admin Executive Core
          </span>
          <h2 className="text-3xl font-serif font-light text-bark-950 tracking-tight">
            Comprehensive Administrator Console
          </h2>
          <p className="text-xs text-bark-600 font-sans mt-1 max-w-2xl leading-relaxed">
            Consolidating all professional workspaces, layout block controllers, permissions configuration, and diagnostic telemetry into one unified ergonomic panel.
          </p>
        </div>
        <AdminControlPanel
          appLayout={appLayout}
          setAppLayout={setAppLayout}
          onResetLayout={onResetLayout}
        />
      </div>

      {/* ADMIN-ONLY DOCUMENTATION LEDGER MODAL */}
      <RoleDocumentationModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        currentRole={role}
      />

      {/* ADMIN-ONLY PERMISSIONS GUIDE MATRIX MODAL */}
      <PermissionsGuideModal
        isOpen={showPermissionsGuide}
        onClose={() => setShowPermissionsGuide(false)}
        currentRole={role}
        onResetRules={handleResetRules}
      />

      {/* REQUEST ACCESS MODAL POPUP FORM */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="visitor-access-request-modal">
          <div
            className="fixed inset-0 bg-stone-900/55 backdrop-blur-xs"
            onClick={() => setShowRequestModal(false)}
          />

          <div className="relative bg-white border border-sand-250 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 relative z-10 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-clay-700 font-bold block">
                  Security Privilege Upgrade
                </span>
              </div>
              <h3 className="text-lg font-serif text-bark-950">Apply for Workspace Access</h3>
              <p className="text-xs text-bark-550 font-sans">
                Submit an authorization credential request to the system administrator.
              </p>
            </div>

            <form onSubmit={handleRequestSubmit} className="space-y-4 pt-1 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-bark-600 block">Full Name / Designer Alias</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="e.g. Jean-Luc Atelier"
                    className="w-full pl-9 pr-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-sans"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-bark-600 block">Professional Email</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="e.g. luc@ateliersartorial.com"
                    className="w-full pl-9 pr-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-sans"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-bark-600 block">Target Role Privilege</label>
                <select
                  value={reqRole}
                  onChange={(e) => setReqRole(e.target.value)}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-sans"
                >
                  <option value="member">Atelier Member (Project checklists, personal draft boards)</option>
                  <option value="partner">Creative Partner (Inventory ledger, material expenditures)</option>
                  <option value="professional">Master Professional (Super administrator system bypass)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-bark-600 block">Justification / Project Goals</label>
                <textarea
                  value={reqJustification}
                  onChange={(e) => setReqJustification(e.target.value)}
                  placeholder="Tell the administrator how these tools support your tailoring commissions or textile supply chains..."
                  rows={3}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-sans leading-relaxed"
                  required
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 bg-sand-100 hover:bg-sand-150 text-bark-800 font-mono font-bold uppercase tracking-wider py-2.5 rounded-xl border border-sand-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-stone-900 hover:bg-stone-850 text-white font-mono font-bold uppercase tracking-wider py-2.5 rounded-xl cursor-pointer"
                >
                  Submit Petition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
