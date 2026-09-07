import {
  createEipRepository,
  createRepositoryChannel,
  RuntimeRepositoryError
} from './runtimeDataGateway';
import { eipCommunityApi, isEipApiConfigured } from './eipApiAdapter';

export const COMMUNITY_POST_MARKER = 'pf-community-feedback';
const COMMUNITY_TAG_PREFIX = 'pfcf.';
const MIGRATABLE_ID_PREFIX = 'community-post-';
const MODERATION_NOTICE_SEEN_KEY = 'perfectfit_community_moderation_seen';

const normalizeText = (value) => String(value || '').trim();
const nowIso = () => new Date().toISOString();

const encodeTagValue = (value, max = 120) =>
  encodeURIComponent(normalizeText(value).slice(0, max));

const decodeTagValue = (value) => {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
};

const makeMetaTag = (key, value, max = 120) => {
  const encoded = encodeTagValue(value, max);
  return encoded ? `${COMMUNITY_TAG_PREFIX}${key}=${encoded}` : '';
};

const tagValue = (tags, key) => {
  const prefix = `${COMMUNITY_TAG_PREFIX}${key}=`;
  const found = (Array.isArray(tags) ? tags : []).find((tag) => String(tag || '').startsWith(prefix));
  return found ? decodeTagValue(String(found).slice(prefix.length)) : '';
};

const numericTagValue = (tags, key, fallback = 0) => {
  const value = Number(tagValue(tags, key));
  return Number.isFinite(value) ? value : fallback;
};

export function isCommunityBlogPost(item = {}) {
  return Array.isArray(item?.tags) && item.tags.includes(COMMUNITY_POST_MARKER);
}

function normalizeAuthor(item = {}) {
  const author = item?.author && typeof item.author === 'object' ? item.author : {};
  const name = normalizeText(author.name || item.author_name || item.author) || 'Perfect Fit Member';
  return name.startsWith('@') ? name : `@${name.replace(/\s+/g, '')}`;
}

export function blogPostToCommunityPost(item = {}) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const imageUrls = Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean) : [];
  const image = normalizeText(item.image_url || item.image || imageUrls[0]);
  const createdAt = item.created_at || item.createdAt || nowIso();
  const createdDate = new Date(createdAt);
  const date = Number.isNaN(createdDate.getTime())
    ? String(createdAt).slice(0, 10)
    : createdDate.toISOString().slice(0, 10);
  const type = tagValue(tags, 'type') || (image ? 'creation' : 'feedback');
  const comment = normalizeText(item.body || item.content || item.text);
  const authorIdentityId = normalizeText(
    item?.author?.identity_id || item.author_identity_id || item.owner_identity_id
  );

  return {
    id: item.id || item.code,
    code: item.code || '',
    clientId: tagValue(tags, 'clientId') || undefined,
    type,
    source: tagValue(tags, 'source') || 'eip-community',
    targetId: tagValue(tags, 'target') || 'atelier',
    targetName: tagValue(tags, 'targetName') || 'Perfect Fit Bureau Overall',
    topic: tagValue(tags, 'topic') || undefined,
    topicLabel: tagValue(tags, 'topicLabel') || undefined,
    author: normalizeAuthor(item),
    authorIdentityId,
    avatar: '',
    rating: Math.max(1, Math.min(5, numericTagValue(tags, 'rating', 5) || 5)),
    title: normalizeText(item.title) || 'Community post',
    caption: normalizeText(item.title) || undefined,
    comment,
    fabric: tagValue(tags, 'fabric') || undefined,
    size: tagValue(tags, 'size') || undefined,
    difficulty: tagValue(tags, 'difficulty') || undefined,
    image: image || undefined,
    date,
    createdAt,
    updatedAt: item.updated_at || item.updatedAt || createdAt,
    likes: Number(item?.reactions?.likes ?? item.likes ?? 0) || 0,
    liked: false,
    tips: comment || undefined,
    replies: Array.isArray(item.comments) ? item.comments : [],
    featured: false,
    _eipPersisted: true
  };
}

export function communityPostTags(post = {}) {
  return [
    COMMUNITY_POST_MARKER,
    makeMetaTag('clientId', post.clientId || post.id, 120),
    makeMetaTag('type', post.type || (post.image ? 'creation' : 'feedback'), 32),
    makeMetaTag('source', post.source || 'community-feedback', 48),
    makeMetaTag('target', post.targetId || 'atelier', 120),
    makeMetaTag('targetName', post.targetName || 'Perfect Fit Bureau Overall', 120),
    makeMetaTag('rating', Math.max(1, Math.min(5, Number(post.rating) || 5)), 8),
    makeMetaTag('fabric', post.fabric, 100),
    makeMetaTag('size', post.size, 32),
    makeMetaTag('difficulty', post.difficulty, 48),
    makeMetaTag('topic', post.topic, 64),
    makeMetaTag('topicLabel', post.topicLabel, 100)
  ].filter(Boolean);
}

function isDataUrl(value) {
  return /^data:image\//i.test(normalizeText(value));
}

async function dataUrlToFile(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const extension = String(blob.type || 'image/jpeg').split('/')[1] || 'jpg';
  return new File([blob], `community-feedback-${Date.now()}.${extension}`, {
    type: blob.type || 'image/jpeg'
  });
}

async function ensureEipImageUrl(post = {}) {
  const image = normalizeText(post.image);
  if (!image) return '';
  if (!isDataUrl(image)) return image;
  const file = await dataUrlToFile(image);
  const upload = await eipCommunityApi.uploadBlogAsset(file);
  return normalizeText(upload?.asset?.url || upload?.asset?.raw_url);
}

function authorNameForPost(post = {}) {
  return normalizeText(post.author).replace(/^@/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'Community member';
}

function showModerationMessage(message, title = 'Community moderation') {
  if (!message || typeof window === 'undefined') return;
  if (typeof window.showToast === 'function') {
    window.showToast(message, 'warning', title);
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent('perfectfit:community-moderation-message', {
      detail: { message, title }
    }));
  } catch {}
}

async function createPersistedPost(post = {}) {
  if (!isEipApiConfigured()) {
    throw new RuntimeRepositoryError('EIP community persistence is not configured.', {
      domain: 'communityPosts',
      operation: 'create'
    });
  }

  const imageUrl = await ensureEipImageUrl(post);
  const title = normalizeText(post.title || post.caption) || 'Community post';
  const body = normalizeText(post.comment || post.tips) || title;
  const response = await eipCommunityApi.createCommunityPost({
    title,
    body,
    author_name: authorNameForPost(post),
    image_url: imageUrl || undefined,
    image_urls: imageUrl ? [imageUrl] : [],
    tags: communityPostTags({ ...post, image: imageUrl || post.image })
  });
  if (!response?.item) {
    throw new RuntimeRepositoryError('EIP did not return the persisted community post.', {
      domain: 'communityPosts',
      operation: 'create'
    });
  }
  return {
    post: blogPostToCommunityPost(response.item),
    moderation: response?.moderation || null
  };
}

function parseStoredRecords(storage, storageKey) {
  if (!storage || !storageKey) return [];
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.records)) return parsed.records;
  } catch {}
  return [];
}

function rewriteStoredRecords(storage, storageKey, records) {
  if (!storage || !storageKey) return;
  if (!records.length) {
    storage.removeItem(storageKey);
    return;
  }
  storage.setItem(storageKey, JSON.stringify(records));
}

function loadSeenNoticeIds(storage) {
  if (!storage) return new Set();
  try {
    const parsed = JSON.parse(storage.getItem(MODERATION_NOTICE_SEEN_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveSeenNoticeIds(storage, ids) {
  if (!storage) return;
  storage.setItem(MODERATION_NOTICE_SEEN_KEY, JSON.stringify([...ids].slice(-100)));
}

export function createCommunityPostsRepository({ storage = null, storageKey = '' } = {}) {
  const channel = createRepositoryChannel();
  let cache = [];
  let loaded = false;
  let writeQueue = Promise.resolve();

  const emit = (reason = 'sync') => {
    channel.emit({
      domain: 'communityPosts',
      reason,
      updatedAt: nowIso(),
      records: cache.map((item) => ({ ...item }))
    });
  };

  const surfaceModerationNotices = async () => {
    try {
      const response = await eipCommunityApi.listCommunityModerationNotices();
      const notices = Array.isArray(response?.notices) ? response.notices : [];
      if (!notices.length) return;
      const seen = loadSeenNoticeIds(storage);
      let changed = false;
      for (const notice of [...notices].reverse()) {
        const id = String(notice?.id || '');
        if (!id || seen.has(id)) continue;
        const message = normalizeText(notice?.payload?.message);
        if (message) showModerationMessage(message, 'Your Community Feedback');
        seen.add(id);
        changed = true;
      }
      if (changed) saveSeenNoticeIds(storage, seen);
    } catch (error) {
      if (Number(error?.status) !== 401) {
        console.warn('[PerfectFit community moderation notices]', error);
      }
    }
  };

  const loadServerPosts = async () => {
    const response = await eipCommunityApi.listCommunityPosts({ limit: 100 });
    return (Array.isArray(response?.items) ? response.items : [])
      .filter(isCommunityBlogPost)
      .map(blogPostToCommunityPost)
      .filter((item) => item.id);
  };

  const migrateBrowserOnlyPosts = async () => {
    const stored = parseStoredRecords(storage, storageKey);
    if (!stored.length) return;

    const serverIds = new Set(cache.map((item) => String(item.id)));
    const serverClientIds = new Set(cache.map((item) => String(item.clientId || '')).filter(Boolean));
    const migratable = stored.filter((item) => {
      const id = normalizeText(item?.id);
      return id.startsWith(MIGRATABLE_ID_PREFIX) && item?.source !== 'legacy-testimonial';
    });
    if (!migratable.length) return;

    const migratedIds = new Set();
    for (const localPost of migratable) {
      const localId = String(localPost.id || '');
      if (serverIds.has(localId) || serverClientIds.has(localId)) {
        migratedIds.add(localId);
        continue;
      }
      try {
        const result = await createPersistedPost(localPost);
        if (result.moderation?.held) {
          showModerationMessage(result.moderation.message, 'Post held for review');
        } else {
          const persisted = result.post;
          cache = [persisted, ...cache.filter((item) => String(item.id) !== String(persisted.id))];
          serverIds.add(String(persisted.id));
          if (persisted.clientId) serverClientIds.add(String(persisted.clientId));
        }
        migratedIds.add(localId);
      } catch {
        // Keep failed local records available for a later recovery attempt.
      }
    }

    if (migratedIds.size) {
      rewriteStoredRecords(
        storage,
        storageKey,
        stored.filter((item) => !migratedIds.has(String(item?.id || '')))
      );
    }
  };

  const list = async () => {
    try {
      await writeQueue;
    } catch {
      // A failed optimistic write should not prevent reloading the authoritative feed.
    }
    cache = await loadServerPosts();
    await migrateBrowserOnlyPosts();
    await surfaceModerationNotices();
    loaded = true;
    emit('load');
    return cache.map((item) => ({ ...item }));
  };

  const create = async (input = {}) => {
    const result = await createPersistedPost(input);
    if (result.moderation?.held) {
      showModerationMessage(result.moderation.message, 'Post held for review');
      cache = cache.filter((item) => String(item.id) !== String(input.id || ''));
      emit('moderation-hold');
      return { ...result.post, _moderationHeld: true };
    }
    const persisted = result.post;
    cache = [persisted, ...cache.filter((item) => String(item.id) !== String(persisted.id))];
    loaded = true;
    emit('create');
    return { ...persisted };
  };

  const getById = async (id) => {
    if (!loaded) await list();
    return cache.find((item) => String(item?.id) === String(id)) || null;
  };

  const update = async (id, patch = {}) => {
    if (!loaded) await list();
    const index = cache.findIndex((item) => String(item?.id) === String(id));
    if (index < 0) return null;
    cache = cache.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch, id: item.id } : item
    );
    emit('update-local');
    return { ...cache[index] };
  };

  const remove = async (id) => {
    const existing = await getById(id);
    if (!existing) return false;
    if (existing._eipPersisted) await eipCommunityApi.deleteBlogPost(existing.id);
    cache = cache.filter((item) => String(item?.id) !== String(id));
    emit('remove');
    return true;
  };

  const replaceAll = async (records = []) => {
    const next = Array.isArray(records) ? records.map((item) => ({ ...item })) : [];
    const currentIds = new Set(cache.map((item) => String(item?.id || '')));
    const newRecords = next.filter((item) => {
      const id = String(item?.id || '');
      return id && !currentIds.has(id) && !item?._eipPersisted;
    });

    cache = next;
    loaded = true;
    emit('replace-optimistic');

    if (!newRecords.length) return cache.map((item) => ({ ...item }));

    writeQueue = writeQueue.catch(() => {}).then(async () => {
      for (const localPost of newRecords) {
        const localId = String(localPost.id || '');
        const result = await createPersistedPost(localPost);
        if (result.moderation?.held) {
          cache = cache.filter((item) => String(item?.id || '') !== localId);
          showModerationMessage(result.moderation.message, 'Post held for review');
          continue;
        }
        const persisted = result.post;
        cache = cache.map((item) =>
          String(item?.id || '') === localId ? persisted : item
        );
      }
      emit('persist');
      return cache.map((item) => ({ ...item }));
    });

    return writeQueue;
  };

  return createEipRepository({
    domain: 'communityPosts',
    list,
    getById,
    create,
    update,
    remove,
    replaceAll,
    subscribe: (listener) => channel.subscribe(listener)
  });
}
