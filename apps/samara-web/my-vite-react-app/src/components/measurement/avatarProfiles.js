import { perfectFitMetadata } from '../../config/perfectFitMetadata';

export const AVATAR_TAXONOMY = perfectFitMetadata.measurement.avatarTaxonomy;
export const AVATAR_GENDERS = perfectFitMetadata.measurement.avatarGenders;
export const AVATAR_AGE_GROUPS = perfectFitMetadata.measurement.avatarAgeGroups;
export const AVATAR_PROFILES = perfectFitMetadata.measurement.avatarProfiles;

const LEGACY_TO_CANONICAL = perfectFitMetadata.measurement.avatarLegacyToCanonical;
const CANONICAL_TO_LEGACY = perfectFitMetadata.measurement.avatarCanonicalToLegacy;

export function normalizeAvatarGender(value) {
  return String(value || '').toUpperCase() === 'MALE' ? 'MALE' : 'FEMALE';
}

export function normalizeAvatarAgeGroup(value) {
  const code = String(value || '').toUpperCase();
  if (code === 'TEEN') return 'TEEN';
  if (code === 'KID' || code === 'CHILD') return 'KID';
  return 'ADULT';
}

export function normalizeAvatarProfileId(value = AVATAR_TAXONOMY.ADULT_FEMALE) {
  const raw = String(value || '').trim();
  if (AVATAR_PROFILES[raw]) return raw;
  return LEGACY_TO_CANONICAL[raw] || LEGACY_TO_CANONICAL[raw.toLowerCase()] || AVATAR_TAXONOMY.ADULT_FEMALE;
}

export function getProfileAliases(profileId = AVATAR_TAXONOMY.ADULT_FEMALE) {
  const canonical = normalizeAvatarProfileId(profileId);
  return [canonical, ...(CANONICAL_TO_LEGACY[canonical] || [])];
}

export function resolveAvatarProfileId(gender, ageGroup) {
  const normalizedGender = normalizeAvatarGender(gender);
  const normalizedAge = normalizeAvatarAgeGroup(ageGroup);

  if (normalizedAge === 'TEEN') {
    return normalizedGender === 'MALE' ? AVATAR_TAXONOMY.TEEN_MALE : AVATAR_TAXONOMY.TEEN_FEMALE;
  }

  if (normalizedAge === 'KID') {
    return normalizedGender === 'MALE' ? AVATAR_TAXONOMY.KID_MALE : AVATAR_TAXONOMY.KID_FEMALE;
  }

  return normalizedGender === 'MALE' ? AVATAR_TAXONOMY.ADULT_MALE : AVATAR_TAXONOMY.ADULT_FEMALE;
}

export function getAvatarProfile(profileId = AVATAR_TAXONOMY.ADULT_FEMALE) {
  return AVATAR_PROFILES[normalizeAvatarProfileId(profileId)] || AVATAR_PROFILES[AVATAR_TAXONOMY.ADULT_FEMALE];
}

export function resolveAvatarAssetFilename(profileId, view = 'FRONT') {
  const profile = getAvatarProfile(profileId);
  const resolvedView = String(view || 'FRONT').toUpperCase();
  return `${profile.assetPrefix}_${resolvedView.charAt(0)}${resolvedView.slice(1).toLowerCase()}.png`;
}

export function measurementAppliesToProfile(definition, profileId = AVATAR_TAXONOMY.ADULT_FEMALE) {
  const appliesTo = definition?.appliesTo;
  if (!Array.isArray(appliesTo) || appliesTo.length === 0 || appliesTo.includes('ALL')) {
    return true;
  }

  const aliases = new Set(getProfileAliases(profileId));
  return appliesTo.some((entry) => aliases.has(normalizeAvatarProfileId(entry)) || aliases.has(String(entry)));
}

export function getMeasurementProfileLabel(definition, profileId = AVATAR_TAXONOMY.ADULT_FEMALE) {
  const aliases = getProfileAliases(profileId);
  const override = aliases.map((alias) => definition?.profileLabels?.[alias]).find(Boolean);
  return override || definition?.label;
}

export function getMeasurementProfileShortLabel(definition, profileId = AVATAR_TAXONOMY.ADULT_FEMALE) {
  const aliases = getProfileAliases(profileId);
  const override = aliases.map((alias) => definition?.profileShortLabels?.[alias]).find(Boolean);
  return override || definition?.shortLabel || getMeasurementProfileLabel(definition, profileId);
}
