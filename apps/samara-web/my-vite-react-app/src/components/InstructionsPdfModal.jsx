import React, { useState, useEffect } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { localizeMetadataTree } from '../lib/localizedMetadata';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  Columns,
  Square,
  ChevronLeft,
  ChevronRight,
  Info,
  FileText,
  Sparkles,
  Check,
  Loader2,
  FileCheck,
  Scissors,
  Bookmark
} from 'lucide-react';
import { UI_LAYERS } from '../lib/uiLayers';

export default function InstructionsPdfModal({ isOpen, onClose, pattern }) {
  const instructionsUi = perfectFitMetadata.componentUi.instructionsPdf;
  const localizedPieceMap = localizeMetadataTree(
    instructionsUi.patternPiecesByCategory,
    'component.instructionsPdf.patternPiecesByCategory',
    pfUiT
  );
  const sewingSteps = localizeMetadataTree(
    instructionsUi.sewingSteps,
    'component.instructionsPdf.sewingSteps',
    pfUiT
  );
  const [zoom, setZoom] = useState(100);
  const [isDualPage, setIsDualPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  // Auto-set single page on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsDualPage(false);
      } else {
        setIsDualPage(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !pattern) return null;

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 150));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 75));
  };

  const handleDownload = () => {
    if (isDownloading || downloadSuccess) return;
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    }, 1500);
  };

  const handlePrint = () => {
    if (isPrinting || printSuccess) return;
    setIsPrinting(true);
    setTimeout(() => {
      setIsPrinting(false);
      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 3000);
    }, 1200);
  };

  // Helper values
  const fileName = `${pattern.name.toLowerCase().replace(/[\s-]+/g, '_')}_instructions_sample.pdf`;
  const patternNum = pattern.id.toUpperCase();

  // Pattern-piece labels and presentation geometry are canonical rendering metadata.
  const pieces =
    localizedPieceMap[pattern.category] ||
    localizedPieceMap.default ||
    [];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6"
        style={{ zIndex: UI_LAYERS.modalBackdrop }}
        id="pdf-modal-viewport"
      >
        {/* Backdrop filter blur with motion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-bark-950/65 backdrop-blur-xs cursor-pointer"
          id="pdf-modal-backdrop"
        />

        {/* Core PDF Window Container */}
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 20 }}
          style={{ zIndex: UI_LAYERS.modal }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="bg-sand-100 border border-sand-250 shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col rounded-lg overflow-hidden relative z-10"
          id="pdf-window-frame"
        >
          {/* TOP TOOLBAR - Chrome / Acrobat styling */}
          <div className="bg-bark-900 border-b border-bark-800 text-sand-50 px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0" id="pdf-toolbar">

            {/* Title Block */}
            <div className="flex items-center gap-2.5 min-w-0" id="pdf-title-block">
              <div className="bg-clay-600 p-1.5 rounded text-white flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-mono font-bold tracking-tight text-sand-100 truncate">
                  {fileName}
                </h3>
                <p className="text-[9px] font-mono text-sand-300/75 leading-none mt-0.5">
                  Perfect Fit Bureau PDF Spooler • v2.8 (Licensed Specimen)
                </p>
              </div>
            </div>

            {/* Quick action tools */}
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap" id="pdf-middle-actions">

              {/* Pagination Controls */}
              <div className="flex items-center bg-bark-800/80 border border-bark-750 px-1.5 py-0.5 rounded text-xs gap-2" id="pdf-page-controls">
                <button
                  disabled={isDualPage || currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className={`p-1 rounded transition-colors ${(!isDualPage && currentPage === 2) ? 'hover:bg-bark-700 text-sand-100 cursor-pointer' : 'text-bark-500 cursor-not-allowed'}`}
                  title={pfUiT("ui.components.instructionspdfmodal.d4d7e107cf")}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] font-mono text-sand-200 select-none">
                  {isDualPage ? 'Pages 1 - 2' : `Page ${currentPage} / 2`}
                </span>

                <button
                  disabled={isDualPage || currentPage === 2}
                  onClick={() => setCurrentPage(2)}
                  className={`p-1 rounded transition-colors ${(!isDualPage && currentPage === 1) ? 'hover:bg-bark-700 text-sand-100 cursor-pointer' : 'text-bark-500 cursor-not-allowed'}`}
                  title={pfUiT("ui.components.instructionspdfmodal.992480c67c")}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center bg-bark-800/80 border border-bark-750 p-0.5 rounded text-xs" id="pdf-zoom-controls">
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 75}
                  className={`p-1.5 rounded transition-colors ${zoom > 75 ? 'hover:bg-bark-700 text-sand-100 cursor-pointer' : 'text-bark-500 cursor-not-allowed'}`}
                  title={pfUiT("ui.components.instructionspdfmodal.fab3f57083")}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] font-mono w-11 text-center text-sand-200 select-none font-bold">
                  {zoom}%
                </span>

                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 150}
                  className={`p-1.5 rounded transition-colors ${zoom < 150 ? 'hover:bg-bark-700 text-sand-100 cursor-pointer' : 'text-bark-500 cursor-not-allowed'}`}
                  title={pfUiT("ui.components.instructionspdfmodal.d2de11d5c9")}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* View Layout Toggles (Single vs Dual Page) */}
              <div className="hidden lg:flex items-center bg-bark-800/80 border border-bark-750 p-0.5 rounded" id="pdf-layout-controls">
                <button
                  onClick={() => setIsDualPage(false)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${!isDualPage ? 'bg-clay-605 text-white font-bold' : 'text-sand-300 hover:bg-bark-700'}`}
                  title={pfUiT("ui.components.instructionspdfmodal.d99faa7753")}
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsDualPage(true)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${isDualPage ? 'bg-clay-605 text-white font-bold' : 'text-sand-300 hover:bg-bark-700'}`}
                  title={pfUiT("ui.components.instructionspdfmodal.ad3ed322b2")}
                >
                  <Columns className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* Print & Download buttons */}
            <div className="flex items-center gap-2" id="pdf-right-actions">

              {/* Print Specimen button */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className={`p-2 rounded text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  printSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-bark-800 text-sand-200 hover:bg-bark-750 hover:text-white border border-bark-750 cursor-pointer'
                }`}
                id="pdf-print-btn"
              >
                {isPrinting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : printSuccess ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{pfUiT("ui.components.instructionspdfmodal.52f91d50cf")}</span>
              </button>

              {/* Download PDF button */}
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`p-2 rounded text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  downloadSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-clay-605 text-white hover:bg-clay-705 cursor-pointer shadow-3xs'
                }`}
                id="pdf-download-btn"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : downloadSuccess ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{downloadSuccess ? 'Downloaded' : 'Download Sample'}</span>
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 rounded-full text-bark-400 hover:text-white hover:bg-bark-800 transition-colors cursor-pointer ml-1"
                title={pfUiT("ui.components.instructionspdfmodal.b29c358cc2")}
                id="pdf-close-btn"
              >
                <X className="w-4 h-4" />
              </button>

            </div>
          </div>

          {/* SIMULATED SPONTANEOUS ACTION OVERLAYS */}
          <AnimatePresence>
            {isDownloading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-bark-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-40 text-white"
              >
                <Loader2 className="w-8 h-8 text-clay-505 animate-spin" />
                <p className="text-sm font-mono font-bold tracking-wider">{pfUiT("ui.components.instructionspdfmodal.ba07c78e54")}</p>
                <p className="text-[10px] text-bark-400 font-mono">{pfUiT("ui.components.instructionspdfmodal.93a7017b18")}</p>
              </motion.div>
            )}

            {isPrinting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-bark-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-40 text-white"
              >
                <Loader2 className="w-8 h-8 text-[#ba6446] animate-spin" />
                <p className="text-sm font-mono font-bold tracking-wider">{pfUiT("ui.components.instructionspdfmodal.330b54ed02")}</p>
                <p className="text-[10px] text-bark-400 font-mono">{pfUiT("ui.components.instructionspdfmodal.2249a61e88")}</p>
              </motion.div>
            )}

            {downloadSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-md shadow-lg flex items-center gap-2 z-40"
              >
                <FileCheck className="w-4 h-4" />
                <span>Downloaded {fileName} successfully to your system!</span>
              </motion.div>
            )}

            {printSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-md shadow-lg flex items-center gap-2 z-40"
              >
                <Printer className="w-4 h-4" />
                <span>{pfUiT("ui.components.instructionspdfmodal.e387c67dfd")}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MAIN PDF WORKSPACE - SCROLLING AREA */}
          <div
            className="flex-grow p-6 sm:p-10 overflow-y-auto flex justify-center items-start bg-[#444448] select-none"
            id="pdf-scroller-workspace"
          >
            <div
              className={`flex flex-col lg:flex-row gap-8 justify-center origin-top transition-transform duration-300`}
              style={{ transform: `scale(${zoom / 100})` }}
              id="pdf-pages-viewport-wrapper"
            >

              {/* ==================== PAGE 1: SPECIFICATION & LAYOUT ==================== */}
              {(isDualPage || currentPage === 1) && (
                <div
                  className="w-[210mm] min-h-[297mm] bg-[#FDFDFC] shadow-2xl p-12 flex flex-col justify-between text-bark-900 relative border border-sand-250 select-text"
                  style={{ aspectRatio: '1/1.414' }}
                  id="pdf-page-1"
                >
                  {/* Subtle paper watermark texture */}
                  <div className="absolute inset-0 pointer-events-none border-[1.5cm] border-transparent">
                    <div className="w-full h-full border border-sand-200/50" />
                  </div>

                  {/* Document Header */}
                  <div className="space-y-4" id="p1-header">
                    <div className="flex justify-between items-start border-b-2 border-bark-900 pb-3">
                      <div>
                        <span className="text-[9px] font-mono tracking-[0.25em] font-extrabold text-clay-605 block">{pfUiT("ui.components.instructionspdfmodal.ab5b31723a")}</span>
                        <h1 className="font-serif text-3xl font-light tracking-tight text-bark-950 mt-1 uppercase">
                          {pattern.name}
                        </h1>
                        <p className="text-[10px] font-mono text-bark-500 mt-1 uppercase tracking-wider">
                          SPECIFICATION SPECIMEN SHEET • NO. {patternNum} • CATEGORY: {pattern.category}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="border border-bark-950 px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-bark-900 uppercase">
                          PAGE 1 OF 2
                        </div>
                        <span className="text-[8px] font-mono text-bark-400 mt-1">APPROVED SPECIMEN</span>
                      </div>
                    </div>

                    {/* App description and details banner */}
                    <div className="grid grid-cols-12 gap-6 pt-2">
                      <div className="col-span-8 space-y-2">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ba6446]">
                          Atelier Overview &amp; Designer Intent
                        </h3>
                        <p className="text-[11.5px] leading-relaxed text-bark-750 font-sans">
                          {pattern.description} Designed to achieve a pristine silhouette incorporating traditional Parisian finishes. Standard 3/8 in (1cm) seam allowances are integrated into all perimeter layout cuts.
                        </p>
                      </div>
                      <div className="col-span-4 bg-sand-50/50 border border-sand-200 p-3 rounded space-y-1.5 text-[10px] font-mono">
                        <div>
                          <span className="text-bark-400 uppercase tracking-wider block text-[8px]">{pfUiT("ui.components.instructionspdfmodal.52b1a8c2ed")}</span>
                          <span className="font-bold text-bark-900 block">{pattern.difficulty} Level</span>
                        </div>
                        <div className="border-t border-sand-200/60 pt-1.5">
                          <span className="text-bark-400 uppercase tracking-wider block text-[8px]">{pfUiT("ui.components.instructionspdfmodal.063835ad30")}</span>
                          <span className="font-bold text-bark-900 block">{pattern.tutorial?.duration ? `${parseInt(pattern.tutorial.duration) * 1.5} Minutes` : '4-6 Hours'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sizing & Material Specifications Grid */}
                  <div className="space-y-3 mt-6" id="p1-materials">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ba6446] border-b border-sand-200 pb-1 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5" />
                      I. Material &amp; Measurement Matrix
                    </h3>

                    <div className="grid grid-cols-12 gap-6 items-start">
                      {/* Left side: Fabrics list */}
                      <div className="col-span-5 space-y-2">
                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-bark-500">
                          Recommended Fabrics &amp; Yardage
                        </h4>
                        <div className="space-y-1.5 bg-sand-50/30 p-2.5 rounded border border-sand-200/60">
                          <ul className="text-[11px] text-bark-700 space-y-1">
                            {pattern.fabricSuggestions.slice(0, 4).map((f, idx) => (
                              <li key={idx} className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-clay-500 shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="border-t border-sand-200/50 pt-1.5 mt-2 text-[10.5px] text-bark-800">
                            <b>{pfUiT("ui.components.instructionspdfmodal.b287b99956")}</b> 60" ({pattern.yardageInfo.width60}) or 44" ({pattern.yardageInfo.width44 || '3.5 Yards'})
                          </div>
                        </div>

                        {/* List of notions */}
                        <div className="pt-1">
                          <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-bark-500 mb-1">{pfUiT("ui.components.instructionspdfmodal.01e4e8436c")}</h4>
                          <ul className="text-[10.5px] text-bark-600 space-y-0.5">
                            {(pattern.notions || [
                              'Premium sewing thread matching selected colorway',
                              '0.3 meters lightweight fusible weft insertion interfacing',
                              'Universal Microtex or fine sewing needle size 70/10'
                            ]).map((n, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-[#ba6446] font-bold">•</span>
                                <span>{n}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Right side: Sizing guide table */}
                      <div className="col-span-7">
                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-bark-500 mb-1.5">
                          Finished Garment Sizing Scale (inches)
                        </h4>
                        <div className="border border-sand-250 rounded overflow-hidden">
                          <table className="w-full text-left border-collapse text-[10px] font-sans">
                            <thead>
                              <tr className="bg-bark-900 text-sand-100 font-mono text-[9px] font-bold uppercase">
                                <th className="p-1.5 border-b border-bark-800">{pfUiT("ui.components.instructionspdfmodal.63d36933dc")}</th>
                                <th className="p-1.5 border-b border-bark-800">{pfUiT("ui.components.instructionspdfmodal.6a23afe391")}</th>
                                <th className="p-1.5 border-b border-bark-800">{pfUiT("ui.components.instructionspdfmodal.c432f3d451")}</th>
                                <th className="p-1.5 border-b border-bark-800">{pfUiT("ui.components.instructionspdfmodal.086e601b49")}</th>
                                <th className="p-1.5 border-b border-bark-800 text-right">{pfUiT("ui.components.instructionspdfmodal.3c44116387")}</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-sand-150">
                              {[
                                { sz: '4', b: '33', w: '25', h: '35', y: '2.4' },
                                { sz: '8', b: '35', w: '27', h: '37', y: '2.5' },
                                { sz: '12', b: '38', w: '30', h: '40', y: '2.8' },
                                { sz: '16', b: '42', w: '34', h: '44', y: '3.1' },
                                { sz: '20', b: '47', w: '39', h: '49', y: '3.4' }
                              ].map((row, idx) => (
                                <tr key={idx} className="hover:bg-sand-50/50">
                                  <td className="p-1.5 font-bold font-mono text-clay-700">{row.sz}</td>
                                  <td className="p-1.5 text-bark-700">{row.b}"</td>
                                  <td className="p-1.5 text-bark-700">{row.w}"</td>
                                  <td className="p-1.5 text-bark-700">{row.h}"</td>
                                  <td className="p-1.5 text-right font-mono text-bark-800">{row.y} yds</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <span className="text-[8.5px] font-mono text-bark-400 mt-1 block">
                          * Fits standard athletic &amp; relaxed postures. Ease is built into pattern drafts.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cutting Layout Plan Diagram */}
                  <div className="space-y-3 mt-6" id="p1-diagram">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ba6446] border-b border-sand-200 pb-1 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5" />
                      II. Recommended Cutting Lay Plan (Fabric 60" Wide / Double Fold)
                    </h3>

                    <div className="border border-clay-500/25 rounded-lg p-4 bg-[#FAF9F6] relative overflow-hidden flex flex-col justify-between h-48 shadow-3xs">

                      {/* Metric Ruler marks */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 border-b border-sand-300 flex justify-between px-1 text-[6.5px] font-mono text-bark-400 select-none">
                        <span>{pfUiT("ui.components.instructionspdfmodal.95db4a3967")}</span>
                        <span>{pfUiT("ui.components.instructionspdfmodal.376bbc39c0")}</span>
                        <span>{pfUiT("ui.components.instructionspdfmodal.d06da95613")}</span>
                        <span>{pfUiT("ui.components.instructionspdfmodal.04a4dac4c6")}</span>
                        <span>{pfUiT("ui.components.instructionspdfmodal.0c689cb5f2")}</span>
                        <span>{pfUiT("ui.components.instructionspdfmodal.30e3445f9d")}</span>
                        <span>{pfUiT("ui.components.instructionspdfmodal.537266b71f")}</span>
                      </div>

                      {/* Side labels representing selvage */}
                      <div className="absolute left-1 top-4 bottom-4 w-1 border-r border-dashed border-clay-500/35" />
                      <div className="absolute right-1 top-4 bottom-4 w-1 border-l border-dashed border-clay-500/35" />

                      {/* Layout container */}
                      <div className="relative w-full h-full mt-2.5" id="fabric-blueprint-lay">
                        {/* Selvage indicators */}
                        <div className="absolute top-0 right-0 text-[6.5px] font-mono text-[#ba6446]/40 uppercase tracking-widest font-extrabold rotate-90 origin-right mr-1">{pfUiT("ui.components.instructionspdfmodal.55e9aa062e")}</div>
                        <div className="absolute bottom-0 left-1 text-[6.5px] font-mono text-[#ba6446]/40 uppercase tracking-widest font-extrabold">
                          Fold Line (Place Pieces with grain parallel)
                        </div>

                        {/* Interactive Vector Pattern Blocks */}
                        {pieces.map((piece, idx) => (
                          <div
                            key={idx}
                            className={`absolute ${piece.size} ${piece.x} border border-dashed border-[#ba6446] bg-white hover:bg-clay-50/50 rounded flex flex-col items-center justify-center p-1 shadow-3xs transition-all`}
                          >
                            <span className="text-[9px] font-serif font-bold text-bark-900 tracking-tight leading-tight block text-center">
                              {piece.name}
                            </span>
                            <span className="text-[7.5px] font-mono text-clay-700 leading-none mt-0.5 font-semibold block text-center uppercase">
                              {piece.count}
                            </span>

                            {/* Directional arrow representing grainline */}
                            <div className="w-full flex items-center justify-center gap-1 px-1.5 mt-1 opacity-60">
                              <div className="h-[1px] bg-bark-400 flex-grow" />
                              <span className="text-[6.5px] font-mono text-bark-400">GRAINLINE</span>
                              <div className="h-[1px] bg-bark-400 flex-grow" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Document Footer info */}
                  <div className="border-t border-sand-200 pt-3 flex justify-between items-center text-[8.5px] font-mono text-bark-400 mt-8" id="p1-footer">
                    <span>{pfUiT("ui.components.instructionspdfmodal.5b5765e72e")}</span>
                    <span className="font-bold text-clay-605">{pfUiT("ui.components.instructionspdfmodal.5abdc1330e")}</span>
                    <span>{pfUiT("ui.components.instructionspdfmodal.0a602b99e5")}</span>
                  </div>

                </div>
              )}

              {/* ==================== PAGE 2: ASSEMBLY SEQUENCE ==================== */}
              {(isDualPage || currentPage === 2) && (
                <div
                  className="w-[210mm] min-h-[297mm] bg-[#FDFDFC] shadow-2xl p-12 flex flex-col justify-between text-bark-900 relative border border-sand-250 select-text"
                  style={{ aspectRatio: '1/1.414' }}
                  id="pdf-page-2"
                >
                  {/* Subtle paper watermark texture */}
                  <div className="absolute inset-0 pointer-events-none border-[1.5cm] border-transparent">
                    <div className="w-full h-full border border-sand-200/50" />
                  </div>

                  {/* Document Header */}
                  <div className="space-y-4" id="p2-header">
                    <div className="flex justify-between items-start border-b-2 border-bark-900 pb-3">
                      <div>
                        <span className="text-[9px] font-mono tracking-[0.25em] font-extrabold text-clay-605 block">{pfUiT("ui.components.instructionspdfmodal.ab5b31723a")}</span>
                        <h1 className="font-serif text-3xl font-light tracking-tight text-bark-950 mt-1 uppercase">
                          {pattern.name} Instructions
                        </h1>
                        <p className="text-[10px] font-mono text-bark-500 mt-1 uppercase tracking-wider">{pfUiT("ui.components.instructionspdfmodal.67c8d19c61")}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="border border-bark-950 px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-bark-900 uppercase">
                          PAGE 2 OF 2
                        </div>
                        <span className="text-[8px] font-mono text-bark-400 mt-1">COUTURE BLUEPRINT</span>
                      </div>
                    </div>
                  </div>

                  {/* Sewing Steps List */}
                  <div className="space-y-4 mt-6 flex-grow" id="p2-steps">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ba6446] border-b border-sand-200 pb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />{pfUiT("ui.components.instructionspdfmodal.036b46bb07")}</h3>

                    <div className="space-y-4">
                      {sewingSteps.map((step, idx) => (
                        <div key={idx} className="flex gap-4 items-start text-xs" id={`pdf-step-${step.num}`}>
                          <div className="bg-bark-900 text-sand-50 font-mono font-bold text-xs p-1 px-1.5 rounded flex-shrink-0">
                            {step.num}
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-mono font-bold uppercase text-bark-900 tracking-wide text-[10.5px]">
                              {step.title}
                            </h4>
                            <p className="text-bark-700 leading-relaxed font-sans text-[11px]">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pro Tips Section */}
                  <div className="bg-amber-50/50 border border-amber-200/50 p-3.5 rounded-md space-y-1.5 mt-6" id="p2-pro-tips">
                    <div className="flex items-center gap-1 text-xs font-bold font-mono text-amber-800 uppercase tracking-wider">
                      <Info className="w-4 h-4 text-amber-700" />{pfUiT("ui.components.instructionspdfmodal.511128844b")}</div>
                    <ul className="text-[10.5px] text-bark-750 font-sans space-y-1">
                      {pattern.tutorial?.tips?.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-700 mt-0.5">•</span>
                          <span>{tip}</span>
                        </li>
                      )) || (
                        <>
                          <li className="flex items-start gap-1.5">
                            <span className="text-amber-700 mt-0.5">•</span>
                            <span>{pfUiT("ui.components.instructionspdfmodal.9946713355")}</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-amber-700 mt-0.5">•</span>
                            <span>{pfUiT("ui.components.instructionspdfmodal.71b70b90c4")}</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Document Footer info */}
                  <div className="border-t border-sand-200 pt-3 flex justify-between items-center text-[8.5px] font-mono text-bark-400 mt-8" id="p2-footer">
                    <span>{pfUiT("ui.components.instructionspdfmodal.5b5765e72e")}</span>
                    <span className="font-bold text-clay-605">{pfUiT("ui.components.instructionspdfmodal.5abdc1330e")}</span>
                    <span>{pfUiT("ui.components.instructionspdfmodal.0a602b99e5")}</span>
                  </div>

                </div>
              )}

            </div>
          </div>

          {/* BOTTOM UTILITY FOOTER */}
          <div className="bg-sand-200 border-t border-sand-250/70 text-bark-600 px-4 py-2 flex items-center justify-between text-[10px] font-mono flex-shrink-0" id="pdf-footer-utility">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-[#ba6446]" />
              <span>{pfUiT("ui.components.instructionspdfmodal.762fd42abe")}</span>
            </span>
            <span>{pfUiT("ui.components.instructionspdfmodal.b0deb735f8")}<span className="font-bold text-bark-900">{pattern.id}</span>
            </span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
