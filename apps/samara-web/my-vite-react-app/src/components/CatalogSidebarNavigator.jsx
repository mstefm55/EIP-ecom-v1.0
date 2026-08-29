import { localizeMetadataTree } from '../lib/localizedMetadata';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import React, { useMemo, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  Shirt,
  UserRound,
  Baby,
  Palette,
  ShoppingBag,
  Star,
  Heart,
  X,
  SlidersHorizontal
} from 'lucide-react';

import {
  CATALOG_AUDIENCES,
  getCategoriesForAudience,
  slugifyCatalogValue
} from '../data/catalogTaxonomy';

const SPECIAL_CHILD_BADGES = {
  'pattern-of-the-day': 'NEW'
};

const normalizeSelectedValues = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || value === 'All') return [];
  return [value];
};

const getGroupIcon = (groupId) => {
  if (groupId === 'women') return Shirt;
  if (groupId === 'men') return UserRound;
  if (groupId === 'kids') return Shirt;
  if (groupId === 'designers') return Palette;
  if (groupId === 'accessories') return ShoppingBag;
  return Shirt;
};

export default function CatalogSidebarNavigator({
  selectedAudience,
  selectedCategory,
  selectedDifficulty = [],
  selectedPriceRanges = [],
  selectedRatings = [],
  selectedDesigner,
  showFavoritesOnly = false,
  designerBrands = [],
  patterns = [],
  onAudienceChange,
  onCategoryChange,
  onCategoryClear,
  onDifficultyChange,
  onPriceRangeChange,
  onRatingChange,
  onFavoritesChange,
  onDesignerChange,
  onResetFilters,
  isCollapsed = false,
  onCollapsedChange
}) {
  const sidebarUi = perfectFitMetadata.componentUi.catalogSidebar;
  const ACCESSORY_CATEGORIES = localizeMetadataTree(sidebarUi.accessoryCategories, 'component.catalogSidebar.accessoryCategories', pfUiT);
  const DIFFICULTY_FILTERS = localizeMetadataTree(sidebarUi.difficultyFilters, 'component.catalogSidebar.difficultyFilters', pfUiT);
  const PRICE_RANGE_FILTERS = localizeMetadataTree(sidebarUi.priceRangeFilters, 'component.catalogSidebar.priceRangeFilters', pfUiT);
  const RATING_FILTERS = localizeMetadataTree(sidebarUi.ratingFilters, 'component.catalogSidebar.ratingFilters', pfUiT);

  const [openGroup, setOpenGroup] = useState(selectedAudience || 'women');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const selectedCategories = normalizeSelectedValues(selectedCategory);
  const selectedDifficulties = normalizeSelectedValues(selectedDifficulty);
  const selectedPrices = normalizeSelectedValues(selectedPriceRanges);
  const selectedRatingValues = normalizeSelectedValues(selectedRatings);
  

  const patternCounts = useMemo(() => {
    const counts = {
      audiences: {},
      categories: {},
      designers: {}
    };

    patterns.forEach((pattern) => {
      const audience = slugifyCatalogValue(pattern.audience || 'women');
      const category = slugifyCatalogValue(pattern.mainCategory || pattern.category || 'dresses');
      const designer = pattern.designerBrand || 'Perfect Fit Bureau';

      counts.audiences[audience] = (counts.audiences[audience] || 0) + 1;
      counts.categories[category] = (counts.categories[category] || 0) + 1;
      counts.designers[designer] = (counts.designers[designer] || 0) + 1;
    });

    return counts;
  }, [patterns]);

  const sidebarGroups = useMemo(() => {
    const audienceGroups = CATALOG_AUDIENCES.map((audience) => ({
      id: audience.id,
      label: audience.label,
      count: patternCounts.audiences[audience.id] || 0,
      children: getCategoriesForAudience(audience.id).map((category) => ({
        id: category.id,
        label: category.label,
        count: patternCounts.categories[category.id] || 0,
        type: 'category'
      }))
    }));

    return [
      ...audienceGroups,
      {
        id: 'designers',
        label: pfUiT('ui.components.catalogsidebarnavigator.designers', {}, 'Designers'),
        count: designerBrands.length,
        children: designerBrands.map((designer) => ({
          id: designer,
          label: designer,
          count: patternCounts.designers[designer] || 0,
          type: 'designer'
        }))
      },
      {
        id: 'accessories',
        label: pfUiT('ui.components.catalogsidebarnavigator.accessories', {}, 'Accessories'),
        count: ACCESSORY_CATEGORIES.reduce(
          (total, category) => total + (patternCounts.categories[category.id] || 0),
          0
        ),
        children: ACCESSORY_CATEGORIES.map((category) => ({
          id: category.id,
          label: category.label,
          count: patternCounts.categories[category.id] || 0,
          type: 'accessory'
        }))
      }
    ];
  }, [designerBrands, patternCounts]);

  const handleGroupClick = (group) => {
  const isAlreadyOpen = openGroup === group.id;

  setOpenGroup(isAlreadyOpen ? '' : group.id);

    if (isAlreadyOpen) return;

  window.setTimeout(() => {
    if (group.id === 'women' || group.id === 'men' || group.id === 'kids') {
      onAudienceChange(group.id);
      onCategoryClear?.();
      onDesignerChange('All');
      return;
    }

    if (group.id === 'designers') {
      onAudienceChange('All');
      onCategoryClear?.();
      return;
    }

    if (group.id === 'accessories') {
      onAudienceChange('All');
      onCategoryChange('accessories');
      onDesignerChange('All');
    }
  }, 180);
};

  const handleChildClick = (group, child) => {
    if (child.type === 'designer') {
      onAudienceChange('All');
      onCategoryClear?.();
      onDesignerChange(child.id);
      return;
    }

    if (child.type === 'accessory') {
      onAudienceChange('All');
      onCategoryChange(child.id);
      onDesignerChange('All');
      return;
    }

    onAudienceChange(group.id);
    onCategoryChange(child.id);
    onDesignerChange('All');
  };

  const sidebarContent = (mobile = false) => (
      <div className={`flex flex-col overflow-hidden border border-[#eadfd6] bg-[#fbf6f0] shadow-[0_18px_45px_rgba(52,36,27,0.08)] ${
        mobile
          ? 'h-full rounded-none border-y-0 border-l-0'
          : 'max-h-[calc(100vh-132px)] rounded-[18px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
      }`}>
        <div className="flex items-center justify-between gap-3 border-b border-[#eadfd6] bg-[#fffaf7] px-4 py-4">
          {(!isCollapsed || mobile) && (
            <h3 className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#201813]">{pfUiT("ui.components.catalogsidebarnavigator.ad4cf2d4d6")}</h3>
          )}

          {mobile ? (
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-white text-[#4d3d35] shadow-sm transition-all hover:border-[#ba6446] hover:text-[#ba6446]"
              aria-label={pfUiT("ui.components.catalogsidebarnavigator.0938b2a20b")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCollapsedChange?.(!isCollapsed)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-white text-[#4d3d35] shadow-sm transition-all hover:border-[#ba6446] hover:text-[#ba6446]"
              title={isCollapsed ? 'Expand catalogue menu' : 'Collapse catalogue menu'}
            >
              <ChevronsLeft
                className={`h-4 w-4 transition-transform duration-300 ${
                  isCollapsed ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}
        </div>

        <div className="catalog-sidebar-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2">
          {(!isCollapsed || mobile) && (
            <div className="space-y-2 rounded-[14px] border border-[#eadfd6] bg-white/70 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b6b5c]">{pfUiT("ui.components.catalogsidebarnavigator.9d55c61dd2")}</span>
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a65a37] hover:text-[#6d3d28]"
                >{pfUiT("ui.components.catalogsidebarnavigator.b236842427")}</button>
              </div>

              {selectedCategories.length === 0 &&
              selectedDifficulties.length === 0 &&
              selectedPrices.length === 0 &&
              selectedRatingValues.length === 0 &&
              selectedDesigner === 'All' &&
              !showFavoritesOnly ? (
                <p className="text-[11px] leading-relaxed text-[#7d675d]">{pfUiT("ui.components.catalogsidebarnavigator.d47c0f42b8")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategories.map((category) => (
                    <button
                      key={`cat-${category}`}
                      type="button"
                      onClick={() => onCategoryChange(category)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#f5eadf] px-2 py-1 text-[10px] font-semibold text-[#8f4f31]"
                    >
                      {category}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                  {selectedDifficulties.map((difficulty) => (
                    <button
                      key={`diff-${difficulty}`}
                      type="button"
                      onClick={() => onDifficultyChange?.(difficulty)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#eef8ef] px-2 py-1 text-[10px] font-semibold text-[#3f7a52]"
                    >
                      {difficulty}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                  {selectedPrices.map((priceRange) => {
                    const label = PRICE_RANGE_FILTERS.find((item) => item.id === priceRange)?.label || priceRange;
                    return (
                      <button
                        key={`price-${priceRange}`}
                        type="button"
                        onClick={() => onPriceRangeChange?.(priceRange)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#f7f1e9] px-2 py-1 text-[10px] font-semibold text-[#75614f]"
                      >
                        {label}
                        <X className="h-2.5 w-2.5" />
                      </button>
                    );
                  })}
                  {selectedRatingValues.map((rating) => {
                    const label = RATING_FILTERS.find((item) => item.id === rating)?.label || rating;
                    return (
                      <button
                        key={`rating-${rating}`}
                        type="button"
                        onClick={() => onRatingChange?.(rating)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#fff6dc] px-2 py-1 text-[10px] font-semibold text-[#966b10]"
                      >
                        {label}
                        <X className="h-2.5 w-2.5" />
                      </button>
                    );
                  })}
                  {showFavoritesOnly && (
                    <button
                      type="button"
                      onClick={() => onFavoritesChange?.(false)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#fff1f3] px-2 py-1 text-[10px] font-semibold text-[#b34458]"
                    >{pfUiT("ui.components.catalogsidebarnavigator.8070309070")}<X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {sidebarGroups.map((group) => {
            const Icon = getGroupIcon(group.id);
            const isOpen = openGroup === group.id;

            const isGroupActive =
              selectedAudience === group.id ||
              (group.id === 'designers' && selectedDesigner !== 'All') ||
              (group.id === 'accessories' && selectedCategories.length > 0);

            return (
              <div
                key={group.id}
                className={`overflow-hidden rounded-[14px] border transition-all ${
                  isOpen
                    ? 'border-[#ead9ce] bg-white'
                    : 'border-[#eee2d9] bg-white/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleGroupClick(group)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-all ${
                    isOpen || isGroupActive
                      ? 'bg-[#f4e8dc] text-[#3a2a21]'
                      : 'bg-white text-[#3a2a21] hover:bg-[#f8efe8]'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isOpen || isGroupActive
                        ? 'text-[#a65a37]'
                        : 'text-[#4f4038]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  {(!isCollapsed || mobile) && (
                    <>
                      <span className="min-w-0 flex-1 text-[13px] font-bold">
                        {group.label}
                      </span>

                      <span className="rounded-full border border-[#eadfd6] bg-[#fffaf7] px-2.5 py-1 text-[11px] font-mono text-[#9b7566]">
                        {group.count}
                      </span>

                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-[#6d554b]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#6d554b]" />
                      )}
                    </>
                  )}
                </button>

                <AnimatePresence initial={false}>
  {(!isCollapsed || mobile) && isOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.18, ease: 'easeOut' }
      }}
      className="overflow-hidden bg-[#fffdfb]"
    >
      <motion.div
        initial={{ y: -6 }}
        animate={{ y: 0 }}
        exit={{ y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="px-3 py-2"
      >
        <div className="space-y-0.5">
          {group.children.map((child) => {
            const isSelectedCategory =
              selectedCategories
                .map(slugifyCatalogValue)
                .includes(slugifyCatalogValue(child.id));

            const isSelectedDesigner =
              selectedDesigner !== 'All' && selectedDesigner === child.id;

            const isSelected = isSelectedCategory || isSelectedDesigner;
            const badge = SPECIAL_CHILD_BADGES[child.id];

            return (
              <button
                key={child.id}
                type="button"
                onClick={() => handleChildClick(group, child)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#f5eadf] text-[#a65a37]'
                    : 'text-[#3f312a] hover:bg-[#faf1ea]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full border transition-all duration-200 ${
                    isSelected
                      ? 'border-[#b36a42] bg-[#b36a42]'
                      : 'border-[#d8c8bc] bg-transparent'
                  }`}
                />

                <span className="min-w-0 flex-1 truncate font-medium">
                  {child.label}
                </span>

                {badge && (
                  <span className="rounded-md border border-[#ead4c6] bg-[#fff7ef] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#a65a37]">
                    {badge}
                  </span>
                )}

                <span className="text-[11px] font-mono text-[#9a8479]">
                  {child.count}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
              </div>
            );
          })}

          {(!isCollapsed || mobile) && (
            <div className="overflow-hidden rounded-[14px] border border-[#eee2d9] bg-white/70">
              <div className="border-b border-[#eadfd6] bg-[#fffaf7] px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b6b5c]">{pfUiT("ui.components.catalogsidebarnavigator.ccdee4ca23")}</span>
              </div>
              <div className="space-y-0 px-3 py-2">
              <FilterButtonGroup
                title={pfUiT("ui.components.catalogsidebarnavigator.46b5412972")}
                options={DIFFICULTY_FILTERS}
                selectedValues={selectedDifficulties}
                onToggle={onDifficultyChange}
              />
              <FilterButtonGroup
                title={pfUiT("ui.components.catalogsidebarnavigator.452b27d000")}
                options={PRICE_RANGE_FILTERS}
                selectedValues={selectedPrices}
                onToggle={onPriceRangeChange}
              />
              <FilterButtonGroup
                title={pfUiT("ui.components.catalogsidebarnavigator.90a361c580")}
                options={RATING_FILTERS}
                selectedValues={selectedRatingValues}
                onToggle={onRatingChange}
                icon={<Star className="h-3.5 w-3.5 text-[#b8860b]" />}
              />
              <button
                type="button"
                onClick={() => onFavoritesChange?.(!showFavoritesOnly)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[12px] font-semibold transition-all ${
                  showFavoritesOnly
                    ? 'border-[#f2cad2] bg-[#fff1f3] text-[#b34458]'
                    : 'border-[#eadfd6] bg-[#fffaf7] text-[#4d3d35] hover:border-[#d9c4b6]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Heart className={`h-3.5 w-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />{pfUiT("ui.components.catalogsidebarnavigator.aba4d2e30a")}</span>
                <span className="text-[10px] uppercase tracking-[0.08em]">
                  {showFavoritesOnly ? 'On' : 'Off'}
                </span>
              </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );

  return (
    <>
      {/* Mobile trigger: sidebar becomes an off-canvas filter drawer. */}
      <div className="w-full lg:hidden" id="catalog-mobile-filter-trigger">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex h-11 w-full items-center justify-between rounded-[14px] border border-[#eadfd6] bg-[#fffaf7] px-4 text-[#3a2a21] shadow-[0_8px_24px_rgba(52,36,27,0.06)]"
          aria-expanded={isMobileOpen}
          aria-controls="catalog-mobile-filter-drawer"
        >
          <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em]">
            <SlidersHorizontal className="h-4 w-4 text-[#a65a37]" />{pfUiT("ui.components.catalogsidebarnavigator.cfe6f6dfad")}</span>
          <span className="text-[10px] font-semibold text-[#8b6b5c]">
            {selectedCategories.length +
              selectedDifficulties.length +
              selectedPrices.length +
              selectedRatingValues.length +
              (selectedDesigner !== 'All' ? 1 : 0) +
              (showFavoritesOnly ? 1 : 0)}
            {' '}active
          </span>
        </button>
      </div>

      {/* Desktop sidebar: original sticky/collapsible behavior is preserved. */}
      <aside
        className={`sticky top-[112px] hidden self-start transition-[width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
          isCollapsed ? 'w-[76px]' : 'w-[292px]'
        }`}
        id="catalog-sidebar-navigator"
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-[120] lg:hidden"
            id="catalog-mobile-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={pfUiT("ui.components.catalogsidebarnavigator.8828f254f6")}
          >
            <motion.button
              type="button"
              aria-label={pfUiT("ui.components.catalogsidebarnavigator.0938b2a20b")}
              className="absolute inset-0 bg-[#201813]/35 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsMobileOpen(false)}
            />

            <motion.div
              className="absolute inset-y-0 left-0 w-[min(88vw,360px)] bg-[#fbf6f0] shadow-[24px_0_70px_rgba(32,24,19,0.22)]"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              {sidebarContent(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function FilterButtonGroup({ title, options, selectedValues, onToggle, icon = null }) {
  return (
    <div className="space-y-1.5 border-b border-[#f0e5dd] py-2.5 first:pt-0 last:border-b-0 last:pb-1">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#80665a]">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle?.(option.id)}
              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-all ${
                isSelected
                  ? 'border-[#b36a42] bg-[#f5eadf] text-[#8f4f31]'
                  : 'border-[#eadfd6] bg-[#fffaf7] text-[#5f4d44] hover:border-[#d5bdae]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
