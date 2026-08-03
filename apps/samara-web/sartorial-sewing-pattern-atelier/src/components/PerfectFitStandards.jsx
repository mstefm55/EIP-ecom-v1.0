import React from 'react';
import { motion } from 'motion/react';

export default function PerfectFitStandards() {
  return (
    <section className="bg-white rounded-[4px] border border-sand-200 p-8 md:p-12 space-y-10 shadow-lux relative overflow-hidden" id="perfect-fit-specification-guide">
      {/* Blueprint drafting grids behind header */}
      <div className="absolute right-0 top-0 w-64 h-64 opacity-[0.03] bg-[radial-gradient(#887857_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
      <div className="absolute left-0 bottom-0 w-64 h-64 opacity-[0.03] bg-[radial-gradient(#887857_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto space-y-3 relative z-10"
        id="handguide-header"
      >
        <h2 className="text-3xl md:text-4xl font-serif text-bark-950 font-light leading-[1.12]" id="handguide-title">
          How Perfect Fit Patterns are Assembled
        </h2>
        <p className="text-xs sm:text-sm text-bark-550 leading-relaxed font-sans max-w-lg mx-auto" id="handguide-text">
          We design modern blueprints accompanied by pristine illustration booklets to ensure your construct results in a glorious wearable masterpiece.
        </p>
      </motion.div>

      {/* Bento-style specification grid with luxurious transitions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10" id="bento-grid">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(186, 100, 70, 0.45)" }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="p-8 bg-sand-50/20 border border-sand-200/80 rounded-[4px] space-y-4 hover:bg-white hover:shadow-lux transition-all duration-300 group cursor-pointer flex flex-col justify-between"
          id="bento-1"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-[4px] bg-bark-900 text-sand-50 flex items-center justify-center font-mono text-xs font-semibold group-hover:bg-clay-605 transition-colors duration-300" id="bento-icon-1">
              01
            </div>
            <h4 className="font-serif font-semibold text-bark-900 text-lg group-hover:text-clay-605 transition-colors">Select &amp; Download File</h4>
            <p className="text-xs text-bark-600 leading-relaxed font-sans">
              Pick either Digital PDF (instant mailing layout containing A0 Copyshop, A4/US Letter layouts) or physical robust Cream Silk tissue paper sheets mailed in signature cardboard catalog files.
            </p>
          </div>
          <div className="pt-2 border-t border-sand-150/40 text-[10px] font-mono text-clay-700 font-bold tracking-wider uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Download blueprints <span>→</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(186, 100, 70, 0.45)" }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="p-8 bg-sand-50/20 border border-sand-200/80 rounded-[4px] space-y-4 hover:bg-white hover:shadow-lux transition-all duration-300 group cursor-pointer flex flex-col justify-between"
          id="bento-2"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-[4px] bg-bark-900 text-sand-50 flex items-center justify-center font-mono text-xs font-semibold group-hover:bg-clay-605 transition-colors duration-300" id="bento-icon-2">
              02
            </div>
            <h4 className="font-serif font-semibold text-bark-900 text-lg group-hover:text-clay-605 transition-colors">Measure &amp; Cut Outline</h4>
            <p className="text-xs text-bark-600 leading-relaxed font-sans">
              Enter your exact chest/waist/hip metrics on our dynamic sizing calculator page to find your line. Easily draw custom slashes using the designated shortening/lengthening marks pre-drawn.
            </p>
          </div>
          <div className="pt-2 border-t border-sand-150/40 text-[10px] font-mono text-clay-700 font-bold tracking-wider uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Calculate proportions <span>→</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(186, 100, 70, 0.45)" }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="p-8 bg-sand-50/20 border border-sand-200/80 rounded-[4px] space-y-4 hover:bg-white hover:shadow-lux transition-all duration-300 group cursor-pointer flex flex-col justify-between"
          id="bento-3"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-[4px] bg-bark-900 text-sand-50 flex items-center justify-center font-mono text-xs font-semibold group-hover:bg-clay-605 transition-colors duration-300" id="bento-icon-3">
              03
            </div>
            <h4 className="font-serif font-semibold text-bark-900 text-lg group-hover:text-clay-605 transition-colors">Bespoke Construction</h4>
            <p className="text-xs text-bark-600 leading-relaxed font-sans">
              Follow our step-by-step assembly diagrams. Standard sewing blueprints are paired with advice regarding custom bias binders, pocket installations, buttonhole setups, and perfect French lining seams.
            </p>
          </div>
          <div className="pt-2 border-t border-sand-150/40 text-[10px] font-mono text-clay-700 font-bold tracking-wider uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Inspect finishes <span>→</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
