import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Info,
  Ruler,
  RotateCcw,
  ShieldCheck,
  TableProperties,
  X
} from 'lucide-react';

import { MASTER_SIZING_TABLE } from '../data.js';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { clientPreferences } from '../lib/clientPreferences';
import { WORKSPACE_PRESENTATION_UPDATED_EVENT } from '../lib/workspaceProductPresentation';
import { getPreferredSizeReference } from '../lib/measurementChart';
import SizeConversionMatrixWidget from './SizeConversionMatrixWidget';
import FemaleMeasurementAvatar from './FemaleMeasurementAvatar';
import {
  DEFAULT_MEASUREMENTS,
  getMeasurementInputSpec,
  mergeMeasurementDefinitions,
  readMeasurementAdminConfig
} from './measurement/measurementAvatarMetadata';
import { getAvatarAreaMeasurementsForView } from './measurement/avatarAreaMetadata';
import {
  AVATAR_AGE_GROUPS,
  AVATAR_GENDERS,
  getAvatarProfile,
  getMeasurementProfileLabel,
  getMeasurementProfileShortLabel,
  resolveAvatarProfileId
} from './measurement/avatarProfiles';
import {
  createFindMySizeTranslator,
  getFindMySizeMeasurementGuides,
  getWorkspaceDropdownOptions
} from './findMySizeMetadata';
import {
  loadCustomerBodyProfile,
  recordAcceptedFitRecommendation,
  saveCustomerBodyProfile
} from '../lib/customerFitProfile';
import {
  buildLegacyFitSpecification,
  buildPublishedFitSpecifications,
  findFitSpecificationForPattern,
  fromCentimeters,
  getRequiredMeasurementCodes,
  normalizeBodyAreaCode,
  recommendSizeForFit,
  toCentimeters
} from '../lib/fitRecommendation';

const TOUR_STORAGE_KEY = 'perfectfit_find_my_size_tour_seen_v4';
const workspaceMetadata = perfectFitMetadata.workspace;

const CORE_INPUT_ORDER = [
  'HIGH_BUST',
  'BUST',
  'UNDERBUST',
  'WAIST',
  'HIP',
  'THIGH',
  'SHOULDER',
  'SLEEVE_LENGTH',
  'INSEAM',
  'OUTSEAM',
  'HEIGHT'
];

function readWorkspaceData() {
  if (typeof window === 'undefined') return { projects: [] };

  try {
    const raw = runtimeDataStorage.getItem(
      workspaceMetadata.storageKey || 'perfectfit_workspace_data_v1'
    );
    return raw ? JSON.parse(raw) : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

function resolveLocale(locale) {
  if (locale) return locale;
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    return document.documentElement.lang;
  }
  return workspaceMetadata.defaultLocale || 'en';
}

function formatDisplayMeasurement(valueCm, unit) {
  if (!Number.isFinite(Number(valueCm))) return '';
  const value = fromCentimeters(Number(valueCm), unit);
  return Number(value).toFixed(1).replace(/\.0$/, '');
}

function getSizeLabel(size, chart) {
  if (!size) return '-';
  return (
    getPreferredSizeReference(size, chart?.displaySystem || 'ALPHA') ||
    size.label ||
    size.id
  );
}

function measurementPriorityClasses(priority) {
  if (priority === 'CRITICAL') {
    return 'border-[#B86E4B] bg-[#FFF5EF] text-[#8E492D]';
  }
  if (priority === 'IMPORTANT') {
    return 'border-[#D5B894] bg-[#FFF9F1] text-[#775B3D]';
  }
  if (priority === 'NOT_RELEVANT') {
    return 'border-[#DDD6CC] bg-white text-[#8A8178]';
  }
  return 'border-[#DDD6CC] bg-[#F8F6F2] text-[#6C675F]';
}

function titleCaseCode(code) {
  return String(code || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function parseSavedCategoryContext(value) {
  const raw = String(value || '');
  if (!raw.startsWith('category:')) return null;
  const [category, silhouette] = raw.slice('category:'.length).split('|');
  return {
    category: category || 'DRESS',
    silhouette: silhouette || 'REGULAR'
  };
}

function getPriorityLabel(priority, t) {
  const code = String(priority || '').toUpperCase();
  return t(`fit.priority.${code}`, {}, t('fit.priority.DEFAULT'));
}

function getConfidenceLabel(confidence, t) {
  const code = String(confidence || '').toUpperCase();
  return t(`fit.confidence.${code}`, {}, code || '-');
}

function getBreakdownLabel(label, t) {
  return t(`fit.breakdown.${label}`, {}, label || '-');
}

function GuidedTourCoachmark({
  open,
  onClose,
  onStepChange,
  targets,
  t,
  activeGuide,
  initialStep = 0
}) {
  const [step, setStep] = useState(initialStep);
  const [layout, setLayout] = useState(null);
  const cardRef = useRef(null);

  const steps = useMemo(
    () => [
      {
        title: t('fit.tour.profile.title', {}, 'Choose the avatar profile'),
        body: t(
          'fit.tour.profile.body',
          {},
          'Select gender and age group. The avatar picture, available measurement points and calibration metadata update together as one avatar state.'
        )
      },
      {
        title: t('fit.tour.measurements.title', {}, 'Choose a measurement'),
        body: t(
          'fit.tour.measurements.body',
          {},
          'This list contains only measurements available for the active profile and view. The badges are measurement abbreviations, not step numbers. Related variants use a shared two-letter code with suffixes only when a complete series exists, for example BC1/BC2/BC3 or CW1/CW2.'
        )
      },
      {
        title: t('fit.tour.avatar.title', {}, 'Switch view and follow the guide'),
        body: t(
          'fit.tour.avatar.body',
          {},
          'Use Front, Side or Back. The image and measurement geometry switch together. The highlighted tape path shows where the selected measurement is taken on this exact avatar state.'
        )
      },
      {
        title: t('fit.tour.record.title', {}, 'Record the customer measurement'),
        body: t(
          'fit.tour.record.body',
          {},
          'Review the measuring instruction, choose centimetres or inches, then enter the customer value. The recorded measurement is independent from the visual calibration metadata.'
        )
      },
      {
        title: t('fit.tour.recommendContext.title', {}, 'Choose the fit context'),
        body: t(
          'fit.tour.recommendContext.body',
          {},
          'In Size Recommendation, select the product or garment context. Perfect Fit uses the measurements required by that fit specification and shows what is still missing.'
        )
      },
      {
        title: t('fit.tour.recommendResult.title', {}, 'Review the recommendation'),
        body: t(
          'fit.tour.recommendResult.body',
          {},
          'Review the suggested size, confidence, controlling measurement and expected fit before applying the recommendation.'
        )
      }
    ],
    [t]
  );

  useEffect(() => {
    if (open) setStep(initialStep);
  }, [initialStep, open]);

  useEffect(() => {
    if (!open) return undefined;
    onStepChange?.(step);

    let frame = 0;
    let timer = 0;

    const placeCoachmark = () => {
      const target = targets?.[step]?.current;
      if (!target || typeof window === 'undefined') return;

      const rect = target.getBoundingClientRect();
      const cardWidth = Math.min(390, Math.max(280, window.innerWidth - 24));
      const cardHeight = cardRef.current?.offsetHeight || 290;
      const gap = 16;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let placement = 'right';
      let left = rect.right + gap;
      let top = Math.min(
        Math.max(margin, rect.top),
        Math.max(margin, viewportHeight - cardHeight - margin)
      );

      if (viewportWidth - rect.right < cardWidth + gap && rect.left >= cardWidth + gap) {
        placement = 'left';
        left = rect.left - cardWidth - gap;
      } else if (viewportWidth - rect.right < cardWidth + gap) {
        left = Math.min(
          Math.max(margin, rect.left),
          Math.max(margin, viewportWidth - cardWidth - margin)
        );
        if (viewportHeight - rect.bottom >= cardHeight + gap) {
          placement = 'bottom';
          top = rect.bottom + gap;
        } else {
          placement = 'top';
          top = Math.max(margin, rect.top - cardHeight - gap);
        }
      }

      setLayout({
        card: { left, top, width: cardWidth },
        target: {
          left: Math.max(4, rect.left - 6),
          top: Math.max(4, rect.top - 6),
          width: Math.min(viewportWidth - 8, rect.width + 12),
          height: Math.min(viewportHeight - 8, rect.height + 12)
        },
        placement
      });
    };

    const revealTarget = () => {
      const target = targets?.[step]?.current;
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      timer = window.setTimeout(() => {
        frame = window.requestAnimationFrame(placeCoachmark);
      }, 280);
    };

    timer = window.setTimeout(revealTarget, 40);
    window.addEventListener('resize', placeCoachmark);
    window.addEventListener('scroll', placeCoachmark, true);

    return () => {
      window.clearTimeout(timer);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', placeCoachmark);
      window.removeEventListener('scroll', placeCoachmark, true);
    };
  }, [open, onStepChange, step, targets]);

  if (!open) return null;

  const current = steps[step] || steps[0];

  return (
    <>
      {layout?.target && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[150] rounded-[18px] border-2 border-[#A65F3F] shadow-[0_0_0_5px_rgba(166,95,63,0.13)] transition-all duration-200"
          style={layout.target}
        />
      )}

      <section
        ref={cardRef}
        className="fixed z-[155] overflow-hidden rounded-[20px] border border-[#D7C7B8] bg-[#FFFDF9] shadow-[0_22px_65px_rgba(37,26,18,0.22)]"
        style={layout?.card || { left: 12, top: 12, width: 'min(390px, calc(100vw - 24px))' }}
        role="dialog"
        aria-modal="false"
        aria-label={t('fit.tour.title', {}, 'Find My Size guided tour')}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E8DED4] bg-[#FBF7F2] px-4 py-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#A65F3F]">
              {t('fit.tour.counter', { current: step + 1, total: steps.length }, `Step ${step + 1} of ${steps.length}`)}
            </div>
            <h3 className="mt-0.5 truncate font-serif text-lg font-semibold text-[#30261F]">
              {current.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#DED3C7] bg-white text-[#6F6258] hover:bg-[#F8F3ED]"
            aria-label={t('fit.action.close')}
            title={t('fit.action.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-[#685D54]">{current.body}</p>

          {step === 3 && activeGuide && (
            <div className="mt-3 rounded-[14px] border border-[#E4D8CC] bg-[#FBF7F2] p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#906148]">
                {t('fit.tour.measurementDetail', {}, 'Current measurement')}
              </div>
              <div className="mt-1 font-semibold text-[#352B24]">{activeGuide.label}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#6B6057]">{activeGuide.tapeHelp}</p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#E8DED4] bg-[#FBF8F4] px-4 py-3">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D8CEC2] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#716358] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t('fit.action.back')}
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#2E241C] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
            >
              {t('fit.action.next')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#A65F3F] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
            >
              <Check className="h-3.5 w-3.5" />
              {t('fit.action.done')}
            </button>
          )}
        </footer>
      </section>
    </>
  );
}


export default function MannequinGuide({
  activeRecommendedSize = '',
  onRecommendedSizeChange,
  onRecommendationApplied,
  patterns = [],
  initialPatternId = '',
  lockProductSelection = false,
  locale: localeProp = '',
  showSizeConversion = true
} = {}) {
  const locale = resolveLocale(localeProp);
  const t = useMemo(() => createFindMySizeTranslator(locale), [locale]);
  const legacyMeasurementGuides = useMemo(
    () => getFindMySizeMeasurementGuides(locale),
    [locale]
  );

  // The avatar metadata is now the source of truth for which measurements
  // exist. Legacy Find My Size metadata enriches the measurements it already
  // knows, while newer Front/Side/Back measurements use metadata defaults.
  const measurementGuides = useMemo(() => {
    const legacyByCode = new Map(
      legacyMeasurementGuides.map((guide) => [guide.code, guide])
    );
    const adminConfig = readMeasurementAdminConfig();
    const definitions = mergeMeasurementDefinitions(
      DEFAULT_MEASUREMENTS,
      legacyMeasurementGuides,
      adminConfig
    );

    return definitions.map((definition) => {
      const legacy = legacyByCode.get(definition.code);
      const inputSpec = getMeasurementInputSpec(definition.code, definition.type);
      return {
        ...definition,
        ...inputSpec,
        ...(legacy || {}),
        // Marker/view identity stays controlled by measurement metadata.
        marker: definition.marker,
        label: legacy?.label || definition.label,
        shortLabel: legacy?.shortLabel || definition.shortLabel || definition.label,
        instruction: legacy?.instruction || inputSpec.instruction,
        tapeHelp: legacy?.tapeHelp || inputSpec.tapeHelp,
        mistake: legacy?.mistake || inputSpec.mistake
      };
    });
  }, [legacyMeasurementGuides]);

  const guideMap = useMemo(
    () => new Map(measurementGuides.map((guide) => [guide.code, guide])),
    [measurementGuides]
  );
  const categories = useMemo(() => getWorkspaceDropdownOptions('GARMENT_CATEGORY', locale), [locale]);
  const silhouettes = useMemo(() => getWorkspaceDropdownOptions('FIT_SILHOUETTE', locale), [locale]);

  const initialProfile = useMemo(() => loadCustomerBodyProfile(), []);
  const savedContext = useMemo(
    () => parseSavedCategoryContext(initialProfile?.selectedProductId),
    [initialProfile?.selectedProductId]
  );

  const [unit, setUnit] = useState(initialProfile?.unit === 'cm' ? 'cm' : 'in');
  const [measurementsCm, setMeasurementsCm] = useState(initialProfile?.measurementsCm || {});
  const [avatarGender, setAvatarGender] = useState(
    String(initialProfile?.avatarGender || 'FEMALE').toUpperCase() === 'MALE'
      ? 'MALE'
      : 'FEMALE'
  );
  const [avatarAgeGroup, setAvatarAgeGroup] = useState(() => {
    const saved = String(initialProfile?.avatarAgeGroup || 'ADULT').toUpperCase();
    if (saved === 'TEEN') return 'TEEN';
    if (saved === 'CHILD' || saved === 'KID') return 'KID';
    return 'ADULT';
  });
  const avatarProfileId = useMemo(
    () => resolveAvatarProfileId(avatarGender, avatarAgeGroup),
    [avatarGender, avatarAgeGroup]
  );
  const avatarProfile = useMemo(
    () => getAvatarProfile(avatarProfileId),
    [avatarProfileId]
  );
  const [activeMeasurementCode, setActiveMeasurementCode] = useState('BUST');
  const [avatarView, setAvatarView] = useState('FRONT');
  const [viewMeasurementDefinitions, setViewMeasurementDefinitions] = useState(() =>
    getAvatarAreaMeasurementsForView(
      DEFAULT_MEASUREMENTS,
      readMeasurementAdminConfig(),
      avatarProfileId,
      'FRONT',
      { includeHidden: false }
    )
  );
  const [activePurpose, setActivePurpose] = useState('guide');
  const [selectedProductId, setSelectedProductId] = useState(
    initialPatternId || initialProfile?.selectedProductId || patterns?.[0]?.id || ''
  );
  const [selectedCategoryCode, setSelectedCategoryCode] = useState(
    savedContext?.category || categories[0]?.code || 'DRESS'
  );
  const [selectedSilhouetteCode, setSelectedSilhouetteCode] = useState(
    savedContext?.silhouette || silhouettes.find((item) => item.code === 'REGULAR')?.code || silhouettes[0]?.code || 'REGULAR'
  );
  const [publishedSpecs, setPublishedSpecs] = useState(() =>
    buildPublishedFitSpecifications(readWorkspaceData(), workspaceMetadata)
  );
  const [appliedMessage, setAppliedMessage] = useState('');
  const [conversionMatrixOpen, setConversionMatrixOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInitialStep, setTourInitialStep] = useState(0);

  const profileTourRef = useRef(null);
  const measurementListTourRef = useRef(null);
  const avatarTourRef = useRef(null);
  const measurementTourRef = useRef(null);
  const recommendationContextTourRef = useRef(null);
  const recommendationResultTourRef = useRef(null);
  const tourTargets = useMemo(
    () => [
      profileTourRef,
      measurementListTourRef,
      avatarTourRef,
      measurementTourRef,
      recommendationContextTourRef,
      recommendationResultTourRef
    ],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!clientPreferences.getItem(TOUR_STORAGE_KEY)) {
        setTourInitialStep(0);
        setTourOpen(true);
      }
    } catch {}
  }, []);

  const closeTour = () => {
    setTourOpen(false);
    if (typeof window !== 'undefined') {
      try {
        clientPreferences.setItem(TOUR_STORAGE_KEY, '1');
      } catch {}
    }
  };

  const handleTourStepChange = useCallback((step) => {
    setActivePurpose(step >= 4 ? 'recommendation' : 'guide');
  }, []);

  useEffect(() => {
    const refresh = () => {
      setPublishedSpecs(
        buildPublishedFitSpecifications(readWorkspaceData(), workspaceMetadata)
      );
    };

    const handleStorage = (event) => {
      if (!event?.key || event.key === workspaceMetadata.storageKey) refresh();
    };

    window.addEventListener(WORKSPACE_PRESENTATION_UPDATED_EVENT, refresh);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(WORKSPACE_PRESENTATION_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const productOptions = useMemo(() => {
    const sourcePatterns = Array.isArray(patterns) ? patterns : [];
    const options = [...sourcePatterns];
    const representedVariantIds = new Set(
      options
        .map((pattern) => pattern.workspaceVariantId || pattern.variantId)
        .filter(Boolean)
        .map(String)
    );

    publishedSpecs.forEach((spec) => {
      if (representedVariantIds.has(String(spec.workspaceVariantId))) return;
      options.push({
        id: `published-fit-${spec.workspaceVariantId}`,
        workspaceVariantId: spec.workspaceVariantId,
        name: spec.variantName ? `${spec.name} · ${spec.variantName}` : spec.name,
        category: spec.categoryCode,
        fit: spec.silhouetteCode,
        presentationSource: 'workspace-fit-projection'
      });
    });

    return options;
  }, [patterns, publishedSpecs]);

  useEffect(() => {
    if (!lockProductSelection) return;
    if (!productOptions.some((item) => item.id === selectedProductId)) {
      setSelectedProductId(initialPatternId || productOptions[0]?.id || '');
    }
  }, [initialPatternId, lockProductSelection, productOptions, selectedProductId]);

  const lockedProduct = useMemo(
    () => productOptions.find((item) => item.id === selectedProductId) || productOptions[0] || null,
    [productOptions, selectedProductId]
  );

  const categoryLabel = categories.find((item) => item.code === selectedCategoryCode)?.label || selectedCategoryCode;
  const silhouetteLabel = silhouettes.find((item) => item.code === selectedSilhouetteCode)?.label || selectedSilhouetteCode;

  const categoryProduct = useMemo(
    () => ({
      id: `category:${selectedCategoryCode}|${selectedSilhouetteCode}`,
      name: `${categoryLabel} · ${silhouetteLabel}`,
      category: selectedCategoryCode,
      fit: selectedSilhouetteCode,
      presentationSource: 'category-fit-baseline'
    }),
    [categoryLabel, selectedCategoryCode, selectedSilhouetteCode, silhouetteLabel]
  );

  const selectedProduct = lockProductSelection ? lockedProduct : categoryProduct;

  const publishedSpecification = useMemo(
    () => lockProductSelection
      ? findFitSpecificationForPattern(selectedProduct, publishedSpecs)
      : null,
    [lockProductSelection, publishedSpecs, selectedProduct]
  );

  const fitSpecification = useMemo(
    () =>
      publishedSpecification ||
      buildLegacyFitSpecification(selectedProduct || {}, MASTER_SIZING_TABLE, workspaceMetadata),
    [publishedSpecification, selectedProduct]
  );

  const requiredCodes = useMemo(
    () => getRequiredMeasurementCodes(fitSpecification),
    [fitSpecification]
  );

  const supplementalInputCodes = useMemo(() => {
    const categoryCode = lockProductSelection
      ? String(fitSpecification?.categoryCode || selectedProduct?.categoryCode || selectedProduct?.category || '').toUpperCase()
      : selectedCategoryCode;

    if (categoryCode === 'TROUSER') return ['THIGH', 'INSEAM', 'OUTSEAM'];
    if (categoryCode === 'COAT' || categoryCode === 'TOP') return ['SLEEVE_LENGTH'];
    if (categoryCode === 'DRESS') return ['FRONT_WAIST_LENGTH', 'HEIGHT'];
    if (categoryCode === 'SKIRT') return ['HEIGHT'];
    return [];
  }, [fitSpecification?.categoryCode, lockProductSelection, selectedCategoryCode, selectedProduct]);

  const visibleInputCodes = useMemo(() => {
    const unique = new Set([
      ...CORE_INPUT_ORDER.filter((code) => requiredCodes.includes(code)),
      ...requiredCodes,
      ...supplementalInputCodes,
      'BUST',
      'WAIST',
      'HIP'
    ]);
    return [...unique].filter(Boolean);
  }, [requiredCodes, supplementalInputCodes]);

  const recommendation = useMemo(
    () =>
      recommendSizeForFit({
        specification: fitSpecification,
        bodyMeasurements: measurementsCm
      }),
    [fitSpecification, measurementsCm]
  );

  const chart = fitSpecification?.measurementChart;
  const fitProfile = chart?.fitProfile;
  const ruleMap = useMemo(
    () =>
      new Map(
        (fitProfile?.rules || []).map((rule) => [
          normalizeBodyAreaCode(rule.measurementCode),
          rule
        ])
      ),
    [fitProfile]
  );

  useEffect(() => {
    saveCustomerBodyProfile({
      unit,
      measurementsCm,
      avatarGender,
      avatarAgeGroup,
      selectedProductId: lockProductSelection
        ? selectedProductId
        : `category:${selectedCategoryCode}|${selectedSilhouetteCode}`
    });
  }, [
    lockProductSelection,
    measurementsCm,
    selectedCategoryCode,
    selectedProductId,
    selectedSilhouetteCode,
    unit,
    avatarGender,
    avatarAgeGroup
  ]);

  const getGuideItem = (code) => guideMap.get(code) || null;
  const getBodyAreaLabel = (code) => {
    const guide = getGuideItem(code);
    if (guide) return guide.label;
    return t(`fit.bodyArea.${code}`, {}, titleCaseCode(code));
  };

  const setMeasurement = (code, rawValue) => {
    if (rawValue === '') {
      setMeasurementsCm((current) => {
        const next = { ...current };
        delete next[code];
        return next;
      });
      return;
    }

    const cm = toCentimeters(rawValue, unit);
    if (!Number.isFinite(cm)) return;

    setMeasurementsCm((current) => ({
      ...current,
      [code]: Math.max(0, cm)
    }));
  };

  const setMeasurementCm = (code, valueCm) => {
    const cm = Number(valueCm);
    if (!Number.isFinite(cm)) return;
    setMeasurementsCm((current) => ({
      ...current,
      [code]: Math.max(0, cm)
    }));
  };

  const resetMeasurements = () => {
    setMeasurementsCm({});
    setAppliedMessage('');
  };

  const useRecommendedSize = () => {
    const appliedRecommendation = recommendation?.recommendation;
    const label = appliedRecommendation?.label;
    if (!label) return;

    recordAcceptedFitRecommendation({
      result: recommendation,
      specification: fitSpecification,
      pattern: selectedProduct,
      measurementsCm,
      unit
    });

    onRecommendedSizeChange?.(label);
    onRecommendationApplied?.(recommendation);
    setAppliedMessage(t('fit.recommend.applied', { size: label }));
  };

  const viewMeasurementGuides = useMemo(
    () =>
      viewMeasurementDefinitions
        .map((definition) => {
          const baseGuide =
            guideMap.get(definition.code) || {
              ...definition,
              ...getMeasurementInputSpec(definition.code, definition.type)
            };

          return {
            ...baseGuide,
            label:
              definition.label ||
              getMeasurementProfileLabel(baseGuide, avatarProfileId) ||
              baseGuide.label,
            shortLabel:
              definition.shortLabel ||
              getMeasurementProfileShortLabel(baseGuide, avatarProfileId) ||
              baseGuide.shortLabel
          };
        })
        .filter(Boolean),
    [viewMeasurementDefinitions, guideMap, avatarProfileId]
  );

  const handleViewMeasurementsChange = useCallback((definitions, nextView) => {
    const nextDefinitions = Array.isArray(definitions) ? definitions : [];
    setViewMeasurementDefinitions(nextDefinitions);

    setActiveMeasurementCode((current) => {
      if (nextDefinitions.some((definition) => definition.code === current)) {
        return current;
      }
      return nextDefinitions[0]?.code || current;
    });
  }, []);

  const handleAvatarViewChange = useCallback((nextView, definitions = [], avatarState = null) => {
    setAvatarView(nextView);
    if (Array.isArray(definitions)) {
      handleViewMeasurementsChange(definitions, nextView);
    }
  }, [handleViewMeasurementsChange]);

  const controllingCode = recommendation?.recommendation?.controllingMeasurementCode;
  const sourceIsPublished = fitSpecification?.source === 'WORKSPACE_PUBLISHED';
  const missingCritical = recommendation?.missingCriticalMeasurements || [];
  const canRecommend = recommendation?.status === 'RECOMMENDED' && recommendation?.recommendation;
  const noStandardSize = recommendation?.status === 'NO_STANDARD_SIZE';
  const activeGuide =
    viewMeasurementGuides.find((guide) => guide.code === activeMeasurementCode) ||
    getGuideItem(activeMeasurementCode) ||
    viewMeasurementGuides[0] ||
    measurementGuides[0];
  const activeValueCm = Number(measurementsCm[activeGuide.code]);
  const activeValue = formatDisplayMeasurement(activeValueCm, unit);
  const activeSliderValueCm = Number.isFinite(activeValueCm) ? activeValueCm : activeGuide.exampleCm;
  const activeRule = ruleMap.get(normalizeBodyAreaCode(activeGuide.code));
  const activePriority = String(activeRule?.priority || 'SECONDARY').toUpperCase();

  const sliderMin = unit === 'cm'
    ? activeGuide.minCm
    : fromCentimeters(activeGuide.minCm, 'in');
  const sliderMax = unit === 'cm'
    ? activeGuide.maxCm
    : fromCentimeters(activeGuide.maxCm, 'in');
  const sliderStep = unit === 'cm'
    ? activeGuide.stepCm
    : Math.max(0.1, fromCentimeters(activeGuide.stepCm, 'in'));
  const sliderDisplayValue = unit === 'cm'
    ? activeSliderValueCm
    : fromCentimeters(activeSliderValueCm, 'in');

  const handleActiveSlider = (raw) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return;
    const cm = unit === 'cm' ? numeric : toCentimeters(numeric, 'in');
    setMeasurementCm(activeGuide.code, cm);
  };

  const completedGuideCount = measurementGuides.filter((guide) =>
    Number.isFinite(Number(measurementsCm[guide.code]))
  ).length;

  const showMeasurementHelp = () => {
    setTourInitialStep(3);
    setTourOpen(true);
  };

  const chooseMeasurement = (code) => {
    if (!getGuideItem(code)) return;
    setActiveMeasurementCode(code);
    setActivePurpose('guide');
  };

  return (
    <section className="mx-auto w-full max-w-[1380px] overflow-x-clip px-3 py-6 sm:px-5 lg:px-6" id="find-my-size">
      <div className="overflow-hidden rounded-[26px] border border-[#DED3C7] bg-[#FFFDF9] shadow-[0_20px_65px_rgba(76,59,43,0.08)]">
        <header className="border-b border-[#E9E0D6] bg-[linear-gradient(135deg,#FFFDF9_0%,#F8F1E9_100%)] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-[12px] border border-[#DED3C7] bg-white p-1 shadow-[0_4px_12px_rgba(64,48,34,0.04)]">
              <button
                type="button"
                onClick={() => setActivePurpose('guide')}
                className={`rounded-[9px] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${activePurpose === 'guide' ? 'bg-[#2E241C] text-white' : 'text-[#6E6259] hover:bg-[#F8F3ED]'}`}
              >
                {t('fit.tab.guide.step')}
              </button>
              <button
                type="button"
                onClick={() => setActivePurpose('recommendation')}
                className={`rounded-[9px] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${activePurpose === 'recommendation' ? 'bg-[#A65F3F] text-white' : 'text-[#6E6259] hover:bg-[#F8F3ED]'}`}
              >
                {t('fit.tab.recommendation.step')}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTourInitialStep(0);
                  setTourOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold text-[#51473F] transition hover:bg-white"
              >
                <CircleHelp className="h-4 w-4 text-[#8F644D]" />
                {t('fit.action.tour')}
              </button>
              <span className="h-5 w-px bg-[#E2D8CD]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setConversionMatrixOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold text-[#51473F] transition hover:bg-white"
              >
                <TableProperties className="h-4 w-4 text-[#8F644D]" />
                {t('fit.action.sizeConversion')}
              </button>
            </div>
          </div>
        </header>

        {activePurpose === 'guide' ? (
          <div className="bg-[#FFFDF9] p-3 sm:p-4 lg:p-5">
            <div className="grid min-w-0 max-w-full gap-4 2xl:grid-cols-[255px_minmax(0,1fr)_300px] xl:grid-cols-[245px_minmax(0,1fr)_285px]">
              <aside className="min-w-0 overflow-hidden rounded-[22px] border border-[#E2D7CB] bg-[#FCF9F5] p-4 shadow-[0_12px_30px_rgba(64,48,34,0.04)]">
                <div ref={profileTourRef}>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A46143]">{pfUiT("ui.components.mannequinguide.652bd71582")}</div>

                  <div className="mt-3">
                    <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[#8B7768]">{pfUiT("ui.components.mannequinguide.a1c573ca5b")}</div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {AVATAR_GENDERS.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => setAvatarGender(option.code)}
                          className={`rounded-full border px-2.5 py-1.5 text-[9px] font-bold transition ${
                            avatarGender === option.code
                              ? 'border-[#B75D87] bg-[#C84D8D] text-white'
                              : 'border-[#DDD2C8] bg-white text-[#6A5C52] hover:bg-[#FBF7F3]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[#8B7768]">{pfUiT("ui.components.mannequinguide.346546a745")}</div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      {AVATAR_AGE_GROUPS.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => setAvatarAgeGroup(option.code)}
                          className={`rounded-full border px-2 py-1.5 text-[8px] font-bold transition ${
                            avatarAgeGroup === option.code
                              ? 'border-[#A65F3F] bg-[#2E241C] text-white'
                              : 'border-[#DDD2C8] bg-white text-[#6A5C52] hover:bg-[#FBF7F3]'
                          }`}
                          title={option.ageRange}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 text-[8px] text-[#9A8D82]">
                      {avatarProfile.label}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[#E7DDD3] pt-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A46143]">{pfUiT("ui.components.mannequinguide.c2f37fbbae")}</div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-[#74685E]">{pfUiT("ui.components.mannequinguide.666e9d0177")}</p>
                  </div>
                </div>

                <div ref={measurementListTourRef} className="mt-3 max-h-[570px] space-y-2 overflow-y-auto pr-1">
                  {viewMeasurementGuides.map((guide) => (
                    <button
                      key={guide.code}
                      type="button"
                      onClick={() => setActiveMeasurementCode(guide.code)}
                      className={`flex min-h-[48px] w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition ${
                        activeMeasurementCode === guide.code
                          ? 'border-[#A65F3F] bg-[#FFF3EB] text-[#7C402C] shadow-[0_4px_12px_rgba(166,95,63,0.08)]'
                          : 'border-[#E4DAD0] bg-white text-[#51473F] hover:border-[#CBAE98] hover:bg-[#FFFDFC]'
                      }`}
                    >
                      <span
                        title={
                          guide.sourceReference?.number
                            ? `${guide.marker} · source ${guide.sourceReference.number}${guide.sourceReference.symbol ? ` (${guide.sourceReference.symbol})` : ''}`
                            : guide.marker
                        }
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#F3EEE8] px-2 text-[10px] font-black text-[#6B5A4D]"
                      >
                        {guide.marker}
                      </span>
                      <span className="min-w-0 truncate text-[11px] font-semibold">{guide.shortLabel}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={showMeasurementHelp}
                  className="mt-3 flex w-full items-center justify-between rounded-[12px] bg-[#F3EEE8] px-3 py-2.5 text-[10px] font-bold text-[#5D5147] transition hover:bg-[#ECE3DA]"
                >
                  <span>{t('fit.guide.howToMeasure')}</span>
                  <CircleHelp className="h-4 w-4 text-[#8B6B55]" />
                </button>
              </aside>

              <main ref={avatarTourRef} className="min-w-0">
                <FemaleMeasurementAvatar
                  activeCode={activeMeasurementCode}
                  onSelect={setActiveMeasurementCode}
                  guides={measurementGuides}
                  t={t}
                  view={avatarView}
                  avatarProfileId={avatarProfileId}
                  onViewChange={handleAvatarViewChange}
                  onViewMeasurementsChange={handleViewMeasurementsChange}
                  frontViewLabel={t('fit.guide.avatar.frontView', {}, 'Front')}
                  sideViewLabel={t('fit.guide.avatar.sideView', {}, 'Side')}
                  backViewLabel={t('fit.guide.avatar.backView', {}, 'Back')}
                />
              </main>

              <aside ref={measurementTourRef} className="min-w-0 max-w-full space-y-4 overflow-hidden">
                <section className="rounded-[22px] border border-[#E2D7CB] bg-white p-5 shadow-[0_12px_30px_rgba(64,48,34,0.04)]">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A46143]">
                    {t('fit.guide.selectedPoint')}
                  </div>
                  <h3 className="mt-1 font-serif text-2xl font-semibold text-[#30261F]">
                    {activeGuide.shortLabel}
                  </h3>
                  <p className="mt-3 text-[12px] leading-relaxed text-[#655A51]">
                    {activeGuide.instruction}
                  </p>

                  <div className="mt-4 rounded-[16px] border border-[#E1D5C9] bg-[#FFFDF9] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.13em] text-[#8C725D]">{pfUiT("ui.components.mannequinguide.e7ad2312cc")}</div>
                        <div className="mt-0.5 text-[9px] text-[#9A8C81]">{pfUiT("ui.components.mannequinguide.9d6cefa228")}</div>
                      </div>
                      <div className="inline-flex rounded-full border border-[#DDD2C5] bg-white p-1">
                        {['cm', 'in'].map((nextUnit) => (
                          <button
                            key={nextUnit}
                            type="button"
                            onClick={() => setUnit(nextUnit)}
                            className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${
                              unit === nextUnit
                                ? 'bg-[#2E241C] text-white'
                                : 'text-[#76675C] hover:bg-[#F5EFE8]'
                            }`}
                          >
                            {nextUnit}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex overflow-hidden rounded-[12px] border border-[#DCCFC2] bg-white focus-within:border-[#B47A59]">
                      <input
                        type="number"
                        min={sliderMin}
                        max={sliderMax}
                        step={sliderStep}
                        value={activeValue}
                        onChange={(event) => setMeasurement(activeGuide.code, event.target.value)}
                        placeholder={`${sliderMin.toFixed?.(1) || sliderMin}–${sliderMax.toFixed?.(1) || sliderMax}`}
                        className="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg font-semibold text-[#30261F] outline-none"
                      />
                      <span className="flex items-center border-l border-[#E4DBD1] px-3 text-[10px] font-black uppercase text-[#7A6E64]">
                        {unit}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      step={sliderStep}
                      value={sliderDisplayValue}
                      onChange={(event) => handleActiveSlider(event.target.value)}
                      className="mt-3 w-full accent-[#A65F3F]"
                      aria-label={`Adjust ${activeGuide.label}`}
                    />
                  </div>

                  <div className="mt-4 rounded-[16px] border border-[#E7DDD3] bg-[#FBF8F4] p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#4E433A]">
                      <Info className="h-4 w-4 text-[#A65F3F]" />
                      {t('fit.guide.tipsTitle')}
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-[#74685E]">
                      {activeGuide.tapeHelp}
                    </p>
                  </div>
                </section>

                <section className="rounded-[22px] border border-[#E2D7CB] bg-white p-5 shadow-[0_12px_30px_rgba(64,48,34,0.04)]">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A46143]">
                    {t('fit.guide.needHelpTitle')}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-[#655A51]">
                    {t('fit.guide.needHelpBody')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTourInitialStep(0);
                      setTourOpen(true);
                    }}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#DCCFC2] bg-[#FFFDF9] px-4 py-3 text-[10px] font-bold text-[#51473F] transition hover:bg-[#F8F3ED]"
                  >
                    <CircleHelp className="h-4 w-4 text-[#A65F3F]" />
                    {t('fit.guide.startTour')}
                  </button>
                </section>
              </aside>
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 divide-y divide-[#E9E0D6] xl:grid-cols-[minmax(0,1fr)_380px] xl:divide-x xl:divide-y-0">
            <main className="min-w-0 bg-[#FFFDF9] p-5 sm:p-6 lg:p-7">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8C725D]">
                  {t('fit.tab.recommendation.step')}
                </div>
                <h3 className="mt-1 font-serif text-2xl font-semibold text-[#30261F]">{t('fit.recommend.title')}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#6C6057]">{t('fit.recommend.subtitle')}</p>
              </div>

              <div ref={recommendationContextTourRef} className="mt-5 rounded-[18px] border border-[#E2D7CB] bg-[#FAF7F3] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8C725D]">
                      {lockProductSelection ? t('fit.recommend.context.product') : t('fit.recommend.context.general')}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#73675E]">
                      {lockProductSelection ? t('fit.recommend.context.productHelp') : t('fit.recommend.context.generalHelp')}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#D8CEC2] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-[#786A5F]">
                    {sourceIsPublished ? t('fit.recommend.releasedBadge') : t('fit.recommend.generalBadge')}
                  </span>
                </div>

                {lockProductSelection ? (
                  <div className="mt-3 rounded-[12px] border border-[#DCCFC2] bg-white px-3 py-3 text-sm font-semibold text-[#342B25]">
                    {selectedProduct?.name || selectedProduct?.title || selectedProduct?.id || '-'}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#806F61]">{t('fit.recommend.category')}</span>
                      <select
                        value={selectedCategoryCode}
                        onChange={(event) => {
                          setSelectedCategoryCode(event.target.value);
                          setAppliedMessage('');
                        }}
                        className="h-11 w-full rounded-[10px] border border-[#DCCFC2] bg-white px-3 text-sm font-semibold text-[#342B25] outline-none focus:border-[#B47A59]"
                      >
                        {categories.map((item) => (
                          <option key={item.code} value={item.code}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#806F61]">{t('fit.recommend.silhouette')}</span>
                      <select
                        value={selectedSilhouetteCode}
                        onChange={(event) => {
                          setSelectedSilhouetteCode(event.target.value);
                          setAppliedMessage('');
                        }}
                        className="h-11 w-full rounded-[10px] border border-[#DCCFC2] bg-white px-3 text-sm font-semibold text-[#342B25] outline-none focus:border-[#B47A59]"
                      >
                        {silhouettes.map((item) => (
                          <option key={item.code} value={item.code}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8C725D]">{t('fit.recommend.required')}</div>
                    <p className="mt-1 text-[11px] text-[#756A61]">{t('fit.recommend.requiredHelp')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-full border border-[#DDD2C5] bg-white p-1">
                      {['cm', 'in'].map((nextUnit) => (
                        <button
                          key={nextUnit}
                          type="button"
                          onClick={() => setUnit(nextUnit)}
                          className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] transition ${
                            unit === nextUnit ? 'bg-[#2E241C] text-white' : 'text-[#76675C] hover:bg-[#F5EFE8]'
                          }`}
                        >
                          {nextUnit}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={resetMeasurements}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#DDD2C5] bg-white px-2.5 py-2 text-[9px] font-bold text-[#6E6259] hover:bg-[#F8F3ED]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t('fit.action.reset')}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleInputCodes.map((code) => {
                    const rule = ruleMap.get(normalizeBodyAreaCode(code));
                    const priority = String(rule?.priority || 'SECONDARY').toUpperCase();
                    const guide = getGuideItem(code);
                    const value = formatDisplayMeasurement(measurementsCm[code], unit);

                    return (
                      <div
                        key={code}
                        className={`rounded-[13px] border bg-white p-2.5 transition ${
                          activeMeasurementCode === code ? 'border-[#B78665] ring-1 ring-[#E8CBB7]' : 'border-[#E6DDD3]'
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-bold text-[#3B3028]">{getBodyAreaLabel(code)}</span>
                          <div className="flex items-center gap-1">
                            {rule && (
                              <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] ${measurementPriorityClasses(priority)}`}>
                                {getPriorityLabel(priority, t)}
                              </span>
                            )}
                            {guide && (
                              <button
                                type="button"
                                onClick={() => chooseMeasurement(code)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#8D7664] hover:bg-[#F4ECE5]"
                                aria-label={`${t('fit.action.editMeasurement')}: ${guide.label}`}
                                title={t('fit.action.openGuide')}
                              >
                                <CircleHelp className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex h-9 items-stretch overflow-hidden rounded-[9px] border border-[#E4DBD1] bg-[#FCFAF7]">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={value}
                            onFocus={() => guide && setActiveMeasurementCode(code)}
                            onChange={(event) => setMeasurement(code, event.target.value)}
                            className="min-w-0 flex-1 bg-transparent px-2.5 text-sm font-semibold text-[#30261F] outline-none"
                            placeholder={t('fit.guide.input.placeholder')}
                            aria-label={getBodyAreaLabel(code)}
                          />
                          <span className="flex items-center border-l border-[#E4DBD1] px-2 text-[9px] font-bold uppercase text-[#7A6E64]">{unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-[#E7DCD1] bg-[#FBF8F4] px-3 py-2.5 text-[10px] leading-relaxed text-[#74675D]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A66A49]" />
                <span>{lockProductSelection ? t('fit.recommend.productNotice') : t('fit.recommend.generalNotice')}</span>
              </div>
            </main>

            <aside ref={recommendationResultTourRef} className="bg-white p-5 sm:p-6">
              {missingCritical.length > 0 && !noStandardSize && (
                <div className="rounded-[16px] border border-[#E8C9B6] bg-[#FFF7F1] p-4">
                  <div className="flex items-start gap-2.5">
                    <Ruler className="mt-0.5 h-5 w-5 shrink-0 text-[#A65F3F]" />
                    <div>
                      <h4 className="font-serif text-lg font-semibold text-[#34271F]">{t('fit.recommend.completeCritical.title')}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-[#725F52]">
                        {t('fit.recommend.completeCritical.body', { measurements: missingCritical.map(getBodyAreaLabel).join(', ') })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {noStandardSize && (
                <div className="rounded-[18px] border border-[#DAB1A0] bg-[#FFF4EF] p-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#A34F36]" />
                    <div>
                      <h4 className="font-serif text-xl font-semibold text-[#3A2922]">{t('fit.recommend.noMatch.title')}</h4>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#70594F]">{t('fit.recommend.noMatch.body')}</p>
                      {recommendation?.closestAvailable?.size && (
                        <p className="mt-2 text-xs font-semibold text-[#60483E]">
                          {t('fit.recommend.closest', { size: getSizeLabel(recommendation.closestAvailable.size, chart) })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {canRecommend && (
                <>
                  <div className="overflow-hidden rounded-[20px] border border-[#D9CABB] bg-[#2E241C] text-white shadow-[0_16px_40px_rgba(46,36,28,0.18)]">
                    <div className="border-b border-white/10 px-4 py-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#E9CDB8]">{t('fit.recommend.bestSize')}</div>
                    <div className="px-5 py-5 text-center">
                      <div className="font-serif text-6xl font-semibold tracking-tight">{recommendation.recommendation.label}</div>
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#DCC5B4]">
                        {t('fit.recommend.confidence', { confidence: getConfidenceLabel(recommendation.confidence, t) })}
                      </div>
                    </div>
                  </div>

                  {controllingCode && (
                    <div className="mt-3 rounded-[15px] border border-[#E4D6C8] bg-[#FFF9F3] p-3.5">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#A65F3F]" />
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8D654B]">{t('fit.recommend.controlling')}</div>
                          <p className="mt-1 text-xs leading-relaxed text-[#63564C]">
                            {t('fit.recommend.controllingBody', { measurement: getBodyAreaLabel(controllingCode) })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 overflow-hidden rounded-[15px] border border-[#E5DBCF]">
                    <div className="bg-[#F7F2EC] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#7B6A5B]">{t('fit.recommend.profile')}</div>
                    <div className="divide-y divide-[#EEE6DE]">
                      {(recommendation.bodyPartMatches || [])
                        .filter((match) => Number.isFinite(measurementsCm[match.measurementCode]))
                        .map((match) => (
                          <button
                            type="button"
                            key={match.measurementCode}
                            onClick={() => chooseMeasurement(match.measurementCode)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs hover:bg-[#FCF8F4]"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-[#3B3028]">{getBodyAreaLabel(match.measurementCode)}</div>
                              <div className="text-[9px] uppercase tracking-[0.1em] text-[#8A7C70]">{getPriorityLabel(match.priority, t)}</div>
                            </div>
                            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${match.beyondRange ? 'bg-[#FFF0EA] text-[#A34F36]' : 'bg-[#F2EEE8] text-[#564A40]'}`}>
                              {match.beyondRange ? t('fit.recommend.aboveRange') : getSizeLabel(match.matchedSize, chart)}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-[15px] border border-[#E5DBCF]">
                    <div className="bg-[#F7F2EC] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#7B6A5B]">
                      {t('fit.recommend.expectedFit', { size: recommendation.recommendation.label })}
                    </div>
                    <div className="divide-y divide-[#EEE6DE]">
                      {(recommendation.recommendation.fitBreakdown || [])
                        .filter((item) => item.evaluable)
                        .map((item) => (
                          <div key={item.measurementCode} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                            <span className="font-semibold text-[#45392F]">{getBodyAreaLabel(item.measurementCode)}</span>
                            <span className="text-[#6D6056]">{getBreakdownLabel(item.label, t)}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={useRecommendedSize}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#A65F3F] px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#8F5035]"
                  >
                    <Check className="h-4 w-4" />
                    {t('fit.action.useSize', { size: recommendation.recommendation.label })}
                  </button>

                  {activeRecommendedSize && (
                    <div className="mt-2 text-center text-[10px] text-[#7B7067]">
                      {t('fit.recommend.currentShoppingSize', { size: activeRecommendedSize })}
                    </div>
                  )}
                  {appliedMessage && (
                    <div className="mt-2 rounded-[10px] bg-[#F0F6F0] px-3 py-2 text-center text-[10px] font-semibold text-[#526A55]">{appliedMessage}</div>
                  )}
                </>
              )}

              {!canRecommend && !noStandardSize && missingCritical.length === 0 && (
                <div className="rounded-[16px] border border-dashed border-[#D9CBBB] bg-[#FBF8F4] p-4 text-xs leading-relaxed text-[#74685F]">
                  {t('fit.recommend.empty')}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      <GuidedTourCoachmark
        open={tourOpen}
        onClose={closeTour}
        onStepChange={handleTourStepChange}
        targets={tourTargets}
        t={t}
        activeGuide={activeGuide}
        initialStep={tourInitialStep}
      />

      {showSizeConversion && (
      <SizeConversionMatrixWidget
        open={conversionMatrixOpen}
        onOpenChange={setConversionMatrixOpen}
        activeMeasurementCode={activeMeasurementCode}
        measurementGuides={measurementGuides}
        measurementsCm={measurementsCm}
        unit={unit}
        locale={locale}
        onSelectMeasurement={(code) => {
          if (getGuideItem(code)) {
            setActiveMeasurementCode(code);
            setActivePurpose('guide');
          }
        }}
      />
      )}
    </section>
  );
}
