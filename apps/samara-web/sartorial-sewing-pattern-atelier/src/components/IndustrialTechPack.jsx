import React, { useState } from 'react';
import {
  Building2,
  Layers,
  Settings2,
  TrendingUp,
  Clock,
  Calculator,
  Database,
  Coins,
  Truck,
  Sliders,
  Shuffle,
  CheckCircle,
  Scale,
  Cpu,
  Bookmark,
  Info
} from 'lucide-react';

export default function IndustrialTechPack({ pattern }) {
  const [batchSize, setBatchSize] = useState(100);
  const [customBatch, setCustomBatch] = useState('');
  const [efficiency, setEfficiency] = useState(85); // % line efficiency
  const [activeSubTab, setActiveSubTab] = useState('bom-boq'); // 'bom-boq' | 'routing' | 'throughput'

  // Standard material specifications mapping
  const getIndustrialData = () => {
    switch (pattern.id) {
      case 'sartorial-01': // Aurelia Wrap Dress
        return {
          sam: 28.5,
          complexity: 'Medium-High',
          stitchClass: 'Stitch Class 504 (Overlock) & 301 (Lockstitch)',
          bom: [
            { id: 'mat-1', name: 'Primary: European Flax Linen (Washed)', spec: '185 GSM, 100% Linen, Yarn Count 14s', wasteFactor: 1.10, baseQty: 3.0, unit: 'm', cost: 14.50, supplier: 'Belgian Linen Guild' },
            { id: 'mat-2', name: 'Interfacing: Weft-Insertion Fusible', spec: 'Lightweight poly-viscose knit, 40 GSM', wasteFactor: 1.05, baseQty: 0.5, unit: 'm', cost: 3.20, supplier: 'Freudenberg Vlieseline' },
            { id: 'mat-3', name: 'Notion: Interior Flat Anchor Button', spec: '15mm, 4-hole urea composite, matte', wasteFactor: 1.02, baseQty: 1, unit: 'pc', cost: 0.35, supplier: 'YKK Fasteners' },
            { id: 'mat-4', name: 'Thread: Core-Spun Poly (Astra/Epic)', spec: 'Tex 27, 3-ply high-tenacity, matching dye', wasteFactor: 1.15, baseQty: 120, unit: 'm', cost: 0.02, supplier: 'Coats Thread' },
            { id: 'mat-5', name: 'Perfect Fit Woven Main Label', spec: 'Damask satin, 45mm x 25mm, hot cut', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.22, supplier: 'Avery Dennison' },
            { id: 'mat-6', name: 'Printed Nylon Care/Size Label', spec: 'Soft nylon taffeta, dual-fold print', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.08, supplier: 'Avery Dennison' }
          ],
          routing: [
            { step: '01', op: 'Fuse Front Facings & Waistline Stabilizers', machine: 'Industrial Continuous Fusing Press', sam: 1.8, rate: 0.35 },
            { step: '02', op: 'Staystitch Front Neckline & Armholes', machine: 'Single Needle Lockstitch (Class 301)', sam: 1.5, rate: 0.28 },
            { step: '03', op: 'Stitch Bust Darts (Lock-Stitched & Backtacked)', machine: 'Single Needle Lockstitch (Class 301)', sam: 2.2, rate: 0.40 },
            { step: '04', op: 'Construct & Turn Waist Belt Ties', machine: 'Single Needle Lockstitch + Turning Rod', sam: 3.0, rate: 0.55 },
            { step: '05', op: 'Stitch Back Bodice Center Seam & Press', machine: '3-Thread Overlock (Class 504) + SNLS', sam: 2.8, rate: 0.50 },
            { step: '06', op: 'Assemble In-Seam Pockets to Skirt Panels', machine: 'SNLS + 3-Thread Overlock Safety Seam', sam: 4.5, rate: 0.85 },
            { step: '07', op: 'Assemble Shoulders & Sides with French Seams', machine: 'Single Needle Lockstitch (Class 301) Precision', sam: 6.2, rate: 1.20 },
            { step: '08', op: 'Join Bodice Waistline to Skirt with Reinforcement', machine: '4-Thread Safety Stitch (Class 514)', sam: 3.5, rate: 0.65 },
            { step: '09', op: 'Double Rolled Baby Hem (Skirt Rim & Sleeves)', machine: 'Single Needle Lockstitch + Hemmer Foot', sam: 4.8, rate: 0.90 },
            { step: '10', op: 'Trimming, final thread QC inspection & Pressing', machine: 'Industrial Steam Utility Table + Clapper', sam: 2.7, rate: 0.50 }
          ]
        };
      case 'sartorial-02': // Atelier Utility Trench
        return {
          sam: 52.0,
          complexity: 'High (Advanced)',
          stitchClass: 'Heavy Duty 301 Lockstitch & Class 401 Chainstitch',
          bom: [
            { id: 'mat-1', name: 'Primary: Cotton Gabardine Twill', spec: '290 GSM, Water-repellent, long-staple cotton', wasteFactor: 1.12, baseQty: 3.5, unit: 'm', cost: 18.00, supplier: 'Halley Stevensons' },
            { id: 'mat-2', name: 'Lining: Premium Viscose Jacquard', spec: '85 GSM, anti-static breathable weave', wasteFactor: 1.10, baseQty: 2.0, unit: 'm', cost: 7.50, supplier: 'Bemberg Lining' },
            { id: 'mat-3', name: 'Interfacing: Heavy Woven Fusible', spec: 'Trubenized resin, 90 GSM wool-blend woven', wasteFactor: 1.08, baseQty: 1.2, unit: 'm', cost: 4.80, supplier: 'Lainiere de Picardie' },
            { id: 'mat-4', name: 'Notion: Premium Horn Buttons', spec: '22mm diameter, genuine laser-etched horn', wasteFactor: 1.03, baseQty: 10, unit: 'pcs', cost: 1.80, supplier: 'Gritti Group' },
            { id: 'mat-5', name: 'Notion: Buckles & Antique Brass D-Rings', spec: '40mm cast-brass slide buckles (set of 3)', wasteFactor: 1.01, baseQty: 1, unit: 'set', cost: 4.50, supplier: 'Riri Group' },
            { id: 'mat-6', name: 'Thread: Coarse Topstitching & Core-Spun', spec: 'Tex 40 (stitching) & Tex 60 (topstitching)', wasteFactor: 1.18, baseQty: 250, unit: 'm', cost: 0.03, supplier: 'Coats Thread' },
            { id: 'mat-7', name: 'Perfect Fit Woven Main Label', spec: 'Damask satin, 45mm x 25mm, hot cut', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.22, supplier: 'Avery Dennison' },
            { id: 'mat-8', name: 'Printed Nylon Care/Size Label', spec: 'Soft nylon taffeta, dual-fold print', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.08, supplier: 'Avery Dennison' }
          ],
          routing: [
            { step: '01', op: 'Fuse Front Panels, Collar Stands, and Sleeve Cuffs', machine: 'Industrial Continuous Fusing Press', sam: 3.5, rate: 0.65 },
            { step: '02', op: 'Assemble Epaulettes, Sleeve Tabs, and Belt Carriers', machine: 'Single Needle Lockstitch (Class 301) + Crease', sam: 4.8, rate: 0.90 },
            { step: '03', op: 'Prepare & Stitch Back Storm Shield with Overhangs', machine: 'SNLS + Multi-needle Topstitching', sam: 5.5, rate: 1.00 },
            { step: '04', op: 'Construct Front Double Welt Pockets with Facing Flaps', machine: 'Automatic Pocket Welter Machine (Class 301)', sam: 9.5, rate: 1.80 },
            { step: '05', op: 'Assemble & Attach Double-Breasted Collar & Stand', machine: 'SNLS + Precision Edge-Stitch', sam: 7.2, rate: 1.40 },
            { step: '06', op: 'Join Side & Shoulder Seams (Flat-Felled Finishes)', machine: 'Feed-off-the-Arm Twin Needle Chainstitch (401)', sam: 6.8, rate: 1.30 },
            { step: '07', op: 'Construct & Set Two-Piece Raglan Sleeves', machine: 'SNLS + Easing Feed Assembly', sam: 5.8, rate: 1.10 },
            { step: '08', op: 'Machine Sew Keyhole Buttonholes (Front & Cuffs)', machine: 'Automatic Eyelet Keyhole Buttonholer', sam: 4.2, rate: 0.85 },
            { step: '09', op: 'Attach Horn Buttons with Counter-Buttons & Shank', machine: 'Button Sewer with Thread Wrapper (Shank)', sam: 3.0, rate: 0.60 },
            { step: '10', op: 'Stitch Bottom Hem with Clean Facings', machine: 'Single Needle Lockstitch (Class 301)', sam: 4.2, rate: 0.80 },
            { step: '11', op: 'Final Hand QC Inspection, Pressing & Boarding', machine: 'Industrial Cabinet Form Press + Vacuum', sam: 4.5, rate: 0.90 }
          ]
        };
      case 'sartorial-03': // Palazzo Wide-Leg Trouser
        return {
          sam: 34.2,
          complexity: 'Medium',
          stitchClass: 'Stitch Class 504 (Overlock) & 301 (Lockstitch)',
          bom: [
            { id: 'mat-1', name: 'Primary: Fine Merino Wool Suiting', spec: '240 GSM, 100% Super 110s Wool, twill weave', wasteFactor: 1.08, baseQty: 2.2, unit: 'm', cost: 22.50, supplier: 'Vitale Barberis Canonico' },
            { id: 'mat-2', name: 'Pocketing: Solid Cotton Lawn Lining', spec: '75 GSM, 100% Cotton combed lawn', wasteFactor: 1.05, baseQty: 0.4, unit: 'm', cost: 3.50, supplier: 'Perfect Fit Mill Stock' },
            { id: 'mat-3', name: 'Interfacing: Structured Ban-Rol Waistband', spec: 'Non-roll stiff woven waistband stabilizer, 80mm', wasteFactor: 1.02, baseQty: 1.0, unit: 'm', cost: 1.85, supplier: 'Ban-Rol Inc.' },
            { id: 'mat-4', name: 'Notion: Metal Fly Zipper #4', spec: 'YKK brass zipper with locking slider, 7" length', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.95, supplier: 'YKK Fasteners' },
            { id: 'mat-5', name: 'Notion: Heavy-Duty Waistband Hook & Eye', spec: 'Stamped steel, nickel-plated double set', wasteFactor: 1.01, baseQty: 1, unit: 'set', cost: 0.40, supplier: 'Prym Industrial' },
            { id: 'mat-6', name: 'Thread: Core-Spun Poly (Astra/Epic)', spec: 'Tex 30, high tensile strength core-spun poly', wasteFactor: 1.12, baseQty: 140, unit: 'm', cost: 0.02, supplier: 'Coats Thread' },
            { id: 'mat-7', name: 'Perfect Fit Woven Main Label', spec: 'Damask satin, 45mm x 25mm, hot cut', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.22, supplier: 'Avery Dennison' },
            { id: 'mat-8', name: 'Printed Nylon Care/Size Label', spec: 'Soft nylon taffeta, dual-fold print', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.08, supplier: 'Avery Dennison' }
          ],
          routing: [
            { step: '01', op: 'Overlock Seam Edges of all Leg Panels', machine: '3-Thread Overlock Edge-Serger (Class 504)', sam: 3.8, rate: 0.70 },
            { step: '02', op: 'Sew Front Architectural Pleats & Back Waist Darts', machine: 'Single Needle Lockstitch (Class 301)', sam: 2.8, rate: 0.50 },
            { step: '03', op: 'Assemble & Topstitch Front Slant Side Pockets', machine: 'SNLS + Crease-press pocket facings', sam: 5.2, rate: 1.00 },
            { step: '04', op: 'Stitch and Set Back Double Welt Pockets', machine: 'Automatic Welter Machine + Pocket Bag Attachment', sam: 6.8, rate: 1.30 },
            { step: '05', op: 'Assemble Left/Right Outseams and Inseams', machine: 'Double Needle Lockstitch with edge-guide', sam: 4.2, rate: 0.80 },
            { step: '06', op: 'Assemble and Stitch Front Crotch Fly Zipper', machine: 'SNLS + Precision zip-tape fold shield', sam: 4.8, rate: 0.90 },
            { step: '07', op: 'Construct Waistband with Interfaced Ban-Rol Core', machine: 'Waistband Folder Attachment + Twin Needle LS', sam: 3.5, rate: 0.65 },
            { step: '08', op: 'Stitch waistband ends & Attach Hook and Eye', machine: 'Specialized pneumatic riveter press', sam: 1.5, rate: 0.30 },
            { step: '09', op: 'Blindstitch Bottom Leg Hems', machine: 'Single Thread Industrial Blindstitch Machine', sam: 2.6, rate: 0.50 },
            { step: '10', op: 'Final Crease Pressing, Threadd QC & Tagging', machine: 'Industrial Pants Leg Creaser Press + Vacuum', sam: 3.2, rate: 0.60 }
          ]
        };
      default: // Luminary Drape Blouse & generic
        return {
          sam: 18.2,
          complexity: 'Low-Medium',
          stitchClass: 'Stitch Class 503 (Overedge) & Class 301 (Lockstitch)',
          bom: [
            { id: 'mat-1', name: 'Primary: Silk Crepe de Chine', spec: '16 Momme, 100% Mulberry Silk, sandwashed', wasteFactor: 1.15, baseQty: 2.0, unit: 'm', cost: 26.00, supplier: 'Shengzhou Silk Mills' },
            { id: 'mat-2', name: 'Interfacing: Fine Knit Fusible Strip', spec: 'Knit tricot polyamide stretch, 20 GSM', wasteFactor: 1.05, baseQty: 0.2, unit: 'm', cost: 1.50, supplier: 'Freudenberg Vlieseline' },
            { id: 'mat-3', name: 'Thread: fine spun polyester', spec: 'Tex 16 (Ticket 180) micro-fine garment thread', wasteFactor: 1.10, baseQty: 80, unit: 'm', cost: 0.02, supplier: 'Gütermann Industrial' },
            { id: 'mat-4', name: 'Perfect Fit Woven Main Label', spec: 'Damask satin, 45mm x 25mm, hot cut', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.22, supplier: 'Avery Dennison' },
            { id: 'mat-5', name: 'Printed Nylon Care/Size Label', spec: 'Soft nylon taffeta, dual-fold print', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.08, supplier: 'Avery Dennison' }
          ],
          routing: [
            { step: '01', op: 'Fuse Neckline Curves and Bias Stay-tape strips', machine: 'Industrial Fusing Machine (Mini)', sam: 1.2, rate: 0.25 },
            { step: '02', op: 'Stitch & Secure Asymmetrical Neckline Gather Pleats', machine: 'Single Needle Lockstitch (Class 301) + Gather', sam: 2.8, rate: 0.55 },
            { step: '03', op: 'Assemble Side Seams and Shoulders (Micro-French)', machine: 'Single Needle Lockstitch + micro-trimmer foot', sam: 5.5, rate: 1.05 },
            { step: '04', op: 'Bias Bind Armholes & Finished Neck Facings', machine: 'SNLS + Bias Binder Attachment', sam: 4.2, rate: 0.80 },
            { step: '05', op: 'Machine Stitch Rolled Bottom Micro-Hem', machine: 'SNLS + Rolled Hemming Folder Foot (2mm)', sam: 2.8, rate: 0.55 },
            { step: '06', op: 'Steaming, Thread Trimming, QC Bagging & Tagging', machine: 'Industrial Hand Steam Iron + Soft form hanger', sam: 1.7, rate: 0.35 }
          ]
        };
    }
  };

  const indData = getIndustrialData();

  // Dynamic calculations based on batch size
  // Scale quantity with safety curves (bulk purchase has better yield / less waste)
  const getEfficiencyFactor = (qty) => {
    if (qty <= 1) return 1.25; // Proto sampling waste (+25%)
    if (qty <= 12) return 1.15; // Small size set (+15%)
    if (qty <= 100) return 1.08; // Production run (+8%)
    return 1.04; // Bulk optimized run (+4%)
  };

  const currentWastageCurve = getEfficiencyFactor(batchSize);

  // BOM & BOQ Calculation
  const scaledBom = indData.bom.map(item => {
    const isPiece = item.unit === 'pc' || item.unit === 'pcs' || item.unit === 'set';
    let rawQty;
    if (isPiece) {
      // Buttons, labels cannot have partial values, but add spares for waste
      rawQty = Math.ceil(item.baseQty * batchSize * item.wasteFactor * (currentWastageCurve - 0.02));
    } else {
      rawQty = parseFloat((item.baseQty * batchSize * item.wasteFactor * (currentWastageCurve - 0.02)).toFixed(2));
    }
    const unitCost = item.cost;
    const totalCost = parseFloat((rawQty * unitCost).toFixed(2));
    return {
      ...item,
      totalQty: rawQty,
      totalCost
    };
  });

  const totalBomCost = scaledBom.reduce((sum, item) => sum + item.totalCost, 0);
  const perUnitMaterialCost = parseFloat((totalBomCost / batchSize).toFixed(2));

  // Labor Rate calculations
  const avgLaborMinuteRate = 0.32; // $0.32 per minute base labor
  const totalRoutingMinutes = indData.routing.reduce((sum, r) => sum + r.sam, 0);
  const totalSAMMinutes = parseFloat(totalRoutingMinutes.toFixed(1));

  // Real allowed minutes for whole batch accounting for plant efficiency
  const efficiencyMultiplier = 100 / efficiency;
  const batchRequiredMinutes = parseFloat((totalSAMMinutes * batchSize * efficiencyMultiplier).toFixed(0));
  const batchRequiredHours = parseFloat((batchRequiredMinutes / 60).toFixed(1));

  const estimatedLaborCostPerUnit = parseFloat((totalSAMMinutes * avgLaborMinuteRate * efficiencyMultiplier).toFixed(2));
  const estimatedBatchLaborCost = parseFloat((estimatedLaborCostPerUnit * batchSize).toFixed(2));

  const totalBatchIndustrialCost = totalBomCost + estimatedBatchLaborCost;
  const targetFobFactoryPrice = parseFloat(((totalBatchIndustrialCost / batchSize) * 1.35).toFixed(2)); // FOB Factory cost with 35% margin

  const handleQuickQuantity = (qty) => {
    setBatchSize(qty);
    setCustomBatch('');
  };

  const handleCustomBatchChange = (e) => {
    const val = e.target.value;
    setCustomBatch(val);
    const parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
      setBatchSize(parsed);
    }
  };

  return (
    <div className="bg-white border border-sand-200/80 rounded-[4px] p-4 space-y-4" id="industrial-tech-pack">

      {/* Industrial Header Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-sand-150 pb-3" id="tech-pack-header">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono tracking-widest font-bold bg-bark-900 text-sand-50 px-2 py-0.5 rounded uppercase">
              Industrial Grade Specs
            </span>
            <span className="text-[9px] font-mono text-clay-605 font-extrabold uppercase animate-pulse">
              • ERP Feed Active
            </span>
          </div>
          <h3 className="font-serif text-bark-950 font-bold text-base mt-1">
            Production Specification &amp; Routing Tech Pack
          </h3>
          <p className="text-[11px] text-bark-500 font-sans mt-0.5 leading-normal">
            Precision engineering specs, industrial bill of materials, and production-line assembly times optimized for apparel manufacturing and commercial procurement.
          </p>
        </div>

        {/* Main Stats Panel */}
        <div className="grid grid-cols-2 gap-4 bg-sand-50/60 border border-sand-200/60 rounded p-2.5 min-w-[180px]" id="sam-quick-panel">
          <div>
            <span className="text-[8px] font-mono text-bark-400 block uppercase font-bold tracking-wider">Garment SAM</span>
            <span className="font-mono text-sm font-extrabold text-[#ba6446]">{totalSAMMinutes} Min</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-bark-400 block uppercase font-bold tracking-wider">Sewing Class</span>
            <span className="text-[10px] font-bold text-bark-900 truncate block mt-0.5" title={indData.stitchClass}>
              {indData.complexity}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION: Batch and Configurator Slider */}
      <div className="bg-sand-50/50 border border-sand-200/70 p-3.5 rounded-lg space-y-3.5" id="batch-configurator">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-bark-800 uppercase tracking-wide">
            <Sliders className="w-4 h-4 text-[#ba6446]" />
            1. Production Batch Configurator
          </div>

          {/* Quick choice buttons */}
          <div className="flex gap-1 flex-wrap" id="quick-qty-selectors">
            {[1, 12, 100, 500].map((qty) => (
              <button
                key={qty}
                onClick={() => handleQuickQuantity(qty)}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold border transition-all cursor-pointer rounded-sm ${
                  batchSize === qty && customBatch === ''
                    ? 'bg-[#ba6446] border-[#ba6446] text-white shadow-2xs'
                    : 'bg-white border-sand-200 text-bark-700 hover:bg-sand-100/50'
                }`}
                type="button"
              >
                {qty === 1 ? '1 (Proto)' : qty === 12 ? '12 (Size Set)' : qty === 100 ? '100 (SMR)' : '500 (Bulk)'}
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                placeholder="Custom..."
                value={customBatch}
                onChange={handleCustomBatchChange}
                className="w-20 px-2 py-1 text-[10px] font-mono font-bold bg-white border border-sand-200 rounded-sm focus:outline-none focus:border-[#ba6446] text-center"
              />
            </div>
          </div>
        </div>

        {/* Sliders and Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-1.5">
          {/* Slider Left */}
          <div className="md:col-span-8 space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-bark-700">
                <span>Active Target Quantity: <b>{batchSize} units</b></span>
                <span className="text-clay-605 font-bold">Wastage Curve: {(currentWastageCurve * 100 - 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="1000"
                value={batchSize}
                onChange={(e) => {
                  setBatchSize(parseInt(e.target.value));
                  setCustomBatch('');
                }}
                className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-[#ba6446]"
                id="batch-size-range-slider"
              />
            </div>

            {/* Line Efficiency Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-bark-700">
                <span>Production Line Target Efficiency: <b>{efficiency}%</b></span>
                <span className="text-bark-500">Standard Allowed Minutes (SAM)</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={efficiency}
                onChange={(e) => setEfficiency(parseInt(e.target.value))}
                className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-600"
                id="efficiency-range-slider"
              />
            </div>
          </div>

          {/* Metric calculations Right */}
          <div className="md:col-span-4 bg-white border border-sand-200 p-3 rounded space-y-2 text-[10.5px] font-mono">
            <div className="flex justify-between">
              <span className="text-bark-450 uppercase font-bold">Total SAM required:</span>
              <span className="font-extrabold text-bark-900">{(totalSAMMinutes * batchSize).toLocaleString()}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bark-450 uppercase font-bold">At Efficiency Adjusted:</span>
              <span className="font-extrabold text-clay-605">{batchRequiredMinutes.toLocaleString()}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bark-450 uppercase font-bold font-semibold">Total Line Hours:</span>
              <span className="font-extrabold text-bark-900">{batchRequiredHours} Hrs</span>
            </div>
            <div className="border-t border-sand-150 pt-2 flex justify-between text-[11px] font-bold">
              <span className="text-[#ba6446] uppercase">Est. Batch Cost:</span>
              <span>${totalBatchIndustrialCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SUB TAB BAR Navigation */}
      <div className="flex border-b border-sand-200 gap-4" id="tech-pack-subtabs-nav">
        <button
          onClick={() => setActiveSubTab('bom-boq')}
          className={`pb-1.5 text-[11px] font-mono font-bold uppercase tracking-wider relative transition-colors cursor-pointer ${
            activeSubTab === 'bom-boq' ? 'text-[#ba6446] border-b-2 border-[#ba6446]' : 'text-bark-450 hover:text-bark-750'
          }`}
          type="button"
        >
          Bill of Materials (BOM) &amp; BOQ
        </button>
        <button
          onClick={() => setActiveSubTab('routing')}
          className={`pb-1.5 text-[11px] font-mono font-bold uppercase tracking-wider relative transition-colors cursor-pointer ${
            activeSubTab === 'routing' ? 'text-[#ba6446] border-b-2 border-[#ba6446]' : 'text-bark-450 hover:text-bark-750'
          }`}
          type="button"
        >
          Manufacturing Routing sequence
        </button>
        <button
          onClick={() => setActiveSubTab('throughput')}
          className={`pb-1.5 text-[11px] font-mono font-bold uppercase tracking-wider relative transition-colors cursor-pointer ${
            activeSubTab === 'throughput' ? 'text-[#ba6446] border-b-2 border-[#ba6446]' : 'text-bark-450 hover:text-bark-750'
          }`}
          type="button"
        >
          Procurement &amp; Plant Throughput
        </button>
      </div>

      {/* SUB-TABS INTERACTIVE VIEWPORT */}
      <div className="min-h-[220px]" id="tech-pack-subtabs-viewport">

        {/* SUB TAB A: BOM & BOQ */}
        {activeSubTab === 'bom-boq' && (
          <div className="space-y-3" id="subtab-bom-boq">
            <div className="flex items-center justify-between text-xs text-bark-500 font-mono" id="bom-boq-disclaimer">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-bark-450" />
                <span>Standardized material spec codes linked with direct suppliers.</span>
              </div>
              <span>Batch Size: <b className="text-bark-900">{batchSize} Pcs</b></span>
            </div>

            <div className="border border-sand-200 rounded overflow-hidden shadow-3xs">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-sand-100 text-bark-500 font-mono text-[9px] uppercase tracking-wider border-b border-sand-200">
                    <th className="p-2">Material / Spec</th>
                    <th className="p-2">Supplier Network</th>
                    <th className="p-2 text-right">Spec Qty / Pc</th>
                    <th className="p-2 text-right text-clay-605">Total Qty (BOQ)</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right font-bold text-bark-900">Total Material Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sand-150 font-sans">
                  {scaledBom.map((item) => (
                    <tr key={item.id} className="hover:bg-sand-50/50 transition-colors">
                      <td className="p-2">
                        <div className="font-bold text-bark-900">{item.name}</div>
                        <div className="text-[9px] text-bark-450 font-mono">{item.spec}</div>
                      </td>
                      <td className="p-2 text-bark-600 font-mono text-[9.5px]">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3 text-[#ba6446]/60" />
                          {item.supplier}
                        </span>
                      </td>
                      <td className="p-2 text-right text-bark-600 font-mono">
                        {item.baseQty} {item.unit}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-clay-705">
                        {item.totalQty.toLocaleString()} {item.unit}
                      </td>
                      <td className="p-2 text-right text-bark-600 font-mono">
                        ${item.cost.toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-bark-900">
                        ${item.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-sand-50/50 font-mono text-[11px] font-bold border-t border-sand-200">
                    <td colSpan="3" className="p-2.5 text-bark-750">
                      Procurement Summary Metric (FOB Factory Material Yardage)
                    </td>
                    <td className="p-2.5 text-right text-clay-605">
                      {/* Dynamic aggregate yardage display if meters */}
                      {parseFloat(scaledBom.filter(x => x.unit === 'm').reduce((acc, curr) => acc + curr.totalQty, 0).toFixed(1))} m
                    </td>
                    <td className="p-2.5 text-right text-bark-450">
                      Per Unit:
                    </td>
                    <td className="p-2.5 text-right text-bark-900 font-extrabold text-xs">
                      ${totalBomCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-[10px] text-bark-500 font-mono bg-amber-50/30 border border-amber-200/40 p-2.5 rounded">
              <span className="flex items-center gap-1.5 text-amber-905">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span><b>Industrial Quality Standard:</b> Weft yarn count complies with international AATCC standards for shrinkage tolerance (&lt;2%).</span>
              </span>
              <span>Estimated Material Cost Per Unit: <b className="text-bark-900">${perUnitMaterialCost} USD</b></span>
            </div>
          </div>
        )}

        {/* SUB TAB B: ROUTING SEQUENCE */}
        {activeSubTab === 'routing' && (
          <div className="space-y-3" id="subtab-routing">
            <div className="flex items-center justify-between text-xs text-bark-500 font-mono" id="routing-header-stats">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-clay-600" />
                <span>Industrial Operation Routing List (Sequence of Operations)</span>
              </div>
              <span className="bg-sand-100 px-2 py-0.5 rounded font-bold text-bark-800">
                Stitch ISO Standard Compliant
              </span>
            </div>

            <div className="border border-sand-200 rounded overflow-hidden shadow-3xs">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-sand-100 text-bark-500 font-mono text-[9px] uppercase tracking-wider border-b border-sand-200">
                    <th className="p-2 w-12">Seq</th>
                    <th className="p-2">Assembly Operation Description</th>
                    <th className="p-2">Standard Machine Class</th>
                    <th className="p-2 text-right">Allowed Min (SAM)</th>
                    <th className="p-2 text-right">Est. Cost / Pc</th>
                    <th className="p-2 text-right font-bold text-bark-900">Total Batch Labor</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sand-150 font-sans">
                  {indData.routing.map((item) => {
                    const singleCost = item.sam * avgLaborMinuteRate;
                    const batchCost = singleCost * batchSize * efficiencyMultiplier;
                    return (
                      <tr key={item.step} className="hover:bg-sand-50/50 transition-colors">
                        <td className="p-2 font-mono font-bold text-[#ba6446]">{item.step}</td>
                        <td className="p-2 text-bark-850 font-semibold">{item.op}</td>
                        <td className="p-2 text-bark-600 font-mono text-[9.5px]">{item.machine}</td>
                        <td className="p-2 text-right font-mono text-bark-900 font-bold">{item.sam} min</td>
                        <td className="p-2 text-right text-bark-600 font-mono">
                          ${singleCost.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-bark-900">
                          ${batchCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-sand-50/50 font-mono text-[11px] font-bold border-t border-sand-200">
                    <td colSpan="3" className="p-2.5 text-bark-750">
                      Total Assembly Sewing Allowed Minutes (SAM) &amp; Labor cost
                    </td>
                    <td className="p-2.5 text-right text-[#ba6446] font-extrabold">
                      {totalSAMMinutes} Min
                    </td>
                    <td className="p-2.5 text-right text-bark-400">
                      Per Unit Est:
                    </td>
                    <td className="p-2.5 text-right text-bark-900 font-extrabold text-xs">
                      ${estimatedBatchLaborCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-[10px] text-bark-500 font-mono bg-sand-50 border border-sand-200/55 p-2.5 rounded">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Estimated piece-rate costs are calculated using standard GSD (Garment Sewing Data) labor values ($0.32/min).</span>
              </span>
              <span>Unit Sewing Labor Cost: <b className="text-bark-900">${estimatedLaborCostPerUnit} USD</b></span>
            </div>
          </div>
        )}

        {/* SUB TAB C: PROCUREMENT ANALYSIS */}
        {activeSubTab === 'throughput' && (
          <div className="space-y-4 font-sans text-xs text-bark-750 leading-relaxed" id="subtab-throughput">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="industrial-kpis">
              {/* Card 1 */}
              <div className="p-3 bg-white border border-sand-200 rounded shadow-3xs space-y-1">
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-bark-400 uppercase tracking-wider">
                  <TrendingUp className="w-3.5 h-3.5 text-clay-600" />
                  Yield Efficiency Rate
                </div>
                <div className="text-xl font-bold font-mono text-bark-900">
                  {batchSize <= 1 ? '75.2%' : batchSize <= 12 ? '85.4%' : '91.8%'}
                </div>
                <p className="text-[10px] text-bark-500 leading-snug">
                  Fabric marker utilization rate on {batchSize} garment lay. Standard double-width alignment.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-3 bg-white border border-sand-200 rounded shadow-3xs space-y-1">
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-bark-400 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-[#ba6446]" />
                  Line Assembly Throughput
                </div>
                <div className="text-xl font-bold font-mono text-bark-900">
                  {Math.round((8 * 60) / totalSAMMinutes * (efficiency / 100))} Pcs/Day
                </div>
                <p className="text-[10px] text-bark-500 leading-snug">
                  Estimated daily production output per single line worker station at {efficiency}% target efficiency.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-3 bg-white border border-sand-200 rounded shadow-3xs space-y-1">
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-bark-400 uppercase tracking-wider">
                  <Coins className="w-3.5 h-3.5 text-amber-700" />
                  FOB Target Price
                </div>
                <div className="text-xl font-bold font-mono text-clay-705">
                  ${targetFobFactoryPrice.toFixed(2)}
                </div>
                <p className="text-[10px] text-bark-500 leading-snug">
                  Target wholesale factory exit cost including standard industrial overhead &amp; factory profit margins.
                </p>
              </div>
            </div>

            {/* Industrial Logistics Table */}
            <div className="p-4 bg-sand-50/50 border border-sand-200 rounded-lg space-y-2.5" id="procurement-pack-analysis">
              <h4 className="font-mono font-bold text-bark-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#ba6446]" />
                Commercial Procurement &amp; Plant Logistics Analysis
              </h4>
              <p className="text-[11px] text-bark-600 leading-relaxed">
                This analysis simulates the logistics requirements for <b>{pattern.name} (Code: {patternNum})</b> for a production batch size of <b>{batchSize} units</b>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-mono pt-1">
                <div className="space-y-1 bg-white p-2.5 rounded border border-sand-200/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-bark-400 block">Manufacturing Logistics</span>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>Assembly Line Operations:</span>
                    <span className="font-bold text-bark-900">{indData.routing.length} Stages</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>Critical Path Stage:</span>
                    <span className="font-bold text-[#ba6446]">
                      {indData.routing.reduce((max, r) => r.sam > max.sam ? r : max, {sam: 0}).op}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Total Sewing Labor SAM:</span>
                    <span className="font-bold text-bark-900">{(totalSAMMinutes * batchSize).toLocaleString()} Minutes</span>
                  </div>
                </div>

                <div className="space-y-1 bg-white p-2.5 rounded border border-sand-200/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-bark-400 block">Cost &amp; Profit Estimations</span>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>Total Raw Materials:</span>
                    <span className="font-bold text-bark-900">${totalBomCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>Total Factory Sewing Labor:</span>
                    <span className="font-bold text-bark-900">${estimatedBatchLaborCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Total Manufacturing Cost:</span>
                    <span className="font-bold text-clay-705">${totalBatchIndustrialCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
