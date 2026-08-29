import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  GripHorizontal,
  Info,
  Maximize2,
  Minimize2,
  Minus,
  Ruler,
  TableProperties,
  X
} from 'lucide-react';
import { createPortal } from 'react-dom';

import { MEASUREMENT_POSITIONS } from '../data_positions.js';
import { createFindMySizeTranslator } from './findMySizeMetadata';
import {
  FLOATING_TOOL_LAUNCHER,
  clampFloatingToolPosition,
  normalizeFloatingToolLayout,
  persistFloatingToolLayout
} from '../lib/floatingToolLayout';
import { UI_LAYERS } from '../lib/uiLayers';
import { clientPreferences } from '../lib/clientPreferences';

const STORAGE_KEY = 'perfectfit_size_conversion_widget_layout_v1';
const LAUNCHER_STORAGE_KEY = 'perfectfit_size_conversion_launcher_layout_v1';

function readStoredLayout() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = clientPreferences.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getInitialPanelState() {
  const stored = readStoredLayout();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  const width = Math.min(
    Math.max(560, Number(stored?.width) || 760),
    Math.max(560, viewportWidth - 32)
  );
  const height = Math.min(
    Math.max(420, Number(stored?.height) || 590),
    Math.max(420, viewportHeight - 32)
  );

  return {
    x: Number.isFinite(Number(stored?.x))
      ? Number(stored.x)
      : Math.max(24, viewportWidth - width - 36),
    y: Number.isFinite(Number(stored?.y)) ? Number(stored.y) : 96,
    width,
    height,
    minimized: false,
    maximized: false,
    restore: null
  };
}

function persistLayout(panel) {
  if (typeof window === 'undefined') return;

  try {
    clientPreferences.setItem(
      STORAGE_KEY,
      JSON.stringify({
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height
      })
    );
  } catch {}
}

function parseRangeCm(range) {
  const clean = String(range || '').replace(/cm/gi, '').trim();
  const values = clean
    .split('-')
    .map((value) => Number.parseFloat(value.trim()));

  if (values.length !== 2 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return { min: values[0], max: values[1] };
}

function getMatchingRow(position, valueCm) {
  if (!position?.matrix?.length || !Number.isFinite(Number(valueCm))) {
    return null;
  }

  let closest = position.matrix[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  position.matrix.forEach((row) => {
    const range = parseRangeCm(row.range);
    if (!range) return;

    if (valueCm >= range.min && valueCm <= range.max) {
      closest = row;
      closestDistance = -1;
      return;
    }

    if (closestDistance === -1) return;

    const midpoint = (range.min + range.max) / 2;
    const distance = Math.abs(midpoint - valueCm);

    if (distance < closestDistance) {
      closestDistance = distance;
      closest = row;
    }
  });

  return closest;
}

function formatCustomerMeasurement(valueCm, unit, notEnteredLabel) {
  if (!Number.isFinite(Number(valueCm))) return notEnteredLabel;

  if (unit === 'in') {
    return `${(Number(valueCm) / 2.54).toFixed(1).replace(/\.0$/, '')} in`;
  }

  return `${Number(valueCm).toFixed(1).replace(/\.0$/, '')} cm`;
}

function formatRangeForUnit(rowRange, unit) {
  if (unit !== 'in') return String(rowRange || '');

  const parsed = parseRangeCm(rowRange);
  if (!parsed) return String(rowRange || '');

  return `${(parsed.min / 2.54).toFixed(1)}–${(parsed.max / 2.54).toFixed(1)} in`;
}

function getRussianSize(row) {
  // DB-ready behavior: an explicit RU value always wins. Until RU references
  // are supplied by metadata/DB, use the standard women’s fallback relation
  // used by this matrix: RU = EU + 8 (e.g. EU 36 -> RU 44).
  if (row?.ru !== undefined && row?.ru !== null && String(row.ru).trim() !== '') {
    return row.ru;
  }

  const eu = Number.parseInt(String(row?.eu ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(eu) ? eu + 8 : '—';
}

function clampDesktopPanel(panel) {
  if (typeof window === 'undefined') return panel;

  const width = Math.min(panel.width, Math.max(560, window.innerWidth - 24));
  const height = Math.min(panel.height, Math.max(420, window.innerHeight - 24));
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - 72);

  return {
    ...panel,
    width,
    height,
    x: Math.min(Math.max(8, panel.x), maxX),
    y: Math.min(Math.max(8, panel.y), maxY)
  };
}

export default function SizeConversionMatrixWidget({
  open = false,
  onOpenChange,
  activeMeasurementCode = 'BUST',
  measurementGuides = [],
  measurementsCm = {},
  unit = 'cm',
  onSelectMeasurement,
  locale = ''
}) {
  const t = useMemo(() => createFindMySizeTranslator(locale), [locale]);
  const panelRef = useRef(null);
  const interactionRef = useRef(null);
  const launcherRef = useRef(null);
  const launcherDragRef = useRef(null);
  const [panel, setPanel] = useState(getInitialPanelState);
  const [launcherPosition, setLauncherPosition] = useState(() => {
    const layout = normalizeFloatingToolLayout(
      LAUNCHER_STORAGE_KEY,
      'sizeConversion',
      false
    );
    return {
      x: layout.x,
      y: layout.y
    };
  });
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  const legacyPositionsById = useMemo(() => {
    const map = new Map();
    (MEASUREMENT_POSITIONS || []).forEach((position) => {
      if (position?.id !== undefined && position?.id !== null) {
        map.set(Number(position.id), position);
      }
    });
    return map;
  }, []);

  // The selector is driven by the current measurement metadata, not by the
  // old seven-position matrix list. Measurements without a conversion matrix
  // still appear and show the existing “no matrix” state when selected.
  const matrixEntries = useMemo(() => {
    const usedLegacyIds = new Set();

    const dynamicEntries = (measurementGuides || []).map((guide, index) => {
      const legacyId = Number(guide?.legacyId);
      const legacyPosition = Number.isFinite(legacyId)
        ? legacyPositionsById.get(legacyId) || null
        : null;

      if (legacyPosition) usedLegacyIds.add(Number(legacyPosition.id));

      return {
        key: `code:${guide.code}`,
        code: guide.code,
        id: legacyPosition?.id ?? null,
        legacyId: legacyPosition?.id ?? (Number.isFinite(legacyId) ? legacyId : null),
        marker: guide.displayMarker || guide.marker || '',
        label: guide.label || guide.shortLabel || guide.code,
        shortLabel: guide.shortLabel || guide.label || guide.code,
        instruction: guide.instruction || legacyPosition?.description || '',
        tapeHelp: guide.tapeHelp || legacyPosition?.tapeHelp || '',
        matrix: Array.isArray(legacyPosition?.matrix) ? legacyPosition.matrix : [],
        guide,
        sourcePosition: legacyPosition,
        order: Number.isFinite(Number(guide?.order)) ? Number(guide.order) : index + 1
      };
    });

    // Preserve any historical conversion position that has not yet been
    // mapped to a semantic measurement code.
    const legacyOnly = (MEASUREMENT_POSITIONS || [])
      .filter((position) => Array.isArray(position?.matrix) && position.matrix.length)
      .filter((position) => !usedLegacyIds.has(Number(position.id)))
      .map((position, index) => ({
        key: `legacy:${position.id}`,
        code: null,
        id: position.id,
        legacyId: position.id,
        marker: '',
        label: position.name || `Measurement ${position.id}`,
        shortLabel: position.name || `Measurement ${position.id}`,
        instruction: position.description || '',
        tapeHelp: position.tapeHelp || '',
        matrix: position.matrix,
        guide: null,
        sourcePosition: position,
        order: 1000 + index
      }));

    return [...dynamicEntries, ...legacyOnly].sort((a, b) => a.order - b.order);
  }, [legacyPositionsById, measurementGuides]);

  const initialEntryKey = useMemo(() => {
    const active = matrixEntries.find((entry) => entry.code === activeMeasurementCode);
    if (active) return active.key;
    const firstWithMatrix = matrixEntries.find((entry) => entry.matrix.length);
    return firstWithMatrix?.key || matrixEntries[0]?.key || '';
  }, [activeMeasurementCode, matrixEntries]);

  const [selectedEntryKey, setSelectedEntryKey] = useState(initialEntryKey);

  useEffect(() => {
    const active = matrixEntries.find((entry) => entry.code === activeMeasurementCode);
    if (active) setSelectedEntryKey(active.key);
  }, [activeMeasurementCode, matrixEntries]);

  useEffect(() => {
    if (matrixEntries.some((entry) => entry.key === selectedEntryKey)) return;
    setSelectedEntryKey(initialEntryKey);
  }, [initialEntryKey, matrixEntries, selectedEntryKey]);

  useEffect(() => {
    const handleViewport = () => {
      const isCompact = window.innerWidth < 768;
      setCompact(isCompact);
      if (!isCompact) {
        setPanel((current) => clampDesktopPanel(current));
      }
    };

    window.addEventListener('resize', handleViewport);
    return () => window.removeEventListener('resize', handleViewport);
  }, []);

  useEffect(() => {
    const handleMove = (event) => {
      const interaction = interactionRef.current;
      if (!interaction || compact) return;

      if (interaction.mode === 'move') {
        setPanel((current) => {
          const width = current.width;
          const maxX = Math.max(8, window.innerWidth - width - 8);
          const maxY = Math.max(8, window.innerHeight - 72);
          const next = {
            ...current,
            x: Math.min(
              Math.max(8, interaction.startLeft + event.clientX - interaction.startX),
              maxX
            ),
            y: Math.min(
              Math.max(8, interaction.startTop + event.clientY - interaction.startY),
              maxY
            )
          };
          persistLayout(next);
          return next;
        });
        return;
      }

      if (interaction.mode === 'resize') {
        setPanel((current) => {
          const maxWidth = Math.max(560, window.innerWidth - current.x - 12);
          const maxHeight = Math.max(420, window.innerHeight - current.y - 12);
          const next = {
            ...current,
            width: Math.min(
              maxWidth,
              Math.max(560, interaction.startWidth + event.clientX - interaction.startX)
            ),
            height: Math.min(
              maxHeight,
              Math.max(420, interaction.startHeight + event.clientY - interaction.startY)
            )
          };
          persistLayout(next);
          return next;
        });
      }
    };

    const handleUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [compact]);

  useEffect(() => {
    const handleMove = (event) => {
      const drag = launcherDragRef.current;
      if (!drag) return;

      const next = clampFloatingToolPosition({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY
      });

      setLauncherPosition(next);
    };

    const handleUp = () => {
      if (!launcherDragRef.current) return;
      launcherDragRef.current = null;
      setLauncherPosition((current) => {
        persistFloatingToolLayout(LAUNCHER_STORAGE_KEY, {
          ...current,
          compact: false
        });
        return current;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setLauncherPosition((current) => {
        const next = clampFloatingToolPosition(current);
        persistFloatingToolLayout(LAUNCHER_STORAGE_KEY, {
          ...next,
          compact: false
        });
        return next;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (typeof document === 'undefined') return null;

  const selectedEntry =
    matrixEntries.find((entry) => entry.key === selectedEntryKey) ||
    matrixEntries[0] ||
    null;
  const selectedGuide = selectedEntry?.guide || null;
  const customerValueCm = selectedEntry?.code
    ? Number(measurementsCm?.[selectedEntry.code])
    : Number.NaN;
  const matchingRow = getMatchingRow(selectedEntry, customerValueCm);
  const selectedMeasurementLabel = selectedEntry?.label || '';

  const selectEntry = (rawKey) => {
    const next = matrixEntries.find((entry) => entry.key === rawKey);
    if (!next) return;
    setSelectedEntryKey(next.key);
    if (next.code) onSelectMeasurement?.(next.code);
  };

  const beginMove = (event) => {
    if (compact || panel.maximized || event.button !== 0) return;
    if (event.target.closest('button, input, select, textarea, a')) return;

    interactionRef.current = {
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startLeft: panel.x,
      startTop: panel.y
    };
  };

  const beginLauncherDrag = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    launcherDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: launcherPosition.x,
      originY: launcherPosition.y
    };
  };

  const beginResize = (event) => {
    if (compact || panel.maximized) return;
    event.preventDefault();
    event.stopPropagation();

    interactionRef.current = {
      mode: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panel.width,
      startHeight: panel.height
    };
  };

  const toggleMaximize = () => {
    if (compact) return;

    setPanel((current) => {
      if (current.maximized) {
        const restore = current.restore || getInitialPanelState();
        const next = clampDesktopPanel({
          ...current,
          maximized: false,
          restore: null,
          x: restore.x,
          y: restore.y,
          width: restore.width,
          height: restore.height
        });
        persistLayout(next);
        return next;
      }

      return {
        ...current,
        maximized: true,
        restore: {
          x: current.x,
          y: current.y,
          width: current.width,
          height: current.height
        },
        x: 12,
        y: 12,
        width: Math.max(560, window.innerWidth - 24),
        height: Math.max(420, window.innerHeight - 24)
      };
    });
  };

  const panelStyle = compact
    ? { zIndex: UI_LAYERS.utilityPanel }
    : {
        left: `${panel.x}px`,
        top: `${panel.y}px`,
        width: `${panel.width}px`,
        height: `${panel.height}px`,
        zIndex: UI_LAYERS.utilityPanel
      };

  const launcher = (
    <button
      ref={launcherRef}
      type="button"
      onClick={() => {
        setPanel((current) => ({ ...current, minimized: false }));
        onOpenChange?.(true);
      }}
      className="fixed inline-flex items-center gap-2 rounded-full border border-[#CFAF98] bg-[#2E241C] px-3.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_36px_rgba(46,36,28,0.24)] transition hover:-translate-y-0.5 hover:bg-[#44342A] focus:outline-none focus:ring-2 focus:ring-[#B77A59]/40"
      style={{
        left: launcherPosition.x,
        top: launcherPosition.y,
        width: FLOATING_TOOL_LAUNCHER.width,
        height: FLOATING_TOOL_LAUNCHER.height,
        zIndex: UI_LAYERS.floatingLauncher
      }}
      aria-label={t('conversion.openAria')}
      title={t('conversion.openTitle')}
    >
      <span
        onPointerDown={beginLauncherDrag}
        className="flex h-full items-center cursor-grab text-white/50 hover:text-white/85 active:cursor-grabbing"
        aria-hidden="true"
      >
        <GripHorizontal className="h-3.5 w-3.5 shrink-0" />
      </span>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
        <TableProperties className="h-4 w-4 text-[#E6B58F]" />
      </span>
      <span className="truncate">{t('conversion.launcher')}</span>
    </button>
  );

  const content = !open || panel.minimized ? launcher : (
    <section
      ref={panelRef}
      style={panelStyle}
      className={
        compact
          ? 'fixed inset-x-2 bottom-2 top-[12%] flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#D9CBBE] bg-[#FFFDF9] shadow-[0_28px_80px_rgba(45,34,25,0.28)]'
          : 'fixed flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-[#D9CBBE] bg-[#FFFDF9] shadow-[0_28px_80px_rgba(45,34,25,0.28)]'
      }
      aria-label={t('conversion.panelAria')}
    >
      <header
        onPointerDown={beginMove}
        className={`flex shrink-0 items-center justify-between gap-3 border-b border-[#E6DBD0] bg-[linear-gradient(135deg,#FFFDF9_0%,#F7EFE7_100%)] px-4 py-3 ${!compact && !panel.maximized ? 'cursor-move' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[#DDC9B9] bg-white text-[#9A5B3F]">
            <TableProperties className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-serif text-[16px] font-semibold text-[#2E241C]">{t('conversion.title')}</h3>
              {!compact && <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-[#B29E8B]" />}
            </div>
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.13em] text-[#8A7564]">
              {(() => { const value = t('conversion.subtitle'); return /(^|\W)RU($|\W)/i.test(value) ? value : `${value} · RU`; })()}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPanel((current) => ({ ...current, minimized: true }))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-transparent text-[#74675D] hover:border-[#DED2C7] hover:bg-white"
            title={t('conversion.minimize')}
            aria-label={t('conversion.minimize')}
          >
            <Minus className="h-4 w-4" />
          </button>

          {!compact && (
            <button
              type="button"
              onClick={toggleMaximize}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-transparent text-[#74675D] hover:border-[#DED2C7] hover:bg-white"
              title={panel.maximized ? t('conversion.restore') : t('conversion.maximize')}
              aria-label={panel.maximized ? t('conversion.restore') : t('conversion.maximize')}
            >
              {panel.maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-transparent text-[#74675D] hover:border-[#E5CFC3] hover:bg-[#FFF3EE] hover:text-[#9C4F35]"
            title={t('conversion.close')}
            aria-label={t('conversion.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-[#ECE3DA] bg-[#FBF8F4] px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-end">
          <label className="block min-w-0 space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#806D5E]">{t('conversion.measurementPoint')}</span>
            <div className="relative">
              <select
                value={selectedEntry?.key || ''}
                onChange={(event) => selectEntry(event.target.value)}
                className="h-10 w-full appearance-none rounded-[10px] border border-[#DCCFC2] bg-white px-3 pr-9 text-sm font-semibold text-[#342B25] outline-none focus:border-[#B47A59] focus:ring-1 focus:ring-[#B47A59]/20"
              >
                {matrixEntries.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.marker ? `${entry.marker} · ` : ''}{entry.label}{entry.matrix.length ? '' : ' · no matrix'}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A7564]" />
            </div>
          </label>

          <div className="rounded-[10px] border border-[#DDD1C4] bg-white px-3 py-2">
            <span className="block text-[8px] font-black uppercase tracking-[0.13em] text-[#8B7767]">{t('conversion.yourMeasurement')}</span>
            <span className="mt-0.5 block text-sm font-semibold text-[#3A2F28]">
              {formatCustomerMeasurement(customerValueCm, unit, t('conversion.notEntered'))}
            </span>
          </div>
        </div>

        {selectedEntry && (
          <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-[#E8DDD2] bg-white/80 px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A65F3F]" />
            <div className="min-w-0 text-[10px] leading-relaxed text-[#6F6258]">
              <span>{selectedEntry.instruction}</span>
              {selectedEntry.tapeHelp && (
                <span className="ml-1 font-semibold text-[#8C5A40]">{selectedEntry.tapeHelp}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {selectedEntry?.matrix?.length ? (
          <table className="w-full min-w-[760px] border-collapse text-left text-[11px] text-[#554B43]">
            <thead className="sticky top-0 z-10 border-b border-[#E6DDD4] bg-[#F8F4EF] text-[8px] font-black uppercase tracking-[0.14em] text-[#806F61] shadow-[0_1px_0_rgba(227,216,205,0.8)]">
              <tr>
                <th className="px-4 py-3">{t('conversion.size')}</th>
                <th className="px-4 py-3">{selectedMeasurementLabel}</th>
                <th className="px-3 py-3 text-center">EU</th>
                <th className="px-3 py-3 text-center">UK</th>
                <th className="px-3 py-3 text-center">US</th>
                <th className="px-3 py-3 text-center">FR</th>
                <th className="px-3 py-3 text-center">RU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE6DE]">
              {selectedEntry.matrix.map((row) => {
                const matched = matchingRow?.size === row.size;
                return (
                  <tr
                    key={`${selectedEntry.key}-${row.size}`}
                    className={matched ? 'bg-[#FFF0E6] font-semibold text-[#7E442F]' : 'bg-white hover:bg-[#FCF9F5]'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={matched ? 'font-black text-[#8D4A31]' : 'font-semibold text-[#3E342D]'}>{row.size}</span>
                        {matched && (
                          <span className="rounded-full bg-[#A65F3F] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.09em] text-white">{t('conversion.matched')}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className="block">{unit === 'in' ? formatRangeForUnit(row.range, 'in') : row.range}</span>
                      {unit === 'in' && <span className="mt-0.5 block text-[8px] text-[#9A8B80]">{row.range}</span>}
                    </td>
                    <td className="px-3 py-3 text-center font-mono">{row.eu}</td>
                    <td className="px-3 py-3 text-center font-mono">{row.uk}</td>
                    <td className="px-3 py-3 text-center font-mono">{row.us}</td>
                    <td className="px-3 py-3 text-center font-mono">{row.fr}</td>
                    <td className="px-3 py-3 text-center font-mono">{getRussianSize(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex h-full min-h-[260px] items-center justify-center p-6 text-center">
            <div>
              <Ruler className="mx-auto h-6 w-6 text-[#B19B88]" />
              <p className="mt-2 text-sm font-semibold text-[#4B4038]">{t('conversion.empty')}</p>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-[#E8DED4] bg-[#FBF8F4] px-4 py-2.5 text-[9px] leading-relaxed text-[#796C62]">
        {t('conversion.footer')}
      </footer>

      {!compact && !panel.maximized && (
        <button
          type="button"
          onPointerDown={beginResize}
          className="absolute bottom-0 right-0 h-7 w-7 cursor-nwse-resize rounded-tl-[12px]"
          aria-label={t('conversion.resize')}
          title={t('conversion.resize')}
        >
          <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b-2 border-r-2 border-[#A89380]" />
        </button>
      )}
    </section>
  );

  return createPortal(content, document.body);
}
