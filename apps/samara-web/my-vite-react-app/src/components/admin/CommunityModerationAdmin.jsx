import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { eipApiAdapter } from '../../lib/eipApiAdapter';

const REASONS = [
  ['abusive_language', 'Abusive language / profanity'],
  ['harassment_or_insult', 'Harassment or personal insult'],
  ['threatening_language', 'Threatening or harmful language'],
  ['spam_or_off_topic', 'Spam or off-topic content'],
  ['privacy_or_personal_data', 'Privacy or personal-data concern'],
  ['copyright_or_unauthorized_content', 'Copyright / unauthorized content'],
  ['other', 'Other moderation ground']
];

const normalize = (value) => String(value || '').trim();

function statusFor(post) {
  if (post?.moderation?.state === 'pending_review') return 'pending';
  if (post?.status === 'published' || post?.status === 'approved' || post?.status === 'visible') return 'published';
  return 'unpublished';
}

function badgeClasses(status) {
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return 'border-sand-250 bg-sand-100 text-bark-600';
}

export default function CommunityModerationAdmin() {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [reasonCode, setReasonCode] = useState('harassment_or_insult');
  const [reasonDetail, setReasonDetail] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await eipApiAdapter.listAdminCommunityPosts({ filter, q: query });
      const rows = Array.isArray(response?.posts) ? response.posts : [];
      setPosts(rows);
      setActiveId((current) => {
        if (current && rows.some((row) => String(row.id) === String(current))) return current;
        return rows[0]?.id || '';
      });
    } catch (err) {
      setPosts([]);
      setActiveId('');
      setError(err?.message || err?.code || 'Unable to load Community Feedback moderation.');
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(load, 30000);
    const refresh = () => load();
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  const selected = useMemo(
    () => posts.find((post) => String(post.id) === String(activeId)) || null,
    [posts, activeId]
  );

  useEffect(() => {
    setReasonDetail('');
    setMessage('');
    const automated = selected?.moderation?.criteria?.[0]?.code;
    if (automated && REASONS.some(([code]) => code === automated)) setReasonCode(automated);
  }, [selected?.id]);

  const act = async (action) => {
    if (!selected?.id) return;
    if (action === 'unpublish' && !normalize(reasonCode) && !normalize(reasonDetail)) {
      setError('A moderation reason is required before unpublishing.');
      return;
    }
    setBusyAction(action);
    setError('');
    setMessage('');
    try {
      await eipApiAdapter.moderateCommunityPost(selected.id, {
        action,
        reason_code: reasonCode,
        reason_detail: reasonDetail
      });
      setMessage(action === 'unpublish'
        ? 'Post unpublished. A registered author will receive the moderation reason.'
        : 'Post published/restored to the public Community Feedback feed.');
      await load();
    } catch (err) {
      setError(err?.message || err?.code || 'Unable to apply moderation action.');
    } finally {
      setBusyAction('');
    }
  };

  const deletePost = async () => {
    if (!selected?.id) return;
    if (!normalize(reasonCode) && !normalize(reasonDetail)) {
      setError('A moderation reason is required before permanent deletion.');
      return;
    }
    if (!window.confirm('Permanently delete this Community Feedback post? This removes the post content from EIP and cannot be undone.')) return;
    setBusyAction('delete');
    setError('');
    setMessage('');
    try {
      await eipApiAdapter.deleteCommunityPostPermanently(selected.id, {
        reason_code: reasonCode,
        reason_detail: reasonDetail
      });
      setMessage('Post permanently deleted. The moderation ground remains in the EIP audit record.');
      setActiveId('');
      await load();
    } catch (err) {
      setError(err?.message || err?.code || 'Unable to permanently delete this post.');
    } finally {
      setBusyAction('');
    }
  };

  const selectedStatus = statusFor(selected);
  const pendingCount = posts.filter((post) => statusFor(post) === 'pending').length;

  return (
    <section className="space-y-4 rounded-2xl border border-sand-200 bg-white p-5" id="community-moderation-admin">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-clay-700">
            <MessageSquareWarning className="h-4 w-4" /> Community moderation
          </div>
          <h4 className="font-serif text-xl text-bark-950">Community Feedback safety &amp; trust</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-bark-550">
            Normal feedback publishes immediately. Automated safety screening only holds clearly abusive, insulting or threatening content for review. PF Admin can unpublish, restore or permanently delete a post with an auditable reason.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-sand-250 bg-[#FAF8F5] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-bark-700 hover:bg-sand-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          ['pending', 'Pending review'],
          ['published', 'Published'],
          ['unpublished', 'Unpublished'],
          ['all', 'All']
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${
              filter === id
                ? 'border-bark-900 bg-bark-900 text-white'
                : 'border-sand-250 bg-white text-bark-600 hover:border-clay-300'
            }`}
          >
            {label}{id === 'pending' && pendingCount ? ` (${pendingCount})` : ''}
          </button>
        ))}
        <div className="ml-auto flex min-w-[240px] items-center gap-2 rounded-xl border border-sand-200 bg-[#FAF8F5] px-3 py-2">
          <Search className="h-3.5 w-3.5 text-bark-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search post or author"
            className="min-w-0 flex-1 bg-transparent text-[10px] text-bark-900 outline-none placeholder:text-bark-350"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-xl border border-sand-200 bg-[#FAF8F5] p-3">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-bark-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : posts.length ? (
            <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
              {posts.map((post) => {
                const status = statusFor(post);
                const active = String(post.id) === String(activeId);
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setActiveId(post.id)}
                    className={`w-full rounded-xl border p-3 text-left ${active ? 'border-clay-400 bg-white' : 'border-transparent bg-white/70 hover:border-sand-250'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-[10px] font-semibold text-bark-900">{post.title || post.code}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[7px] font-bold uppercase tracking-wider ${badgeClasses(status)}`}>{status}</span>
                    </div>
                    <div className="mt-1 truncate text-[8px] text-bark-450">{post.author?.name || 'Community member'}</div>
                    <div className="mt-1 font-mono text-[7px] uppercase tracking-wider text-bark-350">{post.code}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center text-center text-[10px] text-bark-400">
              No Community Feedback posts in this moderation view.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-sand-200 bg-white p-4">
          {!selected ? (
            <div className="flex min-h-[300px] items-center justify-center text-[10px] text-bark-400">Select a Community Feedback post.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-150 pb-3">
                <div>
                  <h5 className="font-serif text-lg text-bark-950">{selected.title || selected.code}</h5>
                  <p className="mt-1 text-[9px] text-bark-450">{selected.author?.name || 'Community member'} · {selected.code}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider ${badgeClasses(selectedStatus)}`}>{selectedStatus}</span>
              </div>

              {selected.image_url && (
                <img src={selected.image_url} alt="" className="max-h-56 w-full rounded-xl border border-sand-200 object-contain bg-[#FAF8F5]" />
              )}

              <div className="rounded-xl border border-sand-150 bg-[#FAF8F5] p-3 text-[10px] leading-relaxed text-bark-650 whitespace-pre-wrap">
                {selected.body || 'No text content.'}
              </div>

              {selected.moderation?.state === 'pending_review' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-amber-900">
                    <ShieldAlert className="h-3.5 w-3.5" /> Automated hold
                  </div>
                  <p className="mt-1 text-[9px] leading-relaxed text-amber-800">
                    {selected.moderation?.message || 'Automated safety screening held this post for administrator review.'}
                  </p>
                  {!!selected.moderation?.criteria?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selected.moderation.criteria.map((criterion) => (
                        <span key={criterion.code || criterion.label} className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[8px] text-amber-800">
                          {criterion.label || criterion.code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-bark-500">
                  Moderation ground
                  <select
                    value={reasonCode}
                    onChange={(event) => setReasonCode(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-sand-250 bg-white px-3 py-2.5 text-[10px] font-normal normal-case tracking-normal text-bark-800 outline-none"
                  >
                    {REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </label>
                <label className="text-[9px] font-bold uppercase tracking-wider text-bark-500">
                  Explanation to author
                  <textarea
                    value={reasonDetail}
                    onChange={(event) => setReasonDetail(event.target.value)}
                    placeholder="Explain why this post is being moderated. Registered authors receive this explanation."
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-sand-250 bg-white px-3 py-2.5 text-[10px] font-normal normal-case tracking-normal text-bark-800 outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-sand-150 pt-3">
                {selectedStatus === 'published' ? (
                  <button
                    type="button"
                    onClick={() => act('unpublish')}
                    disabled={!!busyAction}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-amber-900 disabled:opacity-40"
                  >
                    {busyAction === 'unpublish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => act(selectedStatus === 'pending' ? 'publish' : 'restore')}
                    disabled={!!busyAction}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-emerald-900 disabled:opacity-40"
                  >
                    {busyAction === 'publish' || busyAction === 'restore' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {selectedStatus === 'pending' ? 'Publish after review' : 'Restore post'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={deletePost}
                  disabled={!!busyAction}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white hover:bg-rose-800 disabled:opacity-40"
                >
                  {busyAction === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete permanently
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-[8.5px] leading-relaxed text-bark-450">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay-700" />
                Permanent deletion removes the post content and its process instance. EIP retains only a moderation tombstone with the post reference, content hash, administrator identity and stated ground for auditability.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
