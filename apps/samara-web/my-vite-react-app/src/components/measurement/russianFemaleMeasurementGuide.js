import { perfectFitMetadata } from '../../config/perfectFitMetadata';

export const RUSSIAN_MEASUREMENT_SOURCE = perfectFitMetadata.measurement.sourceGuides.russianFemale.source;
export const RUSSIAN_MEASUREMENT_GUIDE = perfectFitMetadata.measurement.sourceGuides.russianFemale.rawMeasurements;

const byCode = new Map(
  RUSSIAN_MEASUREMENT_GUIDE.map((item) => [item.normalizedCode, item])
);

export function getRussianMeasurementReference(code) {
  return byCode.get(code) || null;
}

export function getRussianMeasurementInstruction(code) {
  return getRussianMeasurementReference(code)?.descriptionEn || '';
}

export function getRussianGuideStatusSummary() {
  return RUSSIAN_MEASUREMENT_GUIDE.reduce(
    (summary, item) => {
      summary[item.status] = (summary[item.status] || 0) + 1;
      return summary;
    },
    {}
  );
}
