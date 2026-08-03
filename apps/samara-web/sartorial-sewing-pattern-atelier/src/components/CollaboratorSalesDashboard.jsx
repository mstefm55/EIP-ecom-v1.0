import React, { useState, useMemo, useEffect } from 'react';
import {
  DollarSign, Percent, ShieldCheck, Search, Filter,
  ArrowUpRight, ArrowDownRight, Calendar, User, ShoppingBag,
  Download, FileSpreadsheet, RefreshCw, Layers
} from 'lucide-react';

export default function CollaboratorSalesDashboard({
  salesHistory = [],
  onUpdateSalesHistory,
  payoutMethod = "PayPal (leone.atelier@design.com)"
}) {
  // 1. Dynamic local state for sales records (initialized with props or localStorage override)
  const [salesRecords, setSalesRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_erp_sales_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading initial sales history from localStorage:", e);
    }
    return salesHistory;
  });

  // Sync with prop when it changes
  useEffect(() => {
    if (salesHistory && salesHistory.length > 0) {
      setSalesRecords(salesHistory);
    }
  }, [salesHistory]);

  // 2. Global Integration: expose a namespace method on window so ERP can push live transaction lists
  useEffect(() => {
    window.setCollaboratorSalesHistory = (newSales) => {
      if (Array.isArray(newSales)) {
        setSalesRecords(newSales);
        try {
          localStorage.setItem('sartorial_erp_sales_history', JSON.stringify(newSales));
        } catch {}
        if (onUpdateSalesHistory) {
          onUpdateSalesHistory(newSales);
        }
        return { success: true, count: newSales.length, message: "Sales history synchronized with ERP" };
      }
      return { success: false, error: "Invalid sales history. Must be an array." };
    };

    return () => {
      try {
        delete window.setCollaboratorSalesHistory;
      } catch {}
    };
  }, [onUpdateSalesHistory]);

  // 3. Filtering & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [formatFilter, setFormatFilter] = useState('All'); // 'All' | 'PDF' | 'Printed'
  const [minAmountFilter, setMinAmountFilter] = useState('All'); // 'All' | '15' | '20'

  // Pre-configured ERP templates for simulation
  const erpTemplates = {
    standard: [
      { id: 'TXN-901', date: '2026-06-28', buyer: 'Julien Sorel', patternName: 'Aurelia Wrap Dress (Atelier Mod)', format: 'PDF', gross: 14.00, commission: 2.10, net: 11.90, erpStatus: 'payout_processed' },
      { id: 'TXN-902', date: '2026-06-25', buyer: 'Eleanor Vance', patternName: 'Renaissance Pleated Bodice', format: 'Printed', gross: 25.00, commission: 3.75, net: 21.25, erpStatus: 'payout_processed' },
      { id: 'TXN-903', date: '2026-06-20', buyer: 'Julien Sorel', patternName: 'Renaissance Pleated Bodice', format: 'PDF', gross: 15.00, commission: 2.25, net: 12.75, erpStatus: 'payout_processed' },
      { id: 'TXN-904', date: '2026-06-18', buyer: 'Thérèse Raquin', patternName: 'Aurelia Wrap Dress (Atelier Mod)', format: 'Printed', gross: 24.00, commission: 3.60, net: 20.40, erpStatus: 'payout_pending' },
      { id: 'TXN-905', date: '2026-06-10', buyer: 'Genevieve Vane', patternName: 'Chantilly Silk Slip Dress', format: 'PDF', gross: 12.00, commission: 1.80, net: 10.20, erpStatus: 'payout_processed' },
      { id: 'TXN-906', date: '2026-06-03', buyer: 'Clara Oswald', patternName: 'Renaissance Pleated Bodice', format: 'PDF', gross: 15.00, commission: 2.25, net: 12.75, erpStatus: 'payout_processed' }
    ],
    highValue: [
      { id: 'ERP-HV-01', date: '2026-07-03', buyer: 'Amélie Poulain', patternName: 'Milan Structured Duster Coat', format: 'Printed', gross: 34.00, commission: 5.10, net: 28.90, erpStatus: 'payout_pending' },
      { id: 'ERP-HV-02', date: '2026-07-01', buyer: 'Sebastian Valmont', patternName: 'Milan Structured Duster Coat', format: 'Printed', gross: 34.00, commission: 5.10, net: 28.90, erpStatus: 'payout_pending' },
      { id: 'ERP-HV-03', date: '2026-06-29', buyer: 'Cosette Fauchelevent', patternName: 'Renaissance Pleated Bodice', format: 'Printed', gross: 25.00, commission: 3.75, net: 21.25, erpStatus: 'payout_processed' },
      { id: 'ERP-HV-04', date: '2026-06-24', buyer: 'Jean Valjean', patternName: 'Milan Structured Duster Coat', format: 'PDF', gross: 18.00, commission: 2.70, net: 15.30, erpStatus: 'payout_processed' }
    ],
    empty: []
  };

  const loadTemplate = (key) => {
    const list = erpTemplates[key];
    setSalesRecords(list);
    try {
      localStorage.setItem('sartorial_erp_sales_history', JSON.stringify(list));
    } catch {}
    if (onUpdateSalesHistory) {
      onUpdateSalesHistory(list);
    }
  };

  // 4. Financial Summation calculations
  const stats = useMemo(() => {
    let grossSum = 0;
    let feeSum = 0;
    let netSum = 0;
    let pendingSum = 0;

    salesRecords.forEach(txn => {
      grossSum += txn.gross || 0;
      feeSum += txn.commission || 0;
      netSum += txn.net || 0;
      if (txn.erpStatus === 'payout_pending') {
        pendingSum += txn.net || 0;
      }
    });

    const averageOrderValue = salesRecords.length > 0 ? (grossSum / salesRecords.length) : 0;

    return {
      grossSum,
      feeSum,
      netSum,
      pendingSum,
      averageOrderValue,
      salesCount: salesRecords.length
    };
  }, [salesRecords]);

  // 5. Filter application
  const filteredTxns = useMemo(() => {
    return salesRecords.filter(txn => {
      const matchSearch =
        txn.buyer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.patternName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchFormat = formatFilter === 'All' || txn.format === formatFilter;

      let matchMinAmount = true;
      if (minAmountFilter !== 'All') {
        const minVal = parseFloat(minAmountFilter);
        matchMinAmount = txn.gross >= minVal;
      }

      return matchSearch && matchFormat && matchMinAmount;
    });
  }, [salesRecords, searchTerm, formatFilter, minAmountFilter]);

  // Reset helper
  const handleReset = () => {
    localStorage.removeItem('sartorial_erp_sales_history');
    setSalesRecords(salesHistory);
    if (onUpdateSalesHistory) {
      onUpdateSalesHistory(salesHistory);
    }
  };

  return (
    <div
      className="space-y-6 bg-white rounded-[4px] p-1 erp-dashboard-container"
      id="collaborator-sales-dashboard"
      data-erp-source="sartorial_atelier_sales_ledger"
      data-erp-record-count={salesRecords.length}
    >
      {/* Dev Controller Row: for manual live simulation with the ERP Mapping tool */}
      <div className="bg-sand-50/70 border border-sand-200/60 p-3.5 rounded-[4px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs" id="erp-dev-pilot-bar">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-clay-600" />
          <div>
            <span className="font-serif font-semibold text-bark-900 block leading-none">ERP Data Connector</span>
            <span className="text-[10px] text-bark-500 font-sans mt-0.5 block">Exposing class tags and data anchors for direct scanner mappings.</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" id="erp-templates-row">
          <span className="text-[9.5px] text-bark-450 font-bold self-center uppercase mr-1">Load Mock ERP Set:</span>
          <button
            onClick={() => loadTemplate('standard')}
            className="bg-white hover:bg-sand-100/50 text-bark-800 border border-sand-250 text-[10.5px] px-2 py-1 rounded transition-all cursor-pointer font-sans"
            type="button"
            id="btn-template-standard"
          >
            Artisan Standard
          </button>
          <button
            onClick={() => loadTemplate('highValue')}
            className="bg-white hover:bg-sand-100/50 text-bark-800 border border-sand-250 text-[10.5px] px-2 py-1 rounded transition-all cursor-pointer font-sans"
            type="button"
            id="btn-template-high-value"
          >
            Couture Milan (High)
          </button>
          <button
            onClick={() => loadTemplate('empty')}
            className="bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-[10.5px] px-2 py-1 rounded transition-all cursor-pointer font-sans"
            type="button"
            id="btn-template-clear"
          >
            Zero State
          </button>
          <button
            onClick={handleReset}
            className="text-bark-450 hover:text-bark-900 text-[10.5px] px-1.5 py-1 rounded cursor-pointer transition-colors"
            title="Reload from static config"
            type="button"
            id="btn-template-reset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="erp-summary-cards">

        {/* Card 1: Gross Revenue */}
        <div
          className="bg-white border border-sand-200/90 rounded-[4px] p-4 space-y-2 relative overflow-hidden shadow-3xs hover:shadow-xs transition-shadow erp-card-gross"
          id="erp-card-gross-rev"
          data-erp-metric="gross_sales"
          data-erp-value={stats.grossSum}
        >
          <div className="flex items-center justify-between" id="gross-card-header">
            <span className="text-[10px] uppercase font-mono text-bark-400 font-bold tracking-wider">Gross Revenue</span>
            <div className="w-7 h-7 rounded-full bg-sand-100 flex items-center justify-center text-bark-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5" id="gross-card-metrics">
            <h3 className="font-serif text-2xl font-bold text-bark-900 tracking-tight erp-metric-gross">
              ${stats.grossSum.toFixed(2)}
            </h3>
            <p className="text-[10px] text-bark-500 font-sans flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 inline" />
              <span>{stats.salesCount} checkout transactions</span>
            </p>
          </div>
        </div>

        {/* Card 2: Platform / Referral Fee */}
        <div
          className="bg-white border border-sand-200/90 rounded-[4px] p-4 space-y-2 relative overflow-hidden shadow-3xs hover:shadow-xs transition-shadow erp-card-commission"
          id="erp-card-platform-fees"
          data-erp-metric="commission_fees"
          data-erp-value={stats.feeSum}
          data-erp-fee-rate="0.15"
        >
          <div className="flex items-center justify-between" id="fee-card-header">
            <span className="text-[10px] uppercase font-mono text-bark-400 font-bold tracking-wider">Referral Fees</span>
            <div className="w-7 h-7 rounded-full bg-clay-50 flex items-center justify-center text-clay-700">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-0.5" id="fee-card-metrics">
            <h3 className="font-serif text-2xl font-bold text-clay-700 tracking-tight erp-metric-commission">
              -${stats.feeSum.toFixed(2)}
            </h3>
            <p className="text-[10px] text-bark-500 font-sans">
              Fixed rate: <b className="font-mono text-clay-800">15% platform share</b>
            </p>
          </div>
        </div>

        {/* Card 3: Net Partner Income */}
        <div
          className="bg-white border border-sand-200/90 rounded-[4px] p-4 space-y-2 relative overflow-hidden shadow-3xs hover:shadow-xs transition-shadow erp-card-net"
          id="erp-card-net-earnings"
          data-erp-metric="net_income"
          data-erp-value={stats.netSum}
        >
          <div className="flex items-center justify-between" id="net-card-header">
            <span className="text-[10px] uppercase font-mono text-emerald-800 font-bold tracking-wider">Net Income</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5" id="net-card-metrics">
            <h3 className="font-serif text-2xl font-bold text-emerald-800 tracking-tight erp-metric-net">
              ${stats.netSum.toFixed(2)}
            </h3>
            <p className="text-[10px] text-emerald-650 font-medium">
              ✦ Ready for instant payouts
            </p>
          </div>
        </div>

        {/* Card 4: ERP Settlement */}
        <div
          className="bg-white border border-sand-200/90 rounded-[4px] p-4 space-y-2 relative overflow-hidden shadow-3xs hover:shadow-xs transition-shadow erp-card-settlement"
          id="erp-card-settlement-status"
          data-erp-metric="pending_payouts"
          data-erp-value={stats.pendingSum}
        >
          <div className="flex items-center justify-between" id="settle-card-header">
            <span className="text-[10px] uppercase font-mono text-bark-400 font-bold tracking-wider">Pending Settlement</span>
            <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center text-amber-700">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-0.5" id="settle-card-metrics">
            <h3 className="font-serif text-2xl font-bold text-amber-800 tracking-tight erp-metric-pending">
              ${stats.pendingSum.toFixed(2)}
            </h3>
            <p className="text-[9px] text-bark-500 font-sans line-clamp-1">
              Method: <strong className="font-mono text-bark-750 text-[9.5px]">{payoutMethod.split(' ')[0]}</strong>
            </p>
          </div>
        </div>

      </div>

      {/* Filterable Table Control Room */}
      <div className="space-y-4" id="ledger-control-room">

        {/* Search & Filter Inputs */}
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center bg-sand-50/40 p-3 border border-sand-200/65 rounded-[4px]" id="ledger-filter-row">

          <div className="relative border border-sand-250 bg-white rounded-[3px] overflow-hidden flex items-center px-2.5 py-1.5 flex-1 max-w-sm" id="ledger-search-box">
            <Search className="w-3.5 h-3.5 text-bark-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search by Txn ID, buyer, or blueprint..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-[11px] focus:outline-none w-full text-bark-800 font-sans"
              id="inp-ledger-search"
            />
          </div>

          <div className="flex flex-wrap gap-2" id="ledger-select-filters">
            {/* Format Filter */}
            <div className="flex items-center gap-1" id="filter-wrapper-format">
              <span className="text-[10px] text-bark-400 font-mono font-semibold uppercase">Format:</span>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="border border-sand-250 rounded-[3px] text-[11px] px-2 py-1.5 bg-white font-sans text-bark-800 focus:outline-none focus:ring-1 focus:ring-clay-500"
                id="sel-ledger-format"
              >
                <option value="All">All formats</option>
                <option value="PDF">PDF Only</option>
                <option value="Printed">Printed Paper</option>
              </select>
            </div>

            {/* Price Filter */}
            <div className="flex items-center gap-1" id="filter-wrapper-min-price">
              <span className="text-[10px] text-bark-400 font-mono font-semibold uppercase">Gross Min:</span>
              <select
                value={minAmountFilter}
                onChange={(e) => setMinAmountFilter(e.target.value)}
                className="border border-sand-250 rounded-[3px] text-[11px] px-2 py-1.5 bg-white font-sans text-bark-800 focus:outline-none focus:ring-1 focus:ring-clay-500"
                id="sel-ledger-amount"
              >
                <option value="All">No limit</option>
                <option value="15">$15.00 +</option>
                <option value="20">$20.00 +</option>
                <option value="30">$30.00 +</option>
              </select>
            </div>
          </div>

        </div>

        {/* Ledger Table */}
        {filteredTxns.length === 0 ? (
          <div className="text-center py-10 bg-sand-50/20 border border-dashed border-sand-250 rounded-[4px] space-y-1.5" id="ledger-empty-state">
            <ShoppingBag className="w-6 h-6 text-bark-300 mx-auto" />
            <p className="text-xs text-bark-550 italic font-sans">
              No sales logs matched your filter requirements.
            </p>
          </div>
        ) : (
          <div
            className="border border-sand-200/90 rounded-[4px] overflow-hidden bg-white shadow-3xs"
            id="ledger-table-wrapper"
            data-erp-ledger-filtered-count={filteredTxns.length}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs" id="erp-sales-table">
                <thead>
                  <tr className="bg-sand-50 border-b border-sand-200/95 text-bark-500 font-mono text-[9px] uppercase tracking-wider">
                    <th className="p-3 font-semibold">Txn ID</th>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Buyer</th>
                    <th className="p-3 font-semibold">Blueprint Name</th>
                    <th className="p-3 font-semibold">Format</th>
                    <th className="p-3 font-semibold text-right">Gross Rev</th>
                    <th className="p-3 font-semibold text-right">Platform Fee</th>
                    <th className="p-3 font-semibold text-right">Net Income</th>
                    <th className="p-3 font-semibold text-center">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100 font-sans text-bark-800" id="erp-sales-table-body">
                  {filteredTxns.map((txn) => (
                    <tr
                      key={txn.id}
                      className="hover:bg-sand-50/30 transition-colors erp-txn-row"
                      id={`erp-row-${txn.id}`}
                      data-erp-txn-id={txn.id}
                      data-erp-txn-buyer={txn.buyer}
                      data-erp-txn-gross={txn.gross}
                      data-erp-txn-net={txn.net}
                      data-erp-txn-format={txn.format}
                    >
                      {/* ID with code styling */}
                      <td className="p-3 font-mono text-[10.5px] text-bark-550 erp-txn-id">{txn.id}</td>

                      {/* Date */}
                      <td className="p-3 text-bark-500 text-[10.5px] erp-txn-date">{txn.date}</td>

                      {/* Buyer */}
                      <td className="p-3 font-medium text-bark-900 erp-txn-buyer">{txn.buyer}</td>

                      {/* Blueprint Name */}
                      <td className="p-3 text-bark-700 font-serif erp-txn-pattern">{txn.patternName}</td>

                      {/* Format Badge */}
                      <td className="p-3">
                        <span className={`text-[8.5px] font-mono px-2 py-0.5 rounded-full uppercase font-bold erp-txn-format ${
                          txn.format === 'PDF'
                            ? 'bg-clay-50 text-clay-700 border border-clay-150'
                            : 'bg-sage-50 text-sage-700 border border-sage-150'
                        }`}>
                          {txn.format}
                        </span>
                      </td>

                      {/* Gross amount */}
                      <td className="p-3 text-right font-mono text-bark-600 erp-txn-gross" data-raw-val={txn.gross}>
                        ${txn.gross.toFixed(2)}
                      </td>

                      {/* Platform Fee */}
                      <td className="p-3 text-right font-mono text-clay-650 erp-txn-commission" data-raw-val={txn.commission}>
                        -${txn.commission.toFixed(2)}
                      </td>

                      {/* Net partner income */}
                      <td className="p-3 text-right font-mono font-bold text-emerald-700 erp-txn-net" data-raw-val={txn.net}>
                        ${txn.net.toFixed(2)}
                      </td>

                      {/* ERP Settlement state indicator */}
                      <td className="p-3 text-center">
                        <span
                          className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono font-semibold uppercase ${
                            txn.erpStatus === 'payout_processed'
                              ? 'bg-emerald-100/60 text-emerald-800'
                              : 'bg-amber-100/60 text-amber-800'
                          }`}
                          title={txn.erpStatus === 'payout_processed' ? 'Disbursed to partner' : 'Awaiting settlement cycles'}
                        >
                          {txn.erpStatus === 'payout_processed' ? 'Settled' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
