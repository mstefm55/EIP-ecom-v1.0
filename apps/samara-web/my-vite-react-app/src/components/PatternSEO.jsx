import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { localizeMetadataTree } from '../lib/localizedMetadata';
import React, { useState, useEffect } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion } from 'motion/react';
import { Search, Globe, Code, Copy, Check, FileText, Sparkles, CheckCircle, RefreshCw } from 'lucide-react';

export default function PatternSEO({ pattern, reviews = [], isStandalone = false }) {
  const seoUi = localizeMetadataTree(perfectFitMetadata.componentUi.patternSeo, 'component.patternSeo', pfUiT);
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('snippet'); // 'snippet' | 'jsonld' | 'tags'

  // Calculate average reviews
  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  // JSON-LD structured data object
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": pattern?.name || "Premium Sewing Pattern",
    "image": pattern?.image || "",
    "description": pattern?.description || pattern?.tagline || "",
    "sku": pattern?.id || "perfectfit-patt-001",
    "category": pattern?.category || "Sewing Patterns",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": pattern?.pricePDF || 14.0,
      "highPrice": pattern?.pricePrinted || 24.0,
      "offerCount": "2",
      "offers": [
        {
          "@type": "Offer",
          "name": seoUi.schemaLabels.digitalOffer,
          "price": pattern?.pricePDF || 14.0,
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": window.location.href
        },
        {
          "@type": "Offer",
          "name": seoUi.schemaLabels.printedOffer,
          "price": pattern?.pricePrinted || 24.0,
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": window.location.href
        }
      ]
    },
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": seoUi.schemaLabels.difficulty,
        "value": pattern?.difficulty || "Intermediate"
      },
      {
        "@type": "PropertyValue",
        "name": seoUi.schemaLabels.fabricRequirements,
        "value": pattern?.fabricSuggestions?.join(", ") || ""
      },
      {
        "@type": "PropertyValue",
        "name": seoUi.schemaLabels.yardage60,
        "value": pattern?.yardageInfo?.width60 || ""
      }
    ]
  };

  if (avgRating) {
    schemaData.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": avgRating,
      "reviewCount": reviews.length,
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  // Dynamic DOM metadata updates
  useEffect(() => {
    if (!pattern) return;

    // 1. Title Tag
    const previousTitle = document.title;
    document.title = `${pattern.name} - Sewing Pattern Blueprint | Perfect Fit Bureau`;

    // 2. Helper to set/update meta tags in head
    const updateMetaTag = (nameAttr, nameVal, contentVal) => {
      let element = document.querySelector(`meta[${nameAttr}="${nameVal}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(nameAttr, nameVal);
        document.head.appendChild(element);
      }
      element.setAttribute('content', contentVal);
    };

    updateMetaTag('name', 'description', pattern.description || pattern.tagline);
    updateMetaTag('name', 'keywords', `sewing pattern, ${pattern.category}, digital pattern, pdf pattern, printable pattern, couture, tailoring, ${pattern.name}`);

    // Open Graph Tags
    updateMetaTag('property', 'og:title', `${pattern.name} - Professional Sewing Pattern`);
    updateMetaTag('property', 'og:description', pattern.description || pattern.tagline);
    updateMetaTag('property', 'og:image', pattern.image || '');
    updateMetaTag('property', 'og:type', 'product');
    updateMetaTag('property', 'og:url', window.location.href);

    // Twitter Tags
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', `${pattern.name} - Professional Sewing Pattern`);
    updateMetaTag('name', 'twitter:description', pattern.description || pattern.tagline);
    updateMetaTag('name', 'twitter:image', pattern.image || '');

    // 3. Application JSON-LD Script tag injection
    let scriptElement = document.getElementById('perfectfit-pattern-jsonld');
    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.id = 'perfectfit-pattern-jsonld';
      scriptElement.type = 'application/ld+json';
      document.head.appendChild(scriptElement);
    }
    scriptElement.textContent = JSON.stringify(schemaData, null, 2);

    return () => {
      // Revert metadata or script if needed
      document.title = previousTitle;
    };
  }, [pattern, reviews]);

  const copyToClipboard = () => {
    const jsonStr = JSON.stringify(schemaData, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!pattern) return null;

  return (
    <div className="space-y-4" id={`seo-engine-${pattern.id}`}>
      {/* Mini Info banner */}
      <div className="flex items-center justify-between gap-4 p-3 bg-clay-50/40 border border-clay-150/70 rounded-[4px]" id="seo-engine-banner">
        <div className="flex items-center gap-2 text-xs text-bark-850">
          <Globe className="w-3.5 h-3.5 text-clay-605 animate-pulse" />
          <span>
            Active SEO Meta-Tags &amp; Structured JSON-LD generated for <b>{pattern.name}</b>.
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-clay-700 bg-white border border-clay-200 px-1.5 py-0.5 rounded tracking-wider uppercase flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />{pfUiT("ui.components.patternseo.0dc4fcb5dc")}</span>
      </div>

      {/* Selector subtabs */}
      <div className="flex gap-2.5 border-b border-sand-200/65 pb-2" id="seo-subtabs">
        <button
          onClick={() => setActiveSubTab('snippet')}
          className={`px-3 py-1 text-[11px] font-sans font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
            activeSubTab === 'snippet'
              ? 'bg-bark-900 text-white shadow-3xs'
              : 'bg-sand-50/80 hover:bg-sand-100 text-bark-650'
          }`}
          type="button"
          id="btn-seo-subtab-snippet"
        >
          <Search className="w-3 h-3" />{pfUiT("ui.components.patternseo.e127e925da")}</button>
        <button
          onClick={() => setActiveSubTab('jsonld')}
          className={`px-3 py-1 text-[11px] font-sans font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
            activeSubTab === 'jsonld'
              ? 'bg-bark-900 text-white shadow-3xs'
              : 'bg-sand-50/80 hover:bg-sand-100 text-bark-650'
          }`}
          type="button"
          id="btn-seo-subtab-jsonld"
        >
          <Code className="w-3 h-3" />{pfUiT("ui.components.patternseo.f44af34990")}</button>
        <button
          onClick={() => setActiveSubTab('tags')}
          className={`px-3 py-1 text-[11px] font-sans font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
            activeSubTab === 'tags'
              ? 'bg-bark-900 text-white shadow-3xs'
              : 'bg-sand-50/80 hover:bg-sand-100 text-bark-650'
          }`}
          type="button"
          id="btn-seo-subtab-tags"
        >
          <FileText className="w-3 h-3" />{pfUiT("ui.components.patternseo.c68d1632c6")}</button>
      </div>

      {/* Subtab Panels */}
      <div className="min-h-[160px] flex flex-col justify-between" id="seo-subtab-content">
        {activeSubTab === 'snippet' && (
          <div className="space-y-4 animate-fade-in" id="seo-panel-snippet">
            {/* Real Search engine layout mockup */}
            <div className="border border-sand-200 bg-white p-4 rounded-[4px] shadow-3xs space-y-2 text-left" id="google-snippet-card">
              <div className="flex items-center gap-2 text-xs text-[#202124]" id="google-url-row">
                <div className="w-5 h-5 bg-sand-100 rounded-full flex items-center justify-center text-[10px] text-bark-800 font-serif">
                  S
                </div>
                <div>
                  <div className="text-xs text-bark-800 font-sans leading-none">Perfect Fit Bureau</div>
                  <div className="text-[10px] text-bark-450 font-sans mt-0.5 leading-none">
                    https://bureau.perfectfit.com/patterns/{pattern.id}
                  </div>
                </div>
              </div>

              {/* Page Title link */}
              <h4 className="text-[15px] text-[#1a0dab] hover:underline font-serif font-semibold leading-tight cursor-pointer" id="google-title">
                {pattern.name} - Sewing Pattern Blueprint | Perfect Fit Bureau
              </h4>

              {/* Rich snippet review starts and pricing */}
              <div className="flex items-center gap-2 text-[11px] text-[#4d5156] font-sans border-y border-sand-100/70 py-1" id="google-rich-snippets">
                {avgRating ? (
                  <div className="flex items-center gap-1 border-r border-sand-200 pr-2">
                    <span className="text-amber-500">{pfUiT("ui.components.patternseo.feaa1f8746")}</span>
                    <span>{pfUiT("ui.components.patternseo.68c4a7378a")}<b>{avgRating}</b> ({reviews.length} votes)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 border-r border-sand-200 pr-2">
                    <span className="text-amber-500">{pfUiT("ui.components.patternseo.feaa1f8746")}</span>
                    <span>{pfUiT("ui.components.patternseo.68c4a7378a")}<b>4.9</b> (Excellent)</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span>{pfUiT("ui.components.patternseo.2bc7a82f95")}<b>${pattern.pricePDF.toFixed(2)} - ${pattern.pricePrinted.toFixed(2)}</b></span>
                  <span className="text-[9px] bg-green-50 border border-green-200 text-green-700 px-1 py-0.2 rounded font-semibold font-mono">{pfUiT("ui.components.patternseo.08fa5d8c16")}</span>
                </div>
              </div>

              {/* Excerpt */}
              <p className="text-xs text-[#4d5156] leading-relaxed font-sans line-clamp-2">
                {pattern.description || pattern.tagline} Perfect for {pattern.fabricSuggestions?.slice(0, 3).join(', ')}. Intermediate difficulty sewing blueprint.
              </p>
            </div>

            <p className="text-[11px] text-bark-500 font-sans leading-relaxed">{pfUiT("ui.components.patternseo.a58970e55f")}</p>
          </div>
        )}

        {activeSubTab === 'jsonld' && (
          <div className="space-y-3 animate-fade-in text-left" id="seo-panel-jsonld">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-bark-450">
                Injected Head Script Tag (Schema.org / Product)
              </span>
              <button
                onClick={copyToClipboard}
                className="text-[10px] font-sans font-bold text-clay-700 hover:text-clay-800 flex items-center gap-1 cursor-pointer bg-sand-50 hover:bg-sand-100 border border-sand-200 px-2 py-1 rounded"
                title={pfUiT("ui.components.patternseo.93e9480ec0")}
                type="button"
                id="btn-copy-jsonld"
              >
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied JSON!' : 'Copy to Clipboard'}
              </button>
            </div>

            <div className="relative" id="jsonld-code-wrapper">
              <pre className="text-[10.5px] font-mono text-bark-800 bg-sand-50/60 border border-sand-200 rounded-[4px] p-3.5 overflow-x-auto max-h-[220px] leading-relaxed">
                {JSON.stringify(schemaData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {activeSubTab === 'tags' && (
          <div className="space-y-2 animate-fade-in text-left" id="seo-panel-tags">
            <span className="text-[10px] font-mono uppercase tracking-wider text-bark-450 block mb-1">{pfUiT("ui.components.patternseo.55cb89774a")}</span>
            <div className="border border-sand-200/85 rounded-[4px] overflow-hidden bg-white shadow-3xs" id="meta-tags-table">
              <table className="w-full text-left text-[11px] font-sans">
                <thead className="bg-sand-50/50 border-b border-sand-200 text-bark-500 font-mono text-[9px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2 pl-3">{pfUiT("ui.components.patternseo.31856164b1")}</th>
                    <th className="p-2">{pfUiT("ui.components.patternseo.a9db8c513a")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100 font-mono text-bark-750 text-[10px]">
                  <tr>
                    <td className="p-2 pl-3 font-semibold text-bark-900">&lt;title&gt;</td>
                    <td className="p-2 font-sans text-xs text-bark-600 line-clamp-1">{pattern.name} - Sewing Pattern Blueprint | Perfect Fit Bureau</td>
                  </tr>
                  <tr>
                    <td className="p-2 pl-3 font-semibold text-bark-900">meta[name="description"]</td>
                    <td className="p-2 font-sans text-xs text-bark-600 line-clamp-1">{pattern.description || pattern.tagline}</td>
                  </tr>
                  <tr>
                    <td className="p-2 pl-3 font-semibold text-bark-900">meta[property="og:image"]</td>
                    <td className="p-2 text-clay-700 truncate max-w-[250px]">{pattern.image || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="p-2 pl-3 font-semibold text-bark-900">meta[property="og:type"]</td>
                    <td className="p-2">{pfUiT("ui.components.patternseo.cdfe374d8f")}</td>
                  </tr>
                  <tr>
                    <td className="p-2 pl-3 font-semibold text-bark-900">meta[name="twitter:card"]</td>
                    <td className="p-2">{pfUiT("ui.components.patternseo.39a5f662a8")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
