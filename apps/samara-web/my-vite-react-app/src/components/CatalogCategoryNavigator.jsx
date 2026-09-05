import React from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import {
  CATALOG_AUDIENCES,
  getCategoriesForAudience
} from '../data/catalogTaxonomy';
import { Layers, UserRound, X } from 'lucide-react';

export default function CatalogCategoryNavigator({
  selectedAudience,
  selectedCategory,
  selectedDesigner,
  designerBrands = [],
  onAudienceChange,
  onCategoryChange,
  onDesignerChange,
  onResetFilters
}) {
  const activeAudience = CATALOG_AUDIENCES.find(
    (audience) => audience.id === selectedAudience
  );
  const activeCategories = getCategoriesForAudience(selectedAudience);

  return (
    <section
      className="bg-[#FAF8F5] border border-sand-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-3xs"
      id="catalog-category-navigator"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b border-sand-150 pb-4">
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-clay-705 font-bold">{pfUiT("ui.components.catalogcategorynavigator.7ab1e966f4")}</span>

          <h3 className="text-xl font-serif font-semibold text-bark-950">{pfUiT("ui.components.catalogcategorynavigator.081f6d45dc")}</h3>

          <p className="text-xs text-bark-500 max-w-2xl leading-relaxed">{pfUiT("ui.components.catalogcategorynavigator.487ec07273")}</p>
        </div>

        <button
          type="button"
          onClick={onResetFilters}
          className="self-start bg-white hover:bg-sand-100 text-bark-700 border border-sand-250 text-[10px] font-bold uppercase px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />{pfUiT("ui.components.catalogcategorynavigator.562906170e")}</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase font-bold text-bark-500">
            <Layers className="w-3.5 h-3.5 text-clay-605" />{pfUiT("ui.components.catalogcategorynavigator.c9f9fea586")}</div>

          <div className="space-y-2">
            {CATALOG_AUDIENCES.map((audience) => (
              <button
                key={audience.id}
                type="button"
                onClick={() => {
                  onAudienceChange(audience.id);
                  onCategoryChange('All');
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                  selectedAudience === audience.id
                    ? 'bg-white border-clay-405 text-clay-805 shadow-sm'
                    : 'bg-sand-50/60 border-sand-200 text-bark-650 hover:bg-white'
                }`}
              >
                <strong className="block text-sm font-serif">
                  {audience.label}
                </strong>
                <span className="block text-[10px] text-bark-500 mt-0.5">
                  {audience.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-mono uppercase font-bold text-bark-500">
              {activeAudience?.label || 'All'} subcategories
            </div>

            <button
              type="button"
              onClick={() => onCategoryChange('All')}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                selectedCategory === 'All'
                  ? 'bg-clay-605 text-white border-clay-605'
                  : 'bg-white text-bark-500 border-sand-200 hover:border-clay-400'
              }`}
            >{pfUiT("ui.components.catalogcategorynavigator.2401a85bd4")}</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {activeCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategoryChange(category.id)}
                className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedCategory === category.id
                    ? 'bg-clay-605 text-white border-clay-605 shadow-sm'
                    : 'bg-white text-bark-700 border-sand-200 hover:border-clay-400 hover:text-clay-800'
                }`}
              >
                <span className="text-[11px] font-bold">
                  {category.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase font-bold text-bark-500">
            <UserRound className="w-3.5 h-3.5 text-clay-605" />{pfUiT("ui.components.catalogcategorynavigator.aa9194cba2")}</div>

          <select
            value={selectedDesigner}
            onChange={(e) => onDesignerChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-sand-250 rounded-xl text-xs text-bark-800 focus:ring-1 focus:ring-clay-500 focus:border-clay-500"
          >
            <option value="All">{pfUiT("ui.components.catalogcategorynavigator.a5c670f7b4")}</option>
            {designerBrands.map((designer) => (
              <option key={designer} value={designer}>
                {designer}
              </option>
            ))}
          </select>

          <div className="bg-white border border-sand-200 rounded-xl p-3 text-[10px] text-bark-500 leading-relaxed">{pfUiT("ui.components.catalogcategorynavigator.7bbc62470b")}<strong className="block text-bark-850 mt-1">
              {activeAudience?.label || 'All'} / {selectedCategory}
            </strong>
            <span className="block mt-1">
              Designer: {selectedDesigner}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
