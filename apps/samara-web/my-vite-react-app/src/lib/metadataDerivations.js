const normalizeViewName = (value) => {
  const viewName = String(value || '').toUpperCase();
  if (viewName === 'SIDE' || viewName === 'BACK') return viewName;
  return 'FRONT';
};

const clonePoint = (point, fallback = { x: 0, y: 0 }) => ({
  x: Number.isFinite(Number(point?.x)) ? Number(point.x) : fallback.x,
  y: Number.isFinite(Number(point?.y)) ? Number(point.y) : fallback.y
});

const getPathEndpoints = (path) => {
  const text = String(path || '');
  const startMatch = text.match(/^\s*M\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
  const endMatch = text.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);

  return {
    start: {
      x: startMatch ? Number(startMatch[1]) : 0,
      y: startMatch ? Number(startMatch[2]) : 0
    },
    end: {
      x: endMatch ? Number(endMatch[1]) : 0,
      y: endMatch ? Number(endMatch[2]) : 0
    }
  };
};

export function buildCanonicalMeasurementDefinitions({
  baseMeasurements = [],
  russianGuideAdditions = [],
  displayCodes = {},
  russianGuide = []
} = {}) {
  const russianByCode = new Map(
    (russianGuide || []).map((item) => [item.normalizedCode, item])
  );

  const buildSourceReference = (reference) => {
    if (!reference) return null;

    return {
      system: 'RUSSIAN_BASIC_FEMALE_FIGURE',
      number: reference.no,
      symbol: reference.symbolRu,
      sourceNameRu: reference.nameRu,
      sourceNameEn: reference.nameEn,
      sourceRecording: reference.sourceRecording || null,
      appRecording: reference.appRecording || null,
      views: [...(reference.views || [])]
    };
  };

  return [...baseMeasurements, ...russianGuideAdditions].map((definition) => {
    const russianReference = russianByCode.get(definition.code) || null;
    const sourceReference = buildSourceReference(russianReference);
    const displayMarker = displayCodes[definition.code] || definition.marker;

    return {
      ...definition,
      marker: displayMarker,
      displayMarker,
      sourceReference,
      sourceNumber: sourceReference?.number || null,
      sourceSymbol: sourceReference?.symbol || null,
      officialViews: sourceReference?.views || Object.keys(definition.layout || {})
    };
  });
}

export function buildCanonicalDefaultViewConfig({
  definitions = [],
  avatarProfiles = {},
  defaultProfileId = 'ADULT_FEMALE'
} = {}) {
  const profile = avatarProfiles[defaultProfileId] || Object.values(avatarProfiles)[0];
  if (!profile) return {};

  const result = Object.fromEntries(
    Object.entries(profile.images || {}).map(([viewName, image]) => [
      viewName,
      { image, markers: {}, guides: {}, focus: {} }
    ])
  );

  definitions.forEach((definition) => {
    Object.entries(definition.layout || {}).forEach(([viewName, layout]) => {
      if (!result[viewName] || !layout) return;
      result[viewName].markers[definition.code] = layout.marker;
      result[viewName].guides[definition.code] = layout.guide;
      result[viewName].focus[definition.code] =
        layout.focus || { x: 50, y: 50, scale: 2 };
    });
  });

  return result;
}

export function buildCanonicalAvatarAreas({
  definitions = [],
  avatarProfiles = {},
  avatarTaxonomy = {},
  legacyToCanonical = {},
  canonicalToLegacy = {},
  viewOrder = {},
  views = ['FRONT', 'SIDE', 'BACK'],
  guideDefaults = {}
} = {}) {
  const normalizedViews = views.map(normalizeViewName);
  const defaultGuideTransform = {
    dx: 0,
    dy: 0,
    sx: 1,
    sy: 1,
    ...(guideDefaults.transform || {})
  };
  const defaultCurveOffset = {
    x: 0,
    y: 0,
    ...(guideDefaults.curveOffset || {})
  };

  const normalizeProfileId = (value = avatarTaxonomy.ADULT_FEMALE || 'ADULT_FEMALE') => {
    const raw = String(value || '').trim();
    if (avatarProfiles[raw]) return raw;
    return (
      legacyToCanonical[raw] ||
      legacyToCanonical[raw.toLowerCase()] ||
      avatarTaxonomy.ADULT_FEMALE ||
      Object.keys(avatarProfiles)[0]
    );
  };

  const profileAliases = (profileId) => {
    const canonical = normalizeProfileId(profileId);
    return [canonical, ...(canonicalToLegacy[canonical] || [])];
  };

  const appliesToProfile = (definition, profileId) => {
    const appliesTo = definition?.appliesTo;
    if (!Array.isArray(appliesTo) || appliesTo.length === 0 || appliesTo.includes('ALL')) {
      return true;
    }

    const aliases = new Set(profileAliases(profileId));
    return appliesTo.some(
      (entry) => aliases.has(normalizeProfileId(entry)) || aliases.has(String(entry))
    );
  };

  const profileLabel = (definition, profileId) => {
    const aliases = profileAliases(profileId);
    return aliases.map((alias) => definition?.profileLabels?.[alias]).find(Boolean) || definition?.label;
  };

  const profileShortLabel = (definition, profileId) => {
    const aliases = profileAliases(profileId);
    return (
      aliases.map((alias) => definition?.profileShortLabels?.[alias]).find(Boolean) ||
      definition?.shortLabel ||
      profileLabel(definition, profileId)
    );
  };

  const officialViewsFor = (definition) => {
    const sourceViews = definition?.sourceReference?.views || definition?.officialViews;
    return Array.isArray(sourceViews) ? sourceViews.map(normalizeViewName) : [];
  };

  const measurementBelongsToView = (definition, viewName) => {
    const view = normalizeViewName(viewName);
    const officialViews = officialViewsFor(definition);
    const isOfficial = Boolean(definition?.sourceReference?.system);

    if (isOfficial && officialViews.length) {
      return officialViews.includes(view);
    }

    return Boolean(definition?.layout?.[view]);
  };

  const cloneLayout = (layout) => {
    if (!layout) return null;
    return {
      marker: clonePoint(layout.marker),
      guide: String(layout.guide || ''),
      focus: {
        x: Number(layout.focus?.x ?? 50),
        y: Number(layout.focus?.y ?? 50),
        scale: Number(layout.focus?.scale ?? 2)
      }
    };
  };

  const effectiveLayout = (definition, viewName) => {
    const view = normalizeViewName(viewName);
    if (!measurementBelongsToView(definition, view)) return null;

    const direct = cloneLayout(definition?.layout?.[view]);
    if (direct) return { ...direct, starterGenerated: false };

    const fallbackView = normalizedViews.find((candidate) => definition?.layout?.[candidate]);
    const fallback = cloneLayout(definition?.layout?.[fallbackView]);
    if (!fallback) return null;

    return {
      ...fallback,
      starterGenerated: true,
      starterFromView: fallbackView
    };
  };

  const placementFromDefinition = (definition, viewName, profileId) => {
    if (!appliesToProfile(definition, profileId)) return null;

    const layout = effectiveLayout(definition, viewName);
    if (!layout) return null;

    const endpoints = getPathEndpoints(layout.guide);
    const sourceReference = definition.sourceReference || null;
    const displayMarker = definition.displayMarker || definition.marker;

    return {
      code: definition.code,
      displayMarker,
      markerNumber: displayMarker,
      label: profileLabel(definition, profileId),
      shortLabel: profileShortLabel(definition, profileId),
      type: definition.type || 'curve',
      sourceReference,
      officialViews: officialViewsFor(definition),
      starterGenerated: Boolean(layout.starterGenerated),
      starterFromView: layout.starterFromView || null,
      needsCalibration: Boolean(layout.starterGenerated),
      marker: clonePoint(layout.marker),
      guide: {
        type: definition.type || 'curve',
        path: layout.guide || '',
        start: clonePoint(endpoints.start),
        end: clonePoint(endpoints.end),
        curveOffset: { ...defaultCurveOffset },
        transform: { ...defaultGuideTransform }
      },
      focus: { ...layout.focus },
      visible: true
    };
  };

  const sourceOrderKey = (definition) => {
    const raw = String(definition?.sourceReference?.number || '');
    if (!raw) return Number.POSITIVE_INFINITY;
    const match = raw.match(/^(\d+)([a-z])?$/i);
    if (!match) return Number.POSITIVE_INFINITY;
    const base = Number(match[1]);
    const suffix = match[2] ? match[2].toLowerCase().charCodeAt(0) - 96 : 0;
    return base + suffix / 10;
  };

  const orderDefinitionsForView = (inputDefinitions, viewName) => {
    const view = normalizeViewName(viewName);
    const preferred = viewOrder[view] || [];
    const preferredIndex = new Map(preferred.map((code, index) => [code, index]));

    return [...inputDefinitions].sort((a, b) => {
      const aSource = sourceOrderKey(a);
      const bSource = sourceOrderKey(b);
      const aHasSource = Number.isFinite(aSource);
      const bHasSource = Number.isFinite(bSource);

      if (aHasSource && bHasSource && aSource !== bSource) return aSource - bSource;
      if (aHasSource !== bHasSource) return aHasSource ? -1 : 1;

      const ai = preferredIndex.has(a.code) ? preferredIndex.get(a.code) : 10000;
      const bi = preferredIndex.has(b.code) ? preferredIndex.get(b.code) : 10000;
      if (ai !== bi) return ai - bi;
      return String(a.code).localeCompare(String(b.code));
    });
  };

  const assetFileFor = (profile, viewName) => {
    const view = normalizeViewName(viewName);
    const viewLabel = `${view.charAt(0)}${view.slice(1).toLowerCase()}`;
    return `${profile.assetPrefix}_${viewLabel}.png`;
  };

  const buildAreaView = (profile, viewName) => {
    const view = normalizeViewName(viewName);
    const eligible = orderDefinitionsForView(
      definitions.filter(
        (definition) =>
          appliesToProfile(definition, profile.id) &&
          measurementBelongsToView(definition, view) &&
          effectiveLayout(definition, view)
      ),
      view
    );

    return {
      stateKey: `${profile.id}:${view}`,
      view,
      image: profile.images[view],
      assetFile: assetFileFor(profile, view),
      measurements: Object.fromEntries(
        eligible.map((definition) => [
          definition.code,
          placementFromDefinition(definition, view, profile.id)
        ])
      )
    };
  };

  return Object.freeze(
    Object.fromEntries(
      Object.values(avatarProfiles).map((profile) => [
        profile.id,
        {
          id: profile.id,
          gender: profile.gender,
          ageGroup: profile.ageGroup,
          label: profile.label,
          assetPrefix: profile.assetPrefix,
          views: Object.fromEntries(
            normalizedViews.map((viewName) => [viewName, buildAreaView(profile, viewName)])
          )
        }
      ])
    )
  );
}
