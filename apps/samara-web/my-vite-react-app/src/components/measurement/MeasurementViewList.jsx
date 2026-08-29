import React, { useMemo } from 'react';
import {
  DEFAULT_MEASUREMENTS,
  getMeasurementsForView,
  mergeMeasurementDefinitions,
  normalizeView,
  readMeasurementAdminConfig
} from './measurementAvatarMetadata';

/**
 * Reusable left-hand measurement list.
 * Uses the exact same metadata/view filter as FemaleMeasurementAvatar.
 */
export default function MeasurementViewList({
  view = 'FRONT',
  activeCode,
  onSelect,
  guides = [],
  measurementConfig = null,
  className = ''
}) {
  const resolvedView = normalizeView(view);
  const effectiveConfig = measurementConfig || readMeasurementAdminConfig();

  const definitions = useMemo(
    () => mergeMeasurementDefinitions(DEFAULT_MEASUREMENTS, guides, effectiveConfig),
    [guides, effectiveConfig]
  );

  const measurements = useMemo(
    () =>
      getMeasurementsForView(
        definitions,
        effectiveConfig,
        resolvedView,
        { includeHidden: false, listOnly: true }
      ),
    [definitions, effectiveConfig, resolvedView]
  );

  return (
    <div className={`space-y-1 ${className}`}>
      {measurements.map((measurement) => {
        const active = measurement.code === activeCode;
        return (
          <button
            key={measurement.code}
            type="button"
            onClick={() => onSelect?.(measurement.code)}
            className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
              active
                ? 'border-[#B97957] bg-[#FFF7F1] text-[#3B312A]'
                : 'border-transparent text-[#6F6258] hover:border-[#E7DDD3] hover:bg-[#FBF8F4]'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[8px] font-black ${
                active
                  ? 'bg-[#A65F3F] text-white'
                  : 'bg-[#F1EAE3] text-[#765F50]'
              }`}
            >
              {measurement.marker}
            </span>
            <span className="min-w-0 flex-1 truncate text-[9px] font-bold">
              {measurement.shortLabel || measurement.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
