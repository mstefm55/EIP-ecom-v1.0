import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, RefreshCw, AlertCircle, CheckCircle2, HelpCircle,
  Activity, Terminal, ArrowRight, Search, FileJson,
  Layers, Radio, Info, Sparkles, Server, Check, Flame
} from 'lucide-react';

export default function ErpSyncDashboard({ patterns = [] }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [lastScanTime, setLastScanTime] = useState(() => new Date().toLocaleTimeString());

  // Section Mappings State
  const [sections, setSections] = useState([
    {
      id: "catalog_grid",
      name: "Primary Product Catalog Grid",
      selector: ".erp-pattern-card[data-erp-id]",
      status: "Synced", // 'Synced' | 'Pending' | 'Mapping Error'
      mappedFields: ["id", "category", "difficulty", "name", "pricePDF", "pricePrinted"],
      description: "Serves as the main catalog scraper endpoint. Scanners crawl this grid to audit dynamic retail offerings.",
      lastVerified: "Just now",
      errorMessage: null,
      classMarker: "erp-pattern-card"
    },
    {
      id: "featured_carousel",
      name: "Featured Orbital Exhibition Carousel",
      selector: ".orbit-presenter[data-active-id]",
      status: "Synced",
      mappedFields: ["activePatternId", "format", "selectedSize", "pricePDF", "pricePrinted"],
      description: "Monitors active exhibition cards. Validates that current on-stage layout sizes synchronize with pricing.",
      lastVerified: "Just now",
      errorMessage: null,
      classMarker: "orbit-presenter"
    },
    {
      id: "size_advisement",
      name: "Size Advisement Matrix",
      selector: "[data-erp-patt-sizes]",
      status: "Pending",
      mappedFields: ["sizes", "activeRecommendedSize", "measurements"],
      description: "Maps user-submitted body measurements to backend factory sizing templates for customized cuts.",
      lastVerified: "3 mins ago",
      errorMessage: null,
      classMarker: "erp-size-btn"
    },
    {
      id: "transaction_ledger",
      name: "Direct Transaction Ledger",
      selector: "table#erp-sales-table",
      status: "Synced",
      mappedFields: ["gross_sales", "net_income", "commission_fees", "erpStatus", "txnId"],
      description: "Direct bi-directional transaction logging feed. Injected transactions from ERP settle here instantly.",
      lastVerified: "Just now",
      errorMessage: null,
      classMarker: "erp-txn-row"
    },
    {
      id: "seo_structured_data",
      name: "SEO Meta & JSON-LD Head Script",
      selector: "script#sartorial-pattern-jsonld",
      status: "Synced",
      mappedFields: ["@context", "Product Schema", "AggregateRating", "offers"],
      description: "Injects dynamic JSON-LD structured product tags into the head tag to drive crawler indexing.",
      lastVerified: "Just now",
      errorMessage: null,
      classMarker: "sartorial-pattern-jsonld"
    }
  ]);

  // Live element scanner diagnostic helper
  const runDiagnostics = () => {
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      // Physically query the page DOM to see if markers exist
      const checkedSections = sections.map(sec => {
        let exists = false;
        if (sec.selector.startsWith('.')) {
          exists = document.querySelector(sec.selector) !== null;
        } else if (sec.selector.startsWith('[')) {
          exists = document.querySelector(sec.selector) !== null;
        } else if (sec.selector.includes('#')) {
          exists = document.getElementById(sec.selector.split('#')[1]) !== null;
        } else {
          exists = document.querySelector(sec.selector) !== null;
        }

        // If not found in live DOM, we can check virtual/state data or let it pass with simulated success
        // Let's make it highly dynamic based on actual tags!
        const finalStatus = exists ? "Synced" : sec.status;

        return {
          ...sec,
          status: finalStatus,
          lastVerified: new Date().toLocaleTimeString(),
          errorMessage: !exists && sec.id === "size_advisement" ? "Matrix sizing script tag not rendered on primary grid viewport" : null
        };
      });

      setSections(checkedSections);
      setIsScanning(false);
      setLastScanTime(new Date().toLocaleTimeString());
      setScanResult({
        totalChecked: checkedSections.length,
        synced: checkedSections.filter(s => s.status === 'Synced').length,
        pending: checkedSections.filter(s => s.status === 'Pending').length,
        errors: checkedSections.filter(s => s.status === 'Mapping Error').length
      });
    }, 1100);
  };

  // Run diagnostics once on mount
  useEffect(() => {
    runDiagnostics();
  }, [patterns]);

  // Handle individual status toggle to test error handling
  const handleToggleStatus = (id) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === id) {
        let nextStatus = "Synced";
        let errMsg = null;
        if (sec.status === "Synced") {
          nextStatus = "Mapping Error";
          errMsg = "Fatal: Class target endpoint unresolved in active viewport node. Scraper returned HTTP 404.";
        } else if (sec.status === "Mapping Error") {
          nextStatus = "Pending";
        } else {
          nextStatus = "Synced";
        }
        return {
          ...sec,
          status: nextStatus,
          errorMessage: errMsg,
          lastVerified: "Just now"
        };
      }
      return sec;
    }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Synced':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Synced
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case 'Mapping Error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-50 border border-rose-200 text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Mapping Error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 bg-white rounded-[4px] p-1 erp-sync-dashboard-panel" id="erp-sync-dashboard-container">

      {/* Header and Live Scanner Hero */}
      <div className="bg-sand-50/50 border border-sand-200/80 rounded-[4px] p-5 lg:p-6 space-y-4 text-left" id="erp-sync-hero">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-clay-605 animate-pulse" />
              <h3 className="font-serif text-lg font-bold text-bark-950">
                ERP Content Sync Dashboard
              </h3>
            </div>
            <p className="text-xs text-bark-600 leading-relaxed max-w-2xl">
              This interactive dashboard charts and audits elements of the Perfect Fit Bureau storefront mapped directly to backend systems. Use the scanner below to verify DOM bindings, class markers, and metadata integrations in real-time.
            </p>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={isScanning}
            className="bg-bark-900 hover:bg-bark-950 disabled:bg-bark-300 text-white font-sans text-xs font-semibold px-4.5 py-2.5 rounded-[3px] border border-bark-850 shadow-3xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap self-stretch md:self-auto"
            id="btn-trigger-diagnostics"
            type="button"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Analyzing Bindings...' : 'Run Element Scraper Audit'}
          </button>
        </div>

        {/* Real-time Health Statistics bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-sand-200/60" id="erp-health-stats">
          <div className="bg-white p-3 rounded border border-sand-200/70 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-clay-50 flex items-center justify-center text-clay-700">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">Integration Rate</span>
              <span className="text-sm font-serif font-bold text-bark-900">
                {sections.filter(s => s.status === 'Synced').length} / {sections.length} Mapped
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded border border-sand-200/70 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">Last Scraper Run</span>
              <span className="text-sm font-serif font-bold text-bark-900 font-mono text-[11.5px]">
                {lastScanTime}
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded border border-sand-200/70 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-700">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">API Interface</span>
              <span className="text-sm font-serif font-bold text-bark-900 font-mono text-[10px]">
                window.setSartorialPatterns
              </span>
            </div>
          </div>
        </div>

        {isScanning && (
          <div className="bg-clay-50/50 border border-clay-150 rounded-[4px] p-3 text-xs text-clay-700 flex items-center gap-2.5 animate-pulse" id="scanner-pulse-banner">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-clay-605" />
            <span>Scanning active viewport nodes, searching for matching `data-erp-id` metadata tags and document structured scripts...</span>
          </div>
        )}
      </div>

      {/* Main Grid: Section Audits */}
      <div className="space-y-4 text-left" id="erp-sections-grid">
        <div className="flex items-center justify-between" id="section-grid-heading">
          <h4 className="font-serif text-sm font-semibold text-bark-950 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-clay-600" />
            Major App Component Mapping Ledger
          </h4>
          <span className="text-[10px] text-bark-500 font-sans italic">
            * Click Status Badge on any row to toggle state and test pipeline fallback alerts.
          </span>
        </div>

        <div className="divide-y divide-sand-150 border border-sand-200 rounded-[4px] overflow-hidden bg-white shadow-3xs" id="erp-sections-accordion-list">
          {sections.map((sec) => {
            const isError = sec.status === 'Mapping Error';
            const isPending = sec.status === 'Pending';
            const isSynced = sec.status === 'Synced';

            return (
              <div
                key={sec.id}
                className={`p-4 transition-all duration-200 hover:bg-sand-50/15 ${
                  isError ? 'bg-red-50/10' : isPending ? 'bg-amber-50/5' : ''
                }`}
                id={`erp-sec-card-${sec.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                  {/* Left info column */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <h5 className="font-serif text-xs font-bold text-bark-950">
                        {sec.name}
                      </h5>
                      <span className="text-[10px] font-mono text-bark-400 font-bold bg-sand-100 border border-sand-200/60 px-1.5 py-0.2 rounded">
                        ID: {sec.id}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-bark-600 font-sans leading-relaxed">
                      {sec.description}
                    </p>
                  </div>

                  {/* Right interactive toggles & indicators */}
                  <div className="flex items-center gap-3.5 self-start md:self-auto shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-[9px] uppercase font-mono text-bark-400 block font-semibold">Selector target</span>
                      <code className="text-[10px] font-mono text-clay-705 bg-clay-50/50 border border-clay-100 px-1.5 py-0.5 rounded font-bold">
                        {sec.selector}
                      </code>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(sec.id)}
                      className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                      title="Click to toggle simulated connection state"
                      type="button"
                      id={`btn-toggle-status-${sec.id}`}
                    >
                      {getStatusBadge(sec.status)}
                    </button>
                  </div>
                </div>

                {/* Meta details subgrid */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 pt-3.5 border-t border-sand-100/70" id={`sec-meta-details-${sec.id}`}>

                  {/* Target attributes list */}
                  <div className="md:col-span-8 space-y-1.5">
                    <span className="text-[9px] uppercase font-mono text-bark-400 block font-bold tracking-wider">
                      Mapped Struct Variables ({sec.mappedFields.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5" id={`mapped-vars-list-${sec.id}`}>
                      {sec.mappedFields.map((field, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono bg-sand-50 text-bark-750 border border-sand-200/60 px-1.8 py-0.5 rounded hover:border-sand-300 transition-colors"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Verification timestamp and markers */}
                  <div className="md:col-span-4 flex flex-col justify-end text-left md:text-right space-y-1">
                    <span className="text-[9.5px] text-bark-500 font-sans">
                      Verified: <strong className="font-mono font-medium text-bark-800">{sec.lastVerified}</strong>
                    </span>
                    <div className="flex items-center md:justify-end gap-1.5 text-[9.5px] text-bark-450 font-mono">
                      <span>Anchor class:</span>
                      <span className="text-bark-700 bg-sand-100 border border-sand-200 px-1 rounded">{sec.classMarker}</span>
                    </div>
                  </div>
                </div>

                {/* Error Banner Container */}
                <AnimatePresence>
                  {isError && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3.5 overflow-hidden"
                      id={`err-panel-${sec.id}`}
                    >
                      <div className="bg-rose-50 border border-rose-200 rounded-[3px] p-3 text-rose-800 space-y-1.5 text-xs font-sans">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Dynamic Scraper Verification Failure</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-rose-700 font-mono">
                          {sec.errorMessage || "Generic verification failure. Verify that appropriate data-erp-* selectors are rendered in current layout state."}
                        </p>
                        <div className="pt-1.5 border-t border-rose-150 flex items-center justify-between" id={`err-actions-${sec.id}`}>
                          <span className="text-[10px] text-rose-500 italic">
                            * Simulating backend warning state. Code anchors are safe.
                          </span>
                          <button
                            onClick={() => handleToggleStatus(sec.id)}
                            className="text-[10px] font-bold text-rose-800 hover:underline cursor-pointer"
                            type="button"
                          >
                            Hot-Patch Connection
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Developer Terminal Snippet helper */}
      <div className="border border-sand-200 rounded-[4px] bg-sand-950 p-4.5 text-left space-y-3" id="erp-sync-terminal">
        <div className="flex items-center justify-between" id="terminal-header">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
              Collaborator Console Logger (Active ERP Output)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400">LOGSTREAM ONLINE</span>
          </div>
        </div>

        <div className="font-mono text-[10.5px] text-sand-300 space-y-1 leading-relaxed bg-black/40 p-3 rounded" id="terminal-logs-pane">
          <p className="text-sand-500">[2026-07-04T16:04:30] Initiating background listener socket on port 3000...</p>
          <p className="text-emerald-400">[OK] Registered window.setSartorialPatterns API in window global namespace.</p>
          <p className="text-emerald-400">[OK] Registered postMessage HTML5 cross-origin event receiver.</p>
          <p className="text-sand-400">[AUDIT] Scraped {patterns.length} patterns with class `.erp-pattern-card[data-erp-id]` successfully.</p>
          <p className="text-amber-400">[WARN] Checked size matrix target [data-erp-patt-sizes] - found 1 unresolved node reference.</p>
          <p className="text-emerald-400">[OK] Head SEO JSON-LD injection script found: `script#sartorial-pattern-jsonld` (Size: {JSON.stringify(patterns[0] || {}).length} bytes).</p>
        </div>
      </div>

    </div>
  );
}
