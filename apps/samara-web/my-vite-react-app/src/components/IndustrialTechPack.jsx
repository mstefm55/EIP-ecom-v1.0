import React, { useState } from 'react';
import { useRuntimeState } from '../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../lib/runtimeDomainContracts';
import { INDUSTRIAL_TECH_PACK_SEED } from '../data/runtimeSeeds';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
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

  // BOM/routing are runtime manufacturing records. Local seed is only a development fallback;
  // the future EIP adapter owns authoritative industrial tech-pack records.
  const [industrialTechPacks] = useRuntimeState(
    RUNTIME_DOMAINS.INDUSTRIAL_TECH_PACKS,
    INDUSTRIAL_TECH_PACK_SEED
  );
  const indData = industrialTechPacks?.[pattern?.id] || industrialTechPacks?.default || INDUSTRIAL_TECH_PACK_SEED.default;

  const patternNum = pattern?.id || 'workspace-pattern';

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
            <span className="text-[9px] font-mono tracking-widest font-bold bg-bark-900 text-sand-50 px-2 py-0.5 rounded uppercase">{pfUiT("ui.components.industrialtechpack.93b6401730")}</span>
            <span className="text-[9px] font-mono text-clay-605 font-extrabold uppercase animate-pulse">{pfUiT("ui.components.industrialtechpack.194c3485b0")}</span>
          </div>
          <h3 className="font-serif text-bark-950 font-bold text-base mt-1">
            Production Specification &amp; Routing Tech Pack
          </h3>
          <p className="text-[11px] text-bark-500 font-sans mt-0.5 leading-normal">{pfUiT("ui.components.industrialtechpack.3e8f77787b")}</p>
        </div>

        {/* Main Stats Panel */}
        <div className="grid grid-cols-2 gap-4 bg-sand-50/60 border border-sand-200/60 rounded p-2.5 min-w-[180px]" id="sam-quick-panel">
          <div>
            <span className="text-[8px] font-mono text-bark-400 block uppercase font-bold tracking-wider">{pfUiT("ui.components.industrialtechpack.c0f741ffd5")}</span>
            <span className="font-mono text-sm font-extrabold text-[#ba6446]">{totalSAMMinutes} Min</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-bark-400 block uppercase font-bold tracking-wider">{pfUiT("ui.components.industrialtechpack.b162c8a69b")}</span>
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
            <Sliders className="w-4 h-4 text-[#ba6446]" />{pfUiT("ui.components.industrialtechpack.f8e2994f0d")}</div>

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
                placeholder={pfUiT("ui.components.industrialtechpack.4de4af17fe")}
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
                <span>{pfUiT("ui.components.industrialtechpack.f4477799cc")}<b>{batchSize} units</b></span>
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
                <span>{pfUiT("ui.components.industrialtechpack.bd025c41ee")}<b>{efficiency}%</b></span>
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
              <span className="text-bark-450 uppercase font-bold">{pfUiT("ui.components.industrialtechpack.48cb3af849")}</span>
              <span className="font-extrabold text-bark-900">{(totalSAMMinutes * batchSize).toLocaleString()}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bark-450 uppercase font-bold">{pfUiT("ui.components.industrialtechpack.23bec20e74")}</span>
              <span className="font-extrabold text-clay-605">{batchRequiredMinutes.toLocaleString()}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bark-450 uppercase font-bold font-semibold">{pfUiT("ui.components.industrialtechpack.37859148a3")}</span>
              <span className="font-extrabold text-bark-900">{batchRequiredHours} Hrs</span>
            </div>
            <div className="border-t border-sand-150 pt-2 flex justify-between text-[11px] font-bold">
              <span className="text-[#ba6446] uppercase">{pfUiT("ui.components.industrialtechpack.97050d2dc8")}</span>
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
        >{pfUiT("ui.components.industrialtechpack.e3b265a4aa")}</button>
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
                <span>{pfUiT("ui.components.industrialtechpack.92234bb39d")}</span>
              </div>
              <span>{pfUiT("ui.components.industrialtechpack.f697f2a815")}<b className="text-bark-900">{batchSize} Pcs</b></span>
            </div>

            <div className="border border-sand-200 rounded overflow-hidden shadow-3xs">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-sand-100 text-bark-500 font-mono text-[9px] uppercase tracking-wider border-b border-sand-200">
                    <th className="p-2">{pfUiT("ui.components.industrialtechpack.793e1ea433")}</th>
                    <th className="p-2">{pfUiT("ui.components.industrialtechpack.8bfce6709f")}</th>
                    <th className="p-2 text-right">{pfUiT("ui.components.industrialtechpack.2687a33f3a")}</th>
                    <th className="p-2 text-right text-clay-605">Total Qty (BOQ)</th>
                    <th className="p-2 text-right">{pfUiT("ui.components.industrialtechpack.4de333367c")}</th>
                    <th className="p-2 text-right font-bold text-bark-900">{pfUiT("ui.components.industrialtechpack.62d772d3cd")}</th>
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
                    <td className="p-2.5 text-right text-bark-450">{pfUiT("ui.components.industrialtechpack.5acf9e63ba")}</td>
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
                <span><b>{pfUiT("ui.components.industrialtechpack.2c04122b07")}</b> Weft yarn count complies with international AATCC standards for shrinkage tolerance (&lt;2%).</span>
              </span>
              <span>{pfUiT("ui.components.industrialtechpack.3a33a3e2d5")}<b className="text-bark-900">${perUnitMaterialCost} USD</b></span>
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
              <span className="bg-sand-100 px-2 py-0.5 rounded font-bold text-bark-800">{pfUiT("ui.components.industrialtechpack.af57bed378")}</span>
            </div>

            <div className="border border-sand-200 rounded overflow-hidden shadow-3xs">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-sand-100 text-bark-500 font-mono text-[9px] uppercase tracking-wider border-b border-sand-200">
                    <th className="p-2 w-12">{pfUiT("ui.components.industrialtechpack.d6b5e95260")}</th>
                    <th className="p-2">{pfUiT("ui.components.industrialtechpack.4ef23ce3df")}</th>
                    <th className="p-2">{pfUiT("ui.components.industrialtechpack.52665a76a4")}</th>
                    <th className="p-2 text-right">Allowed Min (SAM)</th>
                    <th className="p-2 text-right">{pfUiT("ui.components.industrialtechpack.b2623546e6")}</th>
                    <th className="p-2 text-right font-bold text-bark-900">{pfUiT("ui.components.industrialtechpack.c31a0d64c1")}</th>
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
                    <td className="p-2.5 text-right text-bark-400">{pfUiT("ui.components.industrialtechpack.dba399c4e4")}</td>
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
              <span>{pfUiT("ui.components.industrialtechpack.d286a8ab93")}<b className="text-bark-900">${estimatedLaborCostPerUnit} USD</b></span>
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
                  <TrendingUp className="w-3.5 h-3.5 text-clay-600" />{pfUiT("ui.components.industrialtechpack.e2c779efea")}</div>
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
                  <Clock className="w-3.5 h-3.5 text-[#ba6446]" />{pfUiT("ui.components.industrialtechpack.695e24e386")}</div>
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
                  <Coins className="w-3.5 h-3.5 text-amber-700" />{pfUiT("ui.components.industrialtechpack.81a0937d6e")}</div>
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
              <p className="text-[11px] text-bark-600 leading-relaxed">{pfUiT("ui.components.industrialtechpack.e09424e0aa")}<b>{pattern.name} (Code: {patternNum})</b>{pfUiT("ui.components.industrialtechpack.0df70b1e67")}<b>{batchSize} units</b>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-mono pt-1">
                <div className="space-y-1 bg-white p-2.5 rounded border border-sand-200/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-bark-400 block">{pfUiT("ui.components.industrialtechpack.456b954c18")}</span>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>{pfUiT("ui.components.industrialtechpack.69c5789691")}</span>
                    <span className="font-bold text-bark-900">{indData.routing.length} Stages</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>{pfUiT("ui.components.industrialtechpack.b60009fc90")}</span>
                    <span className="font-bold text-[#ba6446]">
                      {indData.routing.reduce((max, r) => r.sam > max.sam ? r : max, {sam: 0}).op}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>{pfUiT("ui.components.industrialtechpack.ac8186a006")}</span>
                    <span className="font-bold text-bark-900">{(totalSAMMinutes * batchSize).toLocaleString()} Minutes</span>
                  </div>
                </div>

                <div className="space-y-1 bg-white p-2.5 rounded border border-sand-200/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-bark-400 block">Cost &amp; Profit Estimations</span>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>{pfUiT("ui.components.industrialtechpack.94d5add003")}</span>
                    <span className="font-bold text-bark-900">${totalBomCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-sand-100">
                    <span>{pfUiT("ui.components.industrialtechpack.7560e0ef88")}</span>
                    <span className="font-bold text-bark-900">${estimatedBatchLaborCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>{pfUiT("ui.components.industrialtechpack.dcc6c66665")}</span>
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
