import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bookmark,
  Calendar,
  Clock,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { useRuntimeState } from '../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../lib/runtimeDomainContracts';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { eipCommunityApi, isEipApiConfigured } from '../lib/eipApiAdapter';
import { UI_LAYERS } from '../lib/uiLayers';

const normalizeText = (value) => String(value || '').trim();

function normalizeBlogPost(item = {}) {
  const author = item.author && typeof item.author === 'object' ? item.author : {};
  const reactions = item.reactions && typeof item.reactions === 'object' ? item.reactions : {};
  const imageUrls = Array.isArray(item.image_urls)
    ? item.image_urls.filter(Boolean)
    : Array.isArray(item.images)
      ? item.images.filter(Boolean)
      : [];
  const comments = Array.isArray(item.comments) ? item.comments : [];

  return {
    id: item.id || item.code,
    code: item.code || '',
    title: normalizeText(item.title),
    content: normalizeText(item.body || item.content || item.text),
    image: normalizeText(item.image_url || item.image || imageUrls[0]),
    images: imageUrls,
    tags: Array.isArray(item.tags) ? item.tags.map(normalizeText).filter(Boolean) : [],
    author: normalizeText(author.name || author.display_name || item.author_name || item.author) || 'Perfect Fit Member',
    authorIdentityId: normalizeText(author.identity_id || item.author_identity_id || item.created_by_identity_id),
    role: normalizeText(author.role || item.author_role) || 'Member',
    likes: Number(reactions.likes ?? item.likes ?? 0) || 0,
    dislikes: Number(reactions.dislikes ?? item.dislikes ?? 0) || 0,
    commentCount: Number(reactions.comments ?? item.comment_count ?? comments.length) || 0,
    comments,
    createdAt: item.created_at || item.createdAt || null,
    updatedAt: item.updated_at || item.updatedAt || null
  };
}

function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function initialsFor(value) {
  const parts = normalizeText(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export default function CreatorBlog() {
  const [currentUser] = useRuntimeState(RUNTIME_DOMAINS.USER_PROFILE, null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newImageFile, setNewImageFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((message) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 3000);
  }, []);

  const loadPosts = useCallback(async () => {
    if (!isEipApiConfigured()) {
      setPosts([]);
      setLoadError('The community feed is not connected to EIP.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const response = await eipCommunityApi.listBlogPosts({ limit: 100 });
      const items = Array.isArray(response?.items) ? response.items : [];
      setPosts(items.map(normalizeBlogPost).filter((item) => item.id));
    } catch (error) {
      setPosts([]);
      setLoadError(error?.message || error?.code || 'Unable to load the community feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((post) =>
      [post.title, post.content, post.author, ...(post.tags || [])]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [posts, searchQuery]);

  const postsThisWeek = useMemo(() => {
    const threshold = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return posts.filter((post) => {
      if (!post.createdAt) return false;
      const timestamp = new Date(post.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= threshold;
    }).length;
  }, [posts]);

  const activeCreators = useMemo(() => {
    const creators = new Set();
    posts.forEach((post) => {
      const key = post.authorIdentityId || post.author.toLowerCase();
      if (key) creators.add(key);
    });
    return creators.size;
  }, [posts]);

  const totalEngagements = useMemo(
    () => posts.reduce(
      (sum, post) => sum + post.likes + post.dislikes + post.commentCount,
      0
    ),
    [posts]
  );

  const trendingTags = useMemo(() => {
    const counts = new Map();
    posts.forEach((post) => {
      (post.tags || []).forEach((tag) => {
        const normalized = normalizeText(tag).replace(/^#/, '').toLowerCase();
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  }, [posts]);

  const currentIdentityId = normalizeText(currentUser?.identityId || currentUser?.id);
  const currentDisplayName = normalizeText(
    currentUser?.fullName || currentUser?.username || currentUser?.email
  );
  const currentRoleLabel = currentUser?.memberCode?.startsWith?.('PFADMIN:')
    ? 'Perfect Fit Administrator'
    : currentUser?.role === 'collaborator'
      ? 'Designer / Atelier Member'
      : 'Perfect Fit Member';

  const ownPosts = useMemo(() => {
    if (!currentUser) return [];
    return posts.filter((post) => {
      if (currentIdentityId && post.authorIdentityId) {
        return post.authorIdentityId === currentIdentityId;
      }
      return currentDisplayName && post.author.toLowerCase() === currentDisplayName.toLowerCase();
    });
  }, [posts, currentUser, currentIdentityId, currentDisplayName]);

  const ownEngagements = useMemo(
    () => ownPosts.reduce(
      (sum, post) => sum + post.likes + post.dislikes + post.commentCount,
      0
    ),
    [ownPosts]
  );

  const resetPostForm = () => {
    setNewTitle('');
    setNewContent('');
    setNewTags('');
    setNewImageFile(null);
    setFormError('');
  };

  const handleOpenCreatePost = () => {
    if (!currentUser) {
      showToast('Sign in from the header before creating a community post.');
      return;
    }
    resetPostForm();
    setIsModalOpen(true);
  };

  const handleCreatePostSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setFormError('A signed-in Perfect Fit member is required to publish a post.');
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) {
      setFormError('Post title and content are required.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      let imageUrl = '';
      if (newImageFile) {
        const upload = await eipCommunityApi.uploadBlogAsset(newImageFile);
        imageUrl = normalizeText(upload?.asset?.url || upload?.asset?.raw_url);
      }

      const tags = newTags
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean);

      const response = await eipCommunityApi.createBlogPost({
        title: newTitle.trim(),
        body: newContent.trim(),
        image_url: imageUrl || undefined,
        image_urls: imageUrl ? [imageUrl] : [],
        tags
      });

      if (response?.item) {
        const created = normalizeBlogPost(response.item);
        setPosts((current) => [created, ...current.filter((post) => post.id !== created.id)]);
      } else {
        await loadPosts();
      }

      resetPostForm();
      setIsModalOpen(false);
      showToast('Your community post is now published.');
    } catch (error) {
      setFormError(error?.message || error?.code || 'Unable to publish this post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (post) => {
    if (!post?.id || !currentUser) return;
    if (!window.confirm(`Remove “${post.title || 'this post'}” from the community feed?`)) return;

    setDeletingPostId(post.id);
    try {
      await eipCommunityApi.deleteBlogPost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      showToast('Community post removed.');
    } catch (error) {
      showToast(error?.message || error?.code || 'Unable to remove this post.');
    } finally {
      setDeletingPostId('');
    }
  };

  return (
    <div className="bg-sand-50/20 rounded-[4px] border border-sand-200 p-6 md:p-8 space-y-8" id="creator-blog-main">
      <div className="bg-white border border-sand-200 rounded-[4px] p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6" id="blog-header">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-serif text-bark-900 tracking-tight leading-tight">
            Creator Blog &amp; Atelier Guild
          </h2>
          <p className="text-xs sm:text-sm text-bark-550 max-w-xl">{pfUiT('ui.components.creatorblog.b37648245a')}</p>
        </div>

        <div className="flex flex-wrap gap-2.5" id="blog-stats-pills">
          <div className="bg-sand-100 border border-sand-250 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-bark-800 uppercase tracking-wider">
            {pfUiT('ui.components.creatorblog.c6a0b455a2')}<b className="text-clay-705">{postsThisWeek}</b>
          </div>
          <div className="bg-sand-100 border border-sand-250 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-bark-800 uppercase tracking-wider">
            {pfUiT('ui.components.creatorblog.73a2034b1e')}<b className="text-clay-705">{activeCreators}</b>
          </div>
          <div className="bg-sand-100 border border-sand-250 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-bark-800 uppercase tracking-wider">
            {pfUiT('ui.components.creatorblog.9983962eef')}<b className="text-emerald-700 font-extrabold">{totalEngagements}</b>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start" id="blog-cols-grid">
        <div className="order-2 md:order-1 md:col-span-4 md:sticky md:top-24 space-y-6" id="blog-side-actions">
          <div className="bg-white border border-sand-200 rounded-[4px] overflow-hidden shadow-3xs" id="sidebar-user-profile-card">
            <div className="h-16 w-full bg-gradient-to-r from-clay-700 to-bark-800 relative" id="profile-card-banner">
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
            </div>
            <div className="px-5 pb-5 text-center relative -mt-8" id="profile-card-details">
              <div className="w-16 h-16 rounded-full bg-white border-2 border-white shadow-md mx-auto flex items-center justify-center overflow-hidden" id="profile-card-avatar-wrapper">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt={currentDisplayName || 'Member'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-sand-100 flex items-center justify-center text-bark-850 font-serif font-bold text-lg uppercase" id="profile-avatar-circle">
                    {initialsFor(currentDisplayName)}
                  </div>
                )}
              </div>

              <div className="mt-2.5">
                <h4 id="profile-user-name" className="font-serif text-base font-bold text-bark-900 inline-block">
                  {currentDisplayName || 'Guest visitor'}
                </h4>
                <p id="profile-user-headline" className="text-[10px] text-bark-450 uppercase tracking-wider font-semibold block leading-tight mt-0.5">
                  {currentUser ? currentRoleLabel : 'Sign in to participate'}
                </p>
              </div>

              <div className="border-t border-sand-100 my-4" />
              <div className="space-y-2.5 text-left text-xs" id="profile-stats-block">
                <div className="flex justify-between items-center p-1 rounded">
                  <span className="text-bark-500 font-sans">Your posts</span>
                  <span className="font-mono font-bold text-clay-700 text-[11px]">{currentUser ? ownPosts.length : '—'}</span>
                </div>
                <div className="flex justify-between items-center p-1 rounded">
                  <span className="text-bark-500 font-sans">Engagement received</span>
                  <span className="font-mono font-bold text-clay-700 text-[11px]">{currentUser ? ownEngagements : '—'}</span>
                </div>
                <div className="flex justify-between items-center p-1 rounded">
                  <span className="text-bark-500 font-sans">Membership</span>
                  <span className="font-mono font-bold text-emerald-700 text-[10px] uppercase tracking-wider">
                    {currentUser ? 'Authenticated' : 'Guest'}
                  </span>
                </div>
              </div>

              <div className="border-t border-sand-100 my-4" />
              <div className="space-y-2 text-left" id="profile-shortcuts">
                <a href="#gallery-section" className="flex items-center gap-2.5 text-[11px] text-bark-750 font-semibold hover:text-clay-605 transition-colors p-1 rounded hover:bg-sand-50/50">
                  <Bookmark className="w-3.5 h-3.5 text-bark-400" />
                  <span>{pfUiT('ui.components.creatorblog.5b65b7f2d5')}</span>
                </a>
                <a href="#creator-community-blog-section" className="flex items-center gap-2.5 text-[11px] text-bark-750 font-semibold hover:text-clay-605 transition-colors p-1 rounded hover:bg-sand-50/50">
                  <Users className="w-3.5 h-3.5 text-bark-400" />
                  <span>{pfUiT('ui.components.creatorblog.60d35e7d89')}</span>
                </a>
                <a href="#orbital-featured-section" className="flex items-center gap-2.5 text-[11px] text-bark-750 font-semibold hover:text-clay-605 transition-colors p-1 rounded hover:bg-sand-50/50">
                  <Calendar className="w-3.5 h-3.5 text-bark-400" />
                  <span>{pfUiT('ui.components.creatorblog.736e2f0c10')}</span>
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white border border-sand-200 rounded-[4px] p-5 space-y-4" id="card-start-post">
            <h4 className="text-xs text-bark-400 font-bold uppercase tracking-wider">{pfUiT('ui.components.creatorblog.9de7033c9c')}</h4>
            <p className="text-xs text-bark-550 leading-relaxed">
              {currentUser
                ? pfUiT('ui.components.creatorblog.c05167b3a0')
                : 'Sign in to publish studio updates to the shared Atelier feed.'}
            </p>
            <button
              onClick={handleOpenCreatePost}
              className="w-full py-3 bg-bark-900 hover:bg-bark-800 text-sand-50 rounded-lg transition-all text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              id="btn-trigger-post"
            >
              <Plus className="w-4 h-4" />{currentUser ? pfUiT('ui.components.creatorblog.d9f9285978') : 'Sign in to post'}
            </button>
          </div>

          <div className="bg-white border border-sand-200 rounded-[4px] p-5 space-y-4" id="card-trending-tags">
            <h4 className="text-xs text-bark-400 font-bold uppercase tracking-wider">{pfUiT('ui.components.creatorblog.405060b9af')}</h4>
            <div className="flex flex-col gap-2 font-mono text-xs text-bark-750" id="trending-tags-list">
              {trendingTags.length ? trendingTags.map(({ tag, count }) => (
                <div key={tag} className="flex items-center justify-between p-2 rounded-lg bg-sand-50/40 border border-sand-100">
                  <span>#{tag}</span>
                  <span className="text-[10px] text-bark-400">{count} {count === 1 ? 'post' : 'posts'}</span>
                </div>
              )) : (
                <div className="p-2 text-[10px] text-bark-400">No trending topics yet.</div>
              )}
            </div>
          </div>

          <div className="bg-sand-50 border border-sand-200 rounded-[4px] p-4 flex gap-3 items-start" id="blog-guidelines-box">
            <Sparkles className="w-4 h-4 text-clay-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-[11px] font-semibold text-bark-900 uppercase tracking-wider">{pfUiT('ui.components.creatorblog.4da7209af1')}</h5>
              <p className="text-[10px] text-bark-500 leading-normal">{pfUiT('ui.components.creatorblog.56b96a1805')}</p>
            </div>
          </div>
        </div>

        <div className="order-1 md:order-2 md:col-span-8 space-y-6" id="blog-feed-posts">
          <div className="bg-white border border-sand-200 rounded-[4px] px-4 py-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-bark-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search community posts..."
              className="w-full bg-transparent text-xs text-bark-800 outline-none"
            />
          </div>

          {loading && (
            <div className="bg-white border border-sand-200 rounded-[4px] p-12 flex items-center justify-center gap-2 text-bark-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading community posts…
            </div>
          )}

          {!loading && loadError && (
            <div className="bg-white border border-red-200 rounded-[4px] p-8 text-center text-red-700 text-xs">
              {loadError}
            </div>
          )}

          {!loading && !loadError && filteredPosts.length === 0 && (
            <div className="bg-white border border-sand-200 rounded-[4px] p-12 text-center text-bark-500 font-sans" id="empty-feed">
              {searchQuery.trim()
                ? 'No community posts match this search.'
                : pfUiT('ui.components.creatorblog.db1b92664a')}
            </div>
          )}

          {!loading && !loadError && filteredPosts.map((post) => {
            const isOwner = Boolean(
              currentIdentityId &&
              post.authorIdentityId &&
              currentIdentityId === post.authorIdentityId
            );

            return (
              <article
                key={post.id}
                className="bg-white border border-sand-200 rounded-[4px] p-6 space-y-4 shadow-3xs"
                id={`blog-post-element-${post.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-sand-100 rounded-full flex items-center justify-center border border-sand-200 text-bark-600 font-serif font-bold uppercase shrink-0">
                      {initialsFor(post.author)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-bark-900 leading-none truncate">{post.author}</p>
                      <span className="text-[9px] text-bark-450 uppercase tracking-widest font-mono mt-1 block">
                        {post.role} {post.createdAt ? <>• <Clock className="w-2.5 h-2.5 inline-block text-bark-400" /> {relativeTime(post.createdAt)}</> : null}
                      </span>
                    </div>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post)}
                      disabled={deletingPostId === post.id}
                      className="p-2 text-bark-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Remove your post"
                    >
                      {deletingPostId === post.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-serif font-semibold text-bark-900 leading-snug">{post.title}</h3>
                  <p className="text-xs sm:text-sm text-bark-700 leading-relaxed font-sans whitespace-pre-wrap">{post.content}</p>
                </div>

                {post.image && (
                  <div className="relative aspect-[16/9] bg-sand-50 border border-sand-200/60 rounded-[4px] overflow-hidden">
                    <img src={post.image} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}

                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {post.tags.map((tag) => (
                      <span key={tag} className="bg-sand-50 border border-sand-200 text-bark-600 text-[9px] font-mono font-medium px-2 py-0.5 rounded-full">
                        #{tag.replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                )}

                <div className="border-t border-sand-100 pt-4 flex items-center justify-between text-bark-650">
                  <div className="flex items-center gap-4 text-xs font-semibold text-bark-600">
                    <span className="flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5" /> {post.likes}</span>
                    <span className="flex items-center gap-1.5"><ThumbsDown className="w-3.5 h-3.5" /> {post.dislikes}</span>
                    <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {post.commentCount}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}#blog-post-element-${post.id}`;
                      navigator.clipboard?.writeText(url).catch(() => {});
                      showToast(`Direct link to “${post.title || 'post'}” copied.`);
                    }}
                    className="p-1.5 rounded-lg hover:bg-sand-50 transition-colors text-bark-550 cursor-pointer"
                    title={pfUiT('ui.components.creatorblog.fa6698a97b')}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: UI_LAYERS.modalBackdrop }} id="post-modal-overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsModalOpen(false)}
              className="absolute inset-0 bg-bark-950/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[4px] border border-sand-200 shadow-lux w-full max-w-xl overflow-hidden relative z-10 font-sans"
            >
              <div className="border-b border-sand-150 p-5 flex items-center justify-between bg-sand-50/30">
                <div>
                  <h3 className="font-serif font-medium text-bark-900 text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-clay-605" />{pfUiT('ui.components.creatorblog.97a77e83ca')}
                  </h3>
                  <p className="text-[10px] text-bark-450 mt-1">Publishing as {currentDisplayName}</p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-bark-400 hover:text-bark-700 hover:bg-sand-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePostSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-150">{formError}</div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-title">{pfUiT('ui.components.creatorblog.35bcc60551')}</label>
                  <input
                    type="text"
                    id="input-title"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder={pfUiT('ui.components.creatorblog.ef4ae5f396')}
                    className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-content">{pfUiT('ui.components.creatorblog.084698a4d1')}</label>
                  <textarea
                    id="input-content"
                    value={newContent}
                    onChange={(event) => setNewContent(event.target.value)}
                    rows={5}
                    placeholder={pfUiT('ui.components.creatorblog.f060a54bc2')}
                    className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-tags">Tags (comma-separated)</label>
                  <input
                    type="text"
                    id="input-tags"
                    value={newTags}
                    onChange={(event) => setNewTags(event.target.value)}
                    placeholder={pfUiT('ui.components.creatorblog.b387d43e37')}
                    className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-community-image">Optional image</label>
                  <label className="border border-dashed border-sand-300 rounded-[4px] p-4 flex items-center gap-3 cursor-pointer hover:bg-sand-50 transition-colors" htmlFor="input-community-image">
                    <ImageIcon className="w-5 h-5 text-clay-600" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-bark-800 truncate">{newImageFile?.name || 'Choose an image from your device'}</div>
                      <div className="text-[10px] text-bark-450">The file is uploaded through the authenticated EIP member route.</div>
                    </div>
                  </label>
                  <input
                    id="input-community-image"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => setNewImageFile(event.target.files?.[0] || null)}
                  />
                </div>

                <div className="border-t border-sand-150 pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-white border border-sand-250 text-bark-700 rounded-lg text-sm hover:bg-sand-50 cursor-pointer disabled:opacity-50"
                  >
                    {pfUiT('ui.components.creatorblog.df23e3a312')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-bark-900 hover:bg-bark-800 text-sand-50 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {submitting ? 'Publishing…' : pfUiT('ui.components.creatorblog.73dc4b8dd0')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-bark-900 text-sand-50 border border-sand-700/30 px-4 py-3 rounded-[4px] shadow-xl flex items-center gap-2.5 font-sans"
            id="blog-toast-notification"
          >
            <Sparkles className="w-4.5 h-4.5 text-clay-450 animate-pulse" />
            <span className="text-xs font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
