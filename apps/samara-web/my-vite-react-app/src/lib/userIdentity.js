import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { runtimeDataStorage } from './runtimeDataGateway';
import { translatePerfectFitText } from './i18n';

const usernamePolicy = perfectFitMetadata.auth.usernamePolicy;
export const USERNAME_REGISTRY_STORAGE_KEY = usernamePolicy.storageKey;
export const USER_PROFILE_STORAGE_KEY = perfectFitMetadata.app.storage.userProfile;
export const RESERVED_USERNAMES = new Set(usernamePolicy.reservedUsernames || []);
const USERNAME_PATTERN = new RegExp(usernamePolicy.pattern);

const nowIso = () => new Date().toISOString();

const isBrowser = () => typeof window !== 'undefined';

const readJson = (key, fallback) => {
  if (!isBrowser()) return fallback;
  try {
    const value = runtimeDataStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  if (!isBrowser()) return;
  try {
    runtimeDataStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export const normalizeUsername = (value) =>
  String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

export const formatPublicHandle = (username) => {
  const normalized = normalizeUsername(username);
  return normalized ? `@${normalized}` : '';
};

const hashText = (value) => {
  const text = String(value || 'perfectfit-user');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const sanitizeUsernameSeed = (value) => {
  const normalized = normalizeUsername(value)
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/[._]{2,}/g, '.')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');

  const base = normalized || 'member';
  const padded = base.length < 3 ? `${base}user` : base;
  return padded.slice(0, 30).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '') || 'member';
};

export function getStableUserId(user = {}) {
  const existing =
    user.id ||
    user.identity_id ||
    user.identityId ||
    user.userId ||
    user.sub ||
    '';

  if (existing) return String(existing);

  const stableSource =
    user.email ||
    user.login ||
    user.fullName ||
    user.name ||
    user.username ||
    user.role ||
    'local-user';

  return `local-user:${hashText(stableSource).slice(0, 10)}`;
}

export function getUserRoutingId(user = {}) {
  const id = getStableUserId(user);
  if (/^(user|user-id|agent|local-user):/i.test(id)) return id;
  return `user-id:${id}`;
}

export function normalizeUsernameRegistry(raw = null) {
  const source = raw || readJson(USERNAME_REGISTRY_STORAGE_KEY, null);
  const usernames =
    source?.usernames && typeof source.usernames === 'object'
      ? source.usernames
      : Array.isArray(source)
        ? source.reduce((acc, entry) => {
            const username = normalizeUsername(entry?.username || entry);
            if (username) {
              acc[username] = {
                username,
                userId: entry?.userId || entry?.id || '',
                source: entry?.source || 'legacy-array',
                updatedAt: entry?.updatedAt || nowIso()
              };
            }
            return acc;
          }, {})
        : {};

  return {
    version: '2026-08-25-username-registry-v1',
    authority: 'local-fallback-only',
    usernames
  };
}

export function readUsernameRegistry() {
  return normalizeUsernameRegistry();
}

export function writeUsernameRegistry(registry) {
  writeJson(USERNAME_REGISTRY_STORAGE_KEY, normalizeUsernameRegistry(registry));
}

export function isUsernameTaken(username, currentUserId = '') {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;
  const registry = readUsernameRegistry();
  const entry = registry.usernames[normalized];
  if (!entry) return false;
  if (!currentUserId) return true;
  return String(entry.userId || '') !== String(currentUserId);
}

export function validateUsername(value, options = {}) {
  const username = normalizeUsername(value);
  const currentUserId = options.currentUserId || '';

  if (!username) {
    return { valid: false, username, code: 'required', message: translatePerfectFitText(usernamePolicy.validationMessageKeys.required, {}, 'Username is required') };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      valid: false,
      username,
      code: 'format',
      message: translatePerfectFitText(usernamePolicy.validationMessageKeys.format, {}, 'Use 3-30 letters, numbers, . or _')
    };
  }

  if (RESERVED_USERNAMES.has(username)) {
    return {
      valid: false,
      username,
      code: 'reserved',
      message: translatePerfectFitText(usernamePolicy.validationMessageKeys.reserved, {}, 'This username is reserved')
    };
  }

  if (isUsernameTaken(username, currentUserId)) {
    return {
      valid: false,
      username,
      code: 'taken',
      message: translatePerfectFitText(usernamePolicy.validationMessageKeys.taken, {}, 'Username is already taken')
    };
  }

  return { valid: true, username, code: 'ok', message: '' };
}

export function registerUsernameForUser(username, userId, attrs = {}) {
  const normalized = normalizeUsername(username);
  if (!normalized || !userId) return null;

  const registry = readUsernameRegistry();
  registry.usernames[normalized] = {
    username: normalized,
    userId: String(userId),
    role: attrs.role || '',
    brandName: attrs.brandName || attrs.designerBrand || attrs.studioName || '',
    source: attrs.source || 'local-fallback',
    updatedAt: nowIso()
  };
  writeUsernameRegistry(registry);
  return registry.usernames[normalized];
}

export function deriveUsername(user = {}, options = {}) {
  const userId = options.userId || getStableUserId(user);
  const explicit = normalizeUsername(user.username);
  if (explicit && validateUsername(explicit, { currentUserId: userId }).valid) {
    registerUsernameForUser(explicit, userId, { ...user, source: options.source || 'existing' });
    return explicit;
  }

  const source =
    user.email ||
    user.login ||
    user.fullName ||
    user.name ||
    user.role ||
    'member';
  const base = sanitizeUsernameSeed(source);
  let candidate = base;
  let suffix = 1;

  while (
    RESERVED_USERNAMES.has(candidate) ||
    isUsernameTaken(candidate, userId) ||
    !USERNAME_PATTERN.test(candidate)
  ) {
    const tail = String(suffix);
    candidate = `${base.slice(0, Math.max(3, 30 - tail.length - 1))}.${tail}`;
    suffix += 1;
    if (suffix > 999) {
      candidate = `member.${hashText(`${source}:${userId}`).slice(0, 8)}`;
      break;
    }
  }

  registerUsernameForUser(candidate, userId, { ...user, source: options.source || 'derived' });
  return candidate;
}

export function ensureUserPublicIdentity(user, options = {}) {
  if (!user) return null;

  const id = getStableUserId(user);
  const username = deriveUsername({ ...user, id }, { userId: id, source: options.source || 'migration' });
  const next = {
    ...user,
    id,
    username,
    brandName: user.brandName || user.designerBrand || user.studioName || ''
  };

  if (options.persist) {
    writeJson(options.storageKey || USER_PROFILE_STORAGE_KEY, next);
  }

  return next;
}

export function roleLabelForUser(user = {}) {
  const role = String(user.role || user.recipientRole || '').toLowerCase();
  if (['collaborator', 'designer', 'seller'].includes(role)) return 'Designer';
  if (role === 'administrator') return 'Administrator';
  if (role === 'moderator') return 'Moderator';
  if (role === 'buyer') return 'Buyer';
  return user.roleLabel || 'Perfect Fit member';
}

export function getPublicUserPresentation(user = {}, options = {}) {
  const username =
    normalizeUsername(user.username) ||
    (options.derive === false ? '' : deriveUsername(user, { source: options.source || 'presentation' }));
  const brandName = user.brandName || user.designerBrand || user.studioName || '';
  const roleLabel = user.roleLabel || roleLabelForUser(user);
  const handle = formatPublicHandle(username);

  return {
    username,
    brandName,
    role: user.role || '',
    roleLabel,
    handle,
    displayLabel:
      user.displayLabel ||
      (brandName && handle
        ? `${brandName} · ${handle}`
        : brandName || handle || roleLabel)
  };
}

export function formatRecipientDisplay(recipient = {}) {
  const username = normalizeUsername(recipient.username);
  const handle = formatPublicHandle(username);
  const brandName = recipient.brandName || recipient.designerBrand || recipient.studioName || '';
  const roleLabel = recipient.roleLabel || roleLabelForUser(recipient);

  if (brandName && handle) return `${brandName} · ${handle}`;
  if (brandName) return brandName;
  if (handle && roleLabel && roleLabel !== 'Perfect Fit member') return `${handle} · ${roleLabel}`;
  if (handle) return handle;
  return recipient.displayLabel || recipient.name || roleLabel || 'Recipient';
}
