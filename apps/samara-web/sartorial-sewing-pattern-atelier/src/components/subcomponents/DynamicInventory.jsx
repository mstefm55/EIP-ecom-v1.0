import React, { useState } from 'react';
import { Layers, Plus, RotateCw, AlertTriangle, Scale, DollarSign, Package, Trash2, Edit2, Download, Tag } from 'lucide-react';
import { jsPDF } from 'jspdf';

const INITIAL_INVENTORY = [
  {
    id: 'inv-1',
    name: 'French Flax Organic Linen',
    type: 'Fabric Roll',
    color: 'Oatmeal Natural',
    stock: 45.5, // yards
    threshold: 15.0, // warning threshold
    cost: 16.50, // per yard
    status: 'In Stock',
    weight: '240 GSM',
    tags: ['Organic', 'Linen', 'Sustainable', 'Breathable']
  },
  {
    id: 'inv-2',
    name: 'Ivory Mulberry Silk Satin',
    type: 'Premium Lining',
    color: 'Soft Pearl',
    stock: 12.0,
    threshold: 15.0,
    cost: 32.00,
    status: 'Low Stock',
    weight: '80 GSM',
    tags: ['Luxury', 'Silk', 'Lining', 'Drape']
  },
  {
    id: 'inv-3',
    name: 'Belgian Organic Cotton Denim',
    type: 'Fabric Roll',
    color: 'Indigo Indigo',
    stock: 28.0,
    threshold: 10.0,
    cost: 14.80,
    status: 'In Stock',
    weight: '310 GSM',
    tags: ['Denim', 'Heavyweight', 'Indigo', 'Cotton']
  },
  {
    id: 'inv-4',
    name: 'British Fine Merino Tweed',
    type: 'Heavy Wool Crepe',
    color: 'Forest Herringbone',
    stock: 5.5,
    threshold: 10.0,
    cost: 29.50,
    status: 'Critically Low',
    weight: '380 GSM',
    tags: ['Wool', 'Tweed', 'Herringbone', 'Warm']
  }
];

export default function DynamicInventory() {
  const [inventory, setInventory] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_bureau_inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate legacy data by adding default tags if they don't exist
        return parsed.map(item => ({
          ...item,
          tags: item.tags || (item.name ? item.name.split(' ').slice(-2) : ['Fabric', 'Textile'])
        }));
      }
      return INITIAL_INVENTORY;
    } catch {
      return INITIAL_INVENTORY;
    }
  });

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('Off-White');
  const [newStock, setNewStock] = useState(25);
  const [newCost, setNewCost] = useState(15.00);
  const [selectedType, setSelectedType] = useState('Fabric Roll');
  const [newTags, setNewTags] = useState('Organic, Fabric');

  const saveInventory = (updated) => {
    setInventory(updated);
    try {
      localStorage.setItem('perfectfit_bureau_inventory', JSON.stringify(updated));
    } catch {}
  };

  const handleAddMaterial = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const parsedTags = newTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const newMaterial = {
      id: `inv-${Date.now()}`,
      name: newName,
      type: selectedType,
      color: newColor,
      stock: parseFloat(newStock) || 0,
      threshold: 10.0,
      cost: parseFloat(newCost) || 0,
      status: parseFloat(newStock) <= 10.0 ? 'Low Stock' : 'In Stock',
      weight: '220 GSM',
      tags: parsedTags.length > 0 ? parsedTags : ['Custom']
    };

    const updated = [...inventory, newMaterial];
    saveInventory(updated);
    setNewName('');
    setNewColor('Off-White');
    setNewStock(25);
    setNewCost(15.00);
    setNewTags('Organic, Fabric');

    if (window.showToast) {
      window.showToast(`Material "${newName}" added with tags: ${parsedTags.join(', ')}`, 'success', 'Inventory Updated');
    }
  };

  const adjustStock = (id, delta) => {
    const updated = inventory.map(item => {
      if (item.id === id) {
        const nextStock = Math.max(0, parseFloat((item.stock + delta).toFixed(2)));
        let nextStatus = 'In Stock';
        if (nextStock === 0) {
          nextStatus = 'Out of Stock';
        } else if (nextStock <= item.threshold / 2) {
          nextStatus = 'Critically Low';
        } else if (nextStock <= item.threshold) {
          nextStatus = 'Low Stock';
        }
        return {
          ...item,
          stock: nextStock,
          status: nextStatus
        };
      }
      return item;
    });
    saveInventory(updated);
  };

  const handleDeleteItem = (id) => {
    const updated = inventory.filter(item => item.id !== id);
    saveInventory(updated);
  };

  const exportToPdf = () => {
    const doc = new jsPDF();

    // Header Panel
    doc.setFillColor(250, 248, 245); // Sand background
    doc.rect(0, 0, 210, 45, 'F');

    // Title / Header Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(140, 98, 57); // Clay Theme Color #8c6239
    doc.text("PERFECT FIT BUREAU", 15, 20);

    doc.setFontSize(11);
    doc.setTextColor(80, 75, 70);
    doc.setFont("helvetica", "normal");
    doc.text("TEXTILE STOCK LEDGER & FABRIC INVENTORY REPORT", 15, 27);

    // Metadata block
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.setFontSize(8.5);
    doc.setTextColor(130, 125, 120);
    doc.text(`Generated: ${today}`, 15, 34);

    const totalYardage = inventory.reduce((sum, item) => sum + item.stock, 0).toFixed(1);
    const totalValue = inventory.reduce((sum, item) => sum + (item.stock * item.cost), 0).toFixed(2);
    doc.text(`Total Active Roll Records: ${inventory.length}   |   Total Yardage: ${totalYardage} Yds   |   Asset Valuation: $${totalValue}`, 15, 39);

    // Decorative clay line
    doc.setDrawColor(140, 98, 57);
    doc.setLineWidth(1.5);
    doc.line(15, 45, 195, 45);

    let y = 58;

    // Draw table headers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    doc.text("Material Swatch Details", 15, y);
    doc.text("Category & Weight", 90, y);
    doc.text("Stock Level", 130, y);
    doc.text("Cost / Yd", 160, y);
    doc.text("Asset Value", 180, y);

    // Underline headers
    doc.setDrawColor(200, 195, 185);
    doc.setLineWidth(0.5);
    doc.line(15, y + 3, 195, y + 3);
    y += 12;

    inventory.forEach((item, index) => {
      // Manage page breaks
      if (y > 270) {
        doc.addPage();
        // Draw header repeating on next page
        doc.setFillColor(250, 248, 245);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(140, 98, 57);
        doc.text("PERFECT FIT BUREAU - TEXTILE STOCK LEDGER (Cont.)", 15, 15);

        doc.setDrawColor(140, 98, 57);
        doc.setLineWidth(1);
        doc.line(15, 25, 195, 25);

        y = 38;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        doc.text("Material Swatch Details", 15, y);
        doc.text("Category & Weight", 90, y);
        doc.text("Stock Level", 130, y);
        doc.text("Cost / Yd", 160, y);
        doc.text("Asset Value", 180, y);
        doc.setDrawColor(200, 195, 185);
        doc.setLineWidth(0.5);
        doc.line(15, y + 3, 195, y + 3);
        y += 12;
      }

      // Fabric Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(item.name || 'Unnamed Textile', 15, y);

      // Fabric specs (Color & ID)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 105, 100);
      doc.text(`Color: ${item.color || 'N/A'}  [ID: ${item.id}]`, 15, y + 4.5);

      // Fabric tags
      const currentTags = item.tags || ['Fabric'];
      doc.setTextColor(140, 98, 57);
      doc.setFont("helvetica", "bold");
      doc.text(`Tags: ${currentTags.map(t => '#' + t).join(' ')}`, 15, y + 8.5);

      // Category & Weight
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      doc.text(item.type || 'Fabric Roll', 90, y);
      doc.setTextColor(110, 105, 100);
      doc.setFontSize(7.5);
      doc.text(item.weight || '230 GSM', 90, y + 4.5);

      // Stock level with status indication
      doc.setFontSize(9);
      const isWarning = item.stock <= (item.threshold || 10);
      if (isWarning) {
        doc.setTextColor(210, 50, 50); // Red warn
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(45, 130, 75); // Green good
        doc.setFont("helvetica", "bold");
      }
      doc.text(`${item.stock} Yds`, 130, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(110, 105, 100);
      doc.text(item.status || 'In Stock', 130, y + 4);

      // Cost & Value
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`$${item.cost.toFixed(2)}`, 160, y);

      const currentVal = item.stock * item.cost;
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.text(`$${currentVal.toFixed(2)}`, 180, y);

      // Subtle bottom gridline
      doc.setDrawColor(242, 239, 235);
      doc.setLineWidth(0.5);
      doc.line(15, y + 11, 195, y + 11);

      y += 15;
    });

    // Footer decoration
    doc.setDrawColor(210, 205, 195);
    doc.setLineWidth(0.5);
    doc.line(15, 275, 195, 275);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 135, 130);
    doc.text("Perfect Fit Bureau ERP System • All stocks verified against local workstation ledger", 15, 281);
    doc.text("End of Textile Inventory Stock Report", 155, 281);

    doc.save("perfectfit_textile_inventory.pdf");

    if (window.showToast) {
      window.showToast("Successfully generated and downloaded premium fabric stock report PDF.", "success", "PDF Generated");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="dynamic-inventory-subcomponent">

      {/* Table & Status Cards */}
      <div className="lg:col-span-3 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-4xs flex items-center gap-4">
            <div className="w-10 h-10 bg-clay-50 rounded-lg flex items-center justify-center text-clay-700 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-bark-450 block">Total Materials</span>
              <strong className="text-lg font-serif text-bark-900">{inventory.length} Active Rolls</strong>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-4xs flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-bark-450 block">Low Stock Warn</span>
              <strong className="text-lg font-serif text-bark-900">
                {inventory.filter(i => i.status === 'Low Stock' || i.status === 'Critically Low' || i.status === 'Out of Stock').length} Items
              </strong>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-sand-200 shadow-4xs flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-700 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-bark-450 block">Total Yardage</span>
              <strong className="text-lg font-serif text-bark-900">
                {inventory.reduce((sum, item) => sum + item.stock, 0).toFixed(1)} Yards
              </strong>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl border border-sand-200 shadow-3xs overflow-hidden">
          <div className="p-4 border-b border-sand-150 flex justify-between items-center bg-sand-50/20 flex-wrap gap-2">
            <h4 className="text-sm font-serif font-medium text-bark-900">Textile Stock Ledger</h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportToPdf}
                className="bg-clay-605 hover:bg-clay-705 active:scale-95 text-white font-sans text-[11px] font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs hover:shadow-2xs"
                title="Download comprehensive PDF inventory report"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF Report</span>
              </button>
              <span className="text-[9px] font-mono uppercase bg-clay-50 text-clay-700 px-2 py-0.5 rounded font-bold">ERP Synced</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sand-200 bg-sand-50/50 text-[10px] font-mono uppercase text-bark-500">
                  <th className="p-3.5 pl-4">Material Details</th>
                  <th className="p-3.5">Type & Spec</th>
                  <th className="p-3.5">Stock Level</th>
                  <th className="p-3.5">Est. Cost</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right pr-4">Inventory Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100 text-xs">
                {inventory.map(item => (
                  <tr key={item.id} className="hover:bg-sand-50/30 transition-colors">
                    <td className="p-3.5 pl-4 space-y-1.5">
                      <div>
                        <strong className="font-sans text-bark-900 font-bold block">{item.name}</strong>
                        <span className="text-[10px] text-bark-500 font-mono">Swatch: {item.color}</span>
                      </div>

                      {/* Interactive tag list */}
                      <div className="flex flex-wrap gap-1">
                        {(item.tags || []).map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-flex items-center gap-0.5 text-[9px] font-mono font-medium text-clay-705 bg-clay-50/80 border border-clay-150 px-1.5 py-0.5 rounded-md shadow-4xs"
                          >
                            <Tag className="w-2 h-2 shrink-0 text-clay-500" />
                            <span>{tag}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 space-y-0.5">
                      <span className="text-[10px] bg-sand-100 text-bark-700 px-2 py-0.5 rounded font-mono font-medium">{item.type}</span>
                      <span className="text-[9px] text-bark-450 block mt-0.5">{item.weight}</span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-sm text-bark-900">{item.stock} Yd</strong>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => adjustStock(item.id, 5)}
                            className="text-[8px] bg-sand-100 hover:bg-sand-200 font-mono font-bold px-1 rounded cursor-pointer"
                            title="Add 5 yards"
                          >
                            +5
                          </button>
                          <button
                            onClick={() => adjustStock(item.id, -5)}
                            className="text-[8px] bg-sand-100 hover:bg-sand-200 font-mono font-bold px-1 rounded cursor-pointer"
                            title="Subtract 5 yards"
                          >
                            -5
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-bark-750">
                      ${item.cost.toFixed(2)}/yd
                    </td>
                    <td className="p-3.5">
                      <span className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                        item.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        item.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right pr-4">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-bark-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                        title="Remove textile roll"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Material Sidebar Form */}
      <div className="bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-3xs h-fit animate-fadeIn">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-clay-600" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-clay-700 font-bold">Receiving Dock</span>
        </div>
        <h3 className="text-md font-serif font-light text-bark-950">Add Textile Roll</h3>

        <form onSubmit={handleAddMaterial} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-bark-600 block">Material Name</label>
            <input
              type="text"
              placeholder="e.g. Organic Hemp Crepe"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-bark-600 block">Swatch / Color</label>
            <input
              type="text"
              placeholder="e.g. Sage Green"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-bark-600 block">Roll Stock (Yd)</label>
              <input
                type="number"
                min="1"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-bark-600 block">Cost per Yd ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-bark-600 block">Textile Category</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
            >
              <option value="Fabric Roll">Fabric Roll</option>
              <option value="Premium Lining">Premium Lining</option>
              <option value="Heavy Wool Crepe">Heavy Wool Crepe</option>
              <option value="Lace & Trim">Lace & Trim</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono uppercase text-bark-600 block">Fabric Tags</label>
              <span className="text-[8px] font-mono text-bark-400">Comma-separated</span>
            </div>
            <input
              type="text"
              placeholder="e.g. Organic, Linen, Sustainable"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-3xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Receive Shipment</span>
          </button>
        </form>
      </div>

    </div>
  );
}
