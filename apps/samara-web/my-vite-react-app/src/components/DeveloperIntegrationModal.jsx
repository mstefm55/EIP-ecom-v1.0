import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import React, { useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { X, Code, Terminal, Copy, Check, Info, FileText, Sparkles, RefreshCw, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { UI_LAYERS } from '../lib/uiLayers';

export default function DeveloperIntegrationModal({ isOpen, onClose, patterns, setPatterns }) {
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'mapping' | 'playground' | 'faq'
  const [copiedText, setCopiedText] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState(0); // Open first FAQ item by default

  const faqItems = [
    {
      key: "id_scanning",
      tag: "ID Mapping",
      question: "How does the ERP locate and scan individual sewing pattern blueprints?",
      attribute: "data-erp-id",
      selector: ".erp-pattern-card[data-erp-id]",
      answer: "Every pattern component is rendered with a unique data attribute `data-erp-id` containing a standardized string (e.g., 'erp-patt-001'). Scanner scripts can locate all cards with document queries like `document.querySelectorAll('.erp-pattern-card[data-erp-id]')` to extract current active listings on the digital storefront.",
      useCase: "Real-time sync of on-shelf digital listings with ERP database inventory."
    },
    {
      key: "price_injection",
      tag: "Price Roles",
      question: "How does the system dynamically inject and overwrite retail pricing models?",
      attribute: "data-erp-price-pdf, data-erp-price-printed",
      selector: ".erp-pattern-price[data-erp-field=\"price\"]",
      answer: "To prevent hardcoded client mismatch, prices are exposed as raw floating-point attributes on the price elements. ERP pricing engines can read these values directly to verify margins, or write to them during live seasonal campaign overrides via dynamic API script injections.",
      useCase: "Dynamic campaign pricing pushes and currency conversion audits."
    },
    {
      key: "material_procurement",
      tag: "Material Specs",
      question: "How does material procurement (yardage and fabric types) map to global inventory levels?",
      attribute: "data-erp-fabrics, data-erp-yardage-60",
      selector: ".erp-pattern-fabrics, .erp-pattern-yardage",
      answer: "Fabric suggestions and yardage constraints are embedded as structured data attributes. Purchasing or material routing bots can scrape these values on-the-fly to calculate total fabric nesting requirements when orders are processed.",
      useCase: "Automated trigger for bulk fabric purchasing orders based on consumer demand peaks."
    },
    {
      key: "labor_complexity",
      tag: "Costing Tag",
      question: "What is the significance of the labor complexity and difficulty metadata tags?",
      attribute: "data-erp-difficulty",
      selector: ".erp-pattern-card[data-erp-difficulty]",
      answer: "The difficulty rating mapped as `data-erp-difficulty` (e.g., 'Advanced', 'Intermediate') is bound directly to assembly line costing standards. Automated booking engines use this metadata to calculate average sewing completion hours.",
      useCase: "Evaluating labor costs and piecework compensation rates for production facilities."
    },
    {
      key: "state_synchronization",
      tag: "Live Sync",
      question: "How can my ERP securely push updates to the active storefront in real-time?",
      attribute: "window.setSartorialPatterns, window.postMessage",
      selector: "Global Namespace Listeners",
      answer: "You can override or enrich any listing programmatically. The React application listens for custom namespace calls and HTML5 postMessage events, recalculating filters and views instantly without page refreshes.",
      useCase: "Automated batch catalogs pushes from back-office ERP ledgers."
    }
  ];

  const [playgroundJson, setPlaygroundJson] = useState(() => JSON.stringify([
    {
      id: "erp-patt-001",
      name: "milan structured duster",
      tagline: "Sharp double-breasted collar with structured drop shoulder elegance",
      description: "Designed for premium heavyweight boiled wool or structured raw linen. Includes fully plotted internal facing guides, back storm flap overlays, and multi-option welt pockets with classic silk linings.",
      category: "Jackets",
      difficulty: "Advanced",
      difficultyLevel: 3,
      pricePDF: 15.00,
      pricePrinted: 34.00,
      image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=600",
      fabricSuggestions: ["Heavy Boiled Wool", "Raw Tailoring Linen", "Heavyweight Gabardine"],
      yardageInfo: { width60: "3.2 yards", width45: "4.4 yards" },
      skillsAcquired: ["Double welt pockets", "Fully bound internal facings", "Storm flap tailoring"],
      lineArtUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600"
    }
  ], null, 2));

  const [simulationStatus, setSimulationStatus] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const runSimulation = () => {
    try {
      const parsed = JSON.parse(playgroundJson);
      if (Array.isArray(parsed)) {
        const res = window.setSartorialPatterns(parsed);
        if (res.success) {
          setSimulationStatus({ success: true, message: `Successfully pushed ${res.count} patterns dynamically into the store catalog!` });
        } else {
          setSimulationStatus({ success: false, message: res.error });
        }
      } else if (parsed && typeof parsed === 'object') {
        const res = window.pushSartorialPattern(parsed);
        if (res.success) {
          setSimulationStatus({ success: true, message: `Successfully pushed pattern "${parsed.name || parsed.id}" to the catalog!` });
        } else {
          setSimulationStatus({ success: false, message: res.error });
        }
      } else {
        setSimulationStatus({
          success: false,
          message: pfUiT(
            'ui.developerIntegration.payload.invalidFormat',
            {},
            'Invalid payload format. Must be an array or a single pattern object.'
          )
        });
      }
    } catch (err) {
      setSimulationStatus({ success: false, message: `JSON Parse Error: ${err.message}` });
    }
    setTimeout(() => setSimulationStatus(null), 5000);
  };

  const loadDefaultCatalogJson = () => {
    setPlaygroundJson(JSON.stringify(patterns.slice(0, 2), null, 2));
  };

  const windowFunctionCode = `// 1. Overwrite full pattern database dynamically
const result = window.setSartorialPatterns([
  {
    "id": "erp-patt-001",
    "name": "milan structured duster",
    "tagline": "Sharp double-breasted collar with structured drop shoulder elegance",
    "description": "Designed for premium heavyweight boiled wool or structured raw linen.",
    "category": "Jackets",
    "difficulty": "Advanced",
    "pricePDF": 15.00,
    "pricePrinted": 34.00,
    "image": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=600",
    "fabricSuggestions": ["Heavy Boiled Wool", "Raw Tailoring Linen"],
    "yardageInfo": { "width60": "3.2 yards" }
  }
]);
console.log(result); // { success: true, count: 1 }`;

  const postMessageCode = `// 2. Trigger updates from cross-origin iframes or external scripts
window.postMessage({
  type: 'SET_SARTORIAL_PATTERNS',
  patterns: [
    {
      "id": "external-001",
      "name": "asymmetric dynamic wrap",
      "category": "Dresses",
      "difficulty": "Intermediate",
      "pricePDF": 12.00,
      "pricePrinted": 28.00,
      "image": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600",
      "fabricSuggestions": ["Silk Crepe", "Viscose"],
      "yardageInfo": { "width60": "2.5 yards" }
    }
  ]
}, "*");`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: UI_LAYERS.modalBackdrop }}
          id="dev-integration-modal-wrapper"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bark-950/80 backdrop-blur-xs"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
            id="dev-modal-backdrop"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.45 }}
            className="bg-white border border-sand-200/90 rounded-[4px] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            style={{ zIndex: UI_LAYERS.modal }}
            id="dev-modal-content"
          >
            {/* Header */}
            <div className="bg-sand-50/70 border-b border-sand-200/60 px-6 py-4 flex items-center justify-between" id="dev-modal-header">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[4px] bg-bark-900 text-white flex items-center justify-center" id="dev-icon-badge">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-bark-950 font-medium text-base tracking-tight flex items-center gap-1.5">
                    ERP Integration &amp; Dynamic Mapping Console
                    <span className="text-[9px] bg-clay-50 text-clay-700 px-1.5 py-0.5 rounded-full border border-clay-200 font-sans font-semibold tracking-wider uppercase">{pfUiT("ui.components.developerintegrationmodal.ec4fdd4800")}</span>
                  </h3>
                  <p className="text-[10.5px] text-bark-500 font-sans mt-0.5">{pfUiT("ui.components.developerintegrationmodal.c99662210b")}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-bark-400 hover:text-bark-950 p-1.5 hover:bg-sand-100/50 rounded-full transition-all cursor-pointer"
                id="dev-modal-close-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation tabs */}
            <div className="flex border-b border-sand-250/55 bg-sand-50/20 px-6 text-xs font-semibold tracking-wider uppercase text-bark-400" id="dev-modal-tabs">
              <button
                onClick={() => setActiveTab('specs')}
                className={`py-3.5 px-1 border-b-2 font-sans transition-all cursor-pointer flex items-center gap-1.5 mr-6 ${
                  activeTab === 'specs' ? 'border-clay-605 text-bark-900 font-bold' : 'border-transparent hover:text-bark-750'
                }`}
                id="tab-specs"
              >
                <Terminal className="w-3.5 h-3.5" />{pfUiT("ui.components.developerintegrationmodal.39ce527096")}</button>
              <button
                onClick={() => setActiveTab('mapping')}
                className={`py-3.5 px-1 border-b-2 font-sans transition-all cursor-pointer flex items-center gap-1.5 mr-6 ${
                  activeTab === 'mapping' ? 'border-clay-605 text-bark-900 font-bold' : 'border-transparent hover:text-bark-750'
                }`}
                id="tab-mapping"
              >
                <FileText className="w-3.5 h-3.5" />
                Selector &amp; Metadata Map
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`py-3.5 px-1 border-b-2 font-sans transition-all cursor-pointer flex items-center gap-1.5 mr-6 ${
                  activeTab === 'faq' ? 'border-clay-605 text-bark-900 font-bold' : 'border-transparent hover:text-bark-750'
                }`}
                id="tab-faq"
              >
                <HelpCircle className="w-3.5 h-3.5 text-clay-600" />{pfUiT("ui.components.developerintegrationmodal.29d994e327")}</button>
              <button
                onClick={() => setActiveTab('playground')}
                className={`py-3.5 px-1 border-b-2 font-sans transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'playground' ? 'border-clay-605 text-bark-900 font-bold' : 'border-transparent hover:text-bark-750'
                }`}
                id="tab-playground"
              >
                <Sparkles className="w-3.5 h-3.5 text-clay-600" />{pfUiT("ui.components.developerintegrationmodal.b1eb97fddf")}</button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" id="dev-modal-body">

              {/* Tab 1: API SPECS */}
              {activeTab === 'specs' && (
                <div className="space-y-6 animate-fade-in" id="content-specs">
                  <div className="bg-amber-50/40 border border-amber-200/50 rounded-[4px] p-4 flex gap-3 text-xs text-bark-750 leading-relaxed" id="api-callout">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <b className="text-bark-900 font-semibold block mb-0.5">{pfUiT("ui.components.developerintegrationmodal.e9ef2cd67b")}</b>{pfUiT("ui.components.developerintegrationmodal.c8d69f7382")}<code className="bg-amber-100/50 px-1 py-0.5 font-mono text-[11px] rounded">{pfUiT("ui.components.developerintegrationmodal.a93561d776")}</code>{pfUiT("ui.components.developerintegrationmodal.b498bf30b9")}</div>
                  </div>

                  <div className="space-y-4" id="global-window-methods">
                    <h4 className="font-serif text-sm font-semibold text-bark-900 border-l-2 border-clay-505 pl-2.5">{pfUiT("ui.components.developerintegrationmodal.35ccdc0b65")}</h4>
                    <p className="text-xs text-bark-600 leading-normal">{pfUiT("ui.components.developerintegrationmodal.6e162cbf33")}</p>
                    <div className="relative group" id="code-block-window">
                      <pre className="bg-bark-950 text-sand-100 rounded-[4px] p-4 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-[220px]">
                        {windowFunctionCode}
                      </pre>
                      <button
                        onClick={() => handleCopy(windowFunctionCode, 'window')}
                        className="absolute top-3 right-3 bg-bark-900 hover:bg-bark-850 text-white p-1.5 rounded-[3px] border border-bark-800 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                        title={pfUiT("ui.components.developerintegrationmodal.706f203e0d")}
                        type="button"
                        id="copy-window-code"
                      >
                        {copiedText === 'window' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4" id="cross-document-messages">
                    <h4 className="font-serif text-sm font-semibold text-bark-900 border-l-2 border-clay-505 pl-2.5">{pfUiT("ui.components.developerintegrationmodal.ba43aaffca")}</h4>
                    <p className="text-xs text-bark-600 leading-normal">{pfUiT("ui.components.developerintegrationmodal.039f1cccc0")}</p>
                    <div className="relative group" id="code-block-msg">
                      <pre className="bg-bark-950 text-sand-100 rounded-[4px] p-4 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-[220px]">
                        {postMessageCode}
                      </pre>
                      <button
                        onClick={() => handleCopy(postMessageCode, 'msg')}
                        className="absolute top-3 right-3 bg-bark-900 hover:bg-bark-850 text-white p-1.5 rounded-[3px] border border-bark-800 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                        title={pfUiT("ui.components.developerintegrationmodal.706f203e0d")}
                        type="button"
                        id="copy-msg-code"
                      >
                        {copiedText === 'msg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: SELECTOR AND METADATA MAP */}
              {activeTab === 'mapping' && (
                <div className="space-y-6 animate-fade-in" id="content-mapping">
                  <div className="bg-sand-50/50 border border-sand-200/70 rounded-[4px] p-4" id="selector-intro">
                    <h4 className="font-serif text-sm font-semibold text-bark-950 mb-1">{pfUiT("ui.components.developerintegrationmodal.57b2a95157")}</h4>
                    <p className="text-xs text-bark-550 leading-relaxed">{pfUiT("ui.components.developerintegrationmodal.719db7c5e3")}</p>
                  </div>

                  {/* Table of Map markers */}
                  <div className="border border-sand-200/80 rounded-[4px] overflow-hidden" id="mapping-table-wrapper">
                    <table className="w-full text-left border-collapse text-xs font-sans">
                      <thead>
                        <tr className="bg-sand-50/80 text-bark-800 font-bold border-b border-sand-200/90">
                          <th className="p-3.5">{pfUiT("ui.components.developerintegrationmodal.b42acf1841")}</th>
                          <th className="p-3.5">{pfUiT("ui.components.developerintegrationmodal.da6a168e20")}</th>
                          <th className="p-3.5">{pfUiT("ui.components.developerintegrationmodal.205b2ba745")}</th>
                          <th className="p-3.5">{pfUiT("ui.components.developerintegrationmodal.f3bb60f700")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-200/60 text-bark-700">
                        <tr className="hover:bg-sand-50/20">
                          <td className="p-3.5 font-semibold text-bark-900">{pfUiT("ui.components.developerintegrationmodal.0eaae08268")}</td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-clay-700">{pfUiT("ui.components.developerintegrationmodal.f1a3664d97")}</code></td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-bark-800">{pfUiT("ui.components.developerintegrationmodal.5912eb6685")}</code></td>
                          <td className="p-3.5 text-bark-550">{pfUiT("ui.components.developerintegrationmodal.1807b40c4a")}</td>
                        </tr>
                        <tr className="hover:bg-sand-50/20">
                          <td className="p-3.5 font-semibold text-bark-900">{pfUiT("ui.components.developerintegrationmodal.d483ef21ca")}</td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-clay-700">{pfUiT("ui.components.developerintegrationmodal.e6388b636e")}</code></td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-bark-800">data-erp-field="name"</code></td>
                          <td className="p-3.5 text-bark-550">{pfUiT("ui.components.developerintegrationmodal.de559a18f8")}</td>
                        </tr>
                        <tr className="hover:bg-sand-50/20">
                          <td className="p-3.5 font-semibold text-bark-900">{pfUiT("ui.components.developerintegrationmodal.b3c36d62b5")}</td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-clay-700">{pfUiT("ui.components.developerintegrationmodal.53b2be0869")}</code></td>
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1 max-w-[200px]">
                              <code className="bg-sand-100/75 px-1 py-0.5 rounded text-[10px] font-mono text-bark-800">data-erp-field="price"</code>
                              <code className="bg-sand-100/75 px-1 py-0.5 rounded text-[10px] font-mono text-bark-800">{pfUiT("ui.components.developerintegrationmodal.b1f1e3a71e")}</code>
                              <code className="bg-sand-100/75 px-1 py-0.5 rounded text-[10px] font-mono text-bark-800">{pfUiT("ui.components.developerintegrationmodal.f71e7ba6a2")}</code>
                            </div>
                          </td>
                          <td className="p-3.5 text-bark-550">{pfUiT("ui.components.developerintegrationmodal.b9a30608a1")}</td>
                        </tr>
                        <tr className="hover:bg-sand-50/20">
                          <td className="p-3.5 font-semibold text-bark-900">{pfUiT("ui.components.developerintegrationmodal.5d7ca9235e")}</td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-clay-700">{pfUiT("ui.components.developerintegrationmodal.f37b79c062")}</code></td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-bark-800">data-erp-field="description", data-erp-tagline</code></td>
                          <td className="p-3.5 text-bark-550">{pfUiT("ui.components.developerintegrationmodal.d8cc7dcd36")}</td>
                        </tr>
                        <tr className="hover:bg-sand-50/20">
                          <td className="p-3.5 font-semibold text-bark-900">{pfUiT("ui.components.developerintegrationmodal.2ea51a6f38")}</td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-clay-700">{pfUiT("ui.components.developerintegrationmodal.5ee81e690b")}</code></td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-bark-800">data-erp-field="fabric-suggestions", data-erp-fabrics</code></td>
                          <td className="p-3.5 text-bark-550">{pfUiT("ui.components.developerintegrationmodal.98ff6d114a")}</td>
                        </tr>
                        <tr className="hover:bg-sand-50/20">
                          <td className="p-3.5 font-semibold text-bark-900">{pfUiT("ui.components.developerintegrationmodal.d83b0fe6ee")}</td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-clay-700">{pfUiT("ui.components.developerintegrationmodal.2b564e7e2f")}</code></td>
                          <td className="p-3.5"><code className="bg-sand-100/75 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-bark-800">data-erp-field="yardage-info-60", data-erp-yardage-60</code></td>
                          <td className="p-3.5 text-bark-550">{pfUiT("ui.components.developerintegrationmodal.724f7642da")}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: METADATA ROLES FAQ */}
              {activeTab === 'faq' && (
                <div className="space-y-6 animate-fade-in" id="content-faq">
                  <div className="bg-sand-50/50 border border-sand-200/70 rounded-[4px] p-4" id="faq-intro">
                    <h4 className="font-serif text-sm font-semibold text-bark-950 mb-1">{pfUiT("ui.components.developerintegrationmodal.a9a1dde083")}</h4>
                    <p className="text-xs text-bark-550 leading-relaxed">{pfUiT("ui.components.developerintegrationmodal.58652e2b18")}</p>
                  </div>

                  <div className="space-y-3.5 erp-faq-container" id="erp-faq-accordion-list">
                    {faqItems.map((item, idx) => {
                      const isOpen = openFaqIndex === idx;
                      return (
                        <div
                          key={idx}
                          className="border border-sand-200/80 rounded-[4px] overflow-hidden bg-white hover:border-sand-350 transition-all erp-faq-item"
                          id={`faq-item-${idx}`}
                          data-erp-faq-key={item.key}
                          data-erp-faq-expanded={isOpen ? "true" : "false"}
                        >
                          {/* Accordion Header */}
                          <button
                            onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                            className="w-full flex items-center justify-between p-4 bg-sand-50/15 hover:bg-sand-50/50 text-left transition-all cursor-pointer font-sans text-xs font-semibold text-bark-900 erp-faq-question-btn focus:outline-none focus:ring-1 focus:ring-clay-505/20"
                            type="button"
                            id={`faq-btn-${idx}`}
                          >
                            <span className="flex items-center gap-2.5 pr-4 erp-faq-question-text">
                              <span className="text-[10px] font-mono text-clay-700 bg-clay-50 border border-clay-150 px-1.5 py-0.5 rounded uppercase shrink-0">
                                {item.tag}
                              </span>
                              {item.question}
                            </span>
                            <span className="text-bark-450 shrink-0">
                              {isOpen ? <ChevronUp className="w-4 h-4 text-clay-605" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                          </button>

                          {/* Accordion Answer Content */}
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 bg-white border-t border-sand-150 space-y-3.5 text-xs text-bark-750 font-sans leading-relaxed erp-faq-answer">
                                  {/* Code / Attribute summary row */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-sand-50/60 p-3 rounded border border-sand-200/55" id={`faq-meta-details-${idx}`}>
                                    <div>
                                      <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">{pfUiT("ui.components.developerintegrationmodal.e85ed919a8")}</span>
                                      <code className="bg-white border border-sand-250 text-[10.5px] font-mono px-1.5 py-0.5 rounded text-bark-850 mt-1 block w-fit">
                                        {item.attribute}
                                      </code>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">{pfUiT("ui.components.developerintegrationmodal.02eacb7e5b")}</span>
                                      <code className="bg-white border border-sand-250 text-[10.5px] font-mono px-1.5 py-0.5 rounded text-clay-705 mt-1 block w-fit">
                                        {item.selector}
                                      </code>
                                    </div>
                                  </div>

                                  <p className="erp-faq-role-description leading-relaxed text-bark-700">
                                    {item.answer}
                                  </p>

                                  <div className="text-[10.5px] text-bark-550 border-l-2 border-clay-500 pl-3 italic" id={`faq-use-case-${idx}`}>
                                    <strong>{pfUiT("ui.components.developerintegrationmodal.f7e4287236")}</strong> {item.useCase}
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
              )}

              {/* Tab 3: INTERACTIVE SIMULATOR PLAYGROUND */}
              {activeTab === 'playground' && (
                <div className="space-y-4 animate-fade-in" id="content-playground">
                  <div className="bg-clay-50 border border-clay-100 rounded-[4px] p-4 flex gap-3 text-xs text-bark-800 leading-normal" id="playground-intro">
                    <Sparkles className="w-4 h-4 text-clay-605 shrink-0 mt-0.5" />
                    <div>
                      <b className="text-clay-950 font-semibold block mb-0.5">{pfUiT("ui.components.developerintegrationmodal.89c0b522ee")}</b>{pfUiT("ui.components.developerintegrationmodal.fdfb057e87")}<b>{pfUiT("ui.components.developerintegrationmodal.d911012f61")}</b>{pfUiT("ui.components.developerintegrationmodal.061d022149")}<b>{pfUiT("ui.components.developerintegrationmodal.fb113e5e66")}</b>{pfUiT("ui.components.developerintegrationmodal.a3c4572eef")}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5" id="playground-interface-grid">
                    {/* Left: Input */}
                    <div className="md:col-span-8 flex flex-col space-y-3" id="playground-left">
                      <div className="flex items-center justify-between" id="playground-bar">
                        <label className="text-[11px] font-bold text-bark-800 uppercase tracking-wider font-sans">{pfUiT("ui.components.developerintegrationmodal.9c4c88943c")}</label>
                        <div className="flex gap-2">
                          <button
                            onClick={loadDefaultCatalogJson}
                            className="text-[10px] text-clay-700 hover:text-clay-900 font-semibold bg-clay-50/50 hover:bg-clay-100/40 border border-clay-200/80 px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1"
                            type="button"
                            id="btn-load-defaults"
                          >
                            <RefreshCw className="w-3 h-3" />{pfUiT("ui.components.developerintegrationmodal.15921e4da2")}</button>
                        </div>
                      </div>

                      <textarea
                        value={playgroundJson}
                        onChange={(e) => setPlaygroundJson(e.target.value)}
                        className="w-full h-[280px] bg-bark-950 text-sand-100 font-mono text-[10.5px] p-4 rounded-[4px] border border-bark-900 focus:outline-none focus:ring-1 focus:ring-clay-500/80 leading-relaxed resize-none"
                        id="playground-textarea"
                        placeholder={pfUiT("ui.components.developerintegrationmodal.7c2bdd330e")}
                      />
                    </div>

                    {/* Right: Controls & Results */}
                    <div className="md:col-span-4 flex flex-col justify-between border border-sand-200/80 rounded-[4px] p-4 bg-sand-50/20" id="playground-right">
                      <div className="space-y-3">
                        <h5 className="font-serif text-xs font-semibold text-bark-900 uppercase tracking-wider border-b border-sand-200/60 pb-2">{pfUiT("ui.components.developerintegrationmodal.cdcb2e3cdf")}</h5>
                        <p className="text-[10.5px] text-bark-500 leading-relaxed">
                          Your dynamic ERP push is mapped into internal client state. Any item matching a category filter (e.g. "Jackets") will automatically inherit filtering logic.
                        </p>

                        {simulationStatus && (
                          <div
                            className={`p-3 rounded-[3px] text-xs leading-normal animate-fade-in border ${
                              simulationStatus.success
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                : 'bg-rose-50 text-rose-900 border-rose-250'
                            }`}
                            id="sim-status-banner"
                          >
                            <span className="font-semibold block mb-0.5">{simulationStatus.success ? "Push Succeeded!" : "Push Blocked!"}</span>
                            {simulationStatus.message}
                          </div>
                        )}
                      </div>

                      <div className="pt-4" id="sim-action-area">
                        <button
                          onClick={runSimulation}
                          className="w-full bg-bark-900 hover:bg-bark-950 text-white font-sans font-semibold text-xs py-2.5 px-4 rounded-[3px] transition-all cursor-pointer shadow-3xs hover:shadow-xs active:scale-[0.98] flex items-center justify-center gap-2"
                          type="button"
                          id="btn-simulate-push"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />{pfUiT("ui.components.developerintegrationmodal.aab0138872")}</button>
                        <p className="text-[9px] text-bark-400 text-center mt-2">{pfUiT("ui.components.developerintegrationmodal.3bcfd6aa02")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer actions */}
            <div className="bg-sand-50/60 border-t border-sand-200/70 px-6 py-4 flex justify-between items-center text-[10.5px]" id="dev-modal-footer">
              <span className="text-bark-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-clay-605" />{pfUiT("ui.components.developerintegrationmodal.4b609198b6")}<b>{pfUiT("ui.components.developerintegrationmodal.2a09d1df54")}</b>{pfUiT("ui.components.developerintegrationmodal.ffa89f04c4")}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    runtimeDataStorage.removeItem('sartorial_erp_patterns');
                    window.location.reload();
                  }}
                  className="px-3.5 py-1.5 border border-sand-300 text-bark-750 bg-white hover:bg-sand-50 rounded-[3px] font-sans font-semibold transition-all cursor-pointer active:scale-[0.98]"
                  title={pfUiT("ui.components.developerintegrationmodal.4df73773ad")}
                  type="button"
                  id="btn-reset-original"
                >{pfUiT("ui.components.developerintegrationmodal.09e1deff19")}</button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-bark-900 text-white hover:bg-bark-950 rounded-[3px] font-sans font-semibold transition-all cursor-pointer active:scale-[0.98]"
                  type="button"
                  id="btn-close-modal"
                >{pfUiT("ui.components.developerintegrationmodal.194cc27c7d")}</button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
