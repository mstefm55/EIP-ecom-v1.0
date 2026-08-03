/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ThumbsUp, ThumbsDown, MessageSquare, Send, Sparkles, Plus,
  Tag, Search, Clock, MessageCircle, X, Image as ImageIcon, User, CheckCircle2,
  Bookmark, Users, Calendar
} from 'lucide-react';

import dressImg from '../assets/images/pattern_dress_1782223486101.jpg';
import trenchImg from '../assets/images/pattern_trench_1782223501914.jpg';
import trouserImg from '../assets/images/pattern_trouser_1782223515288.jpg';
import blouseImg from '../assets/images/pattern_blouse_1782223531046.jpg';

const PRESET_POSTS = [
  {
    id: 'blog-post-01',
    author: 'Mina Razak',
    role: 'Pattern maker',
    time: '2h ago',
    title: 'How we draft clean armhole curves for layered jackets',
    content: 'Today we refined the shoulder balance on the cropped jacket block. We tested three seam allowances and kept the version that behaves best in twill. When designing for medium-weight fabrics, adding exactly 1.2cm of ease under the armscye makes all the difference for active wear.',
    image: trenchImg,
    tags: ['fit-notes', 'jacket', 'pattern-lab'],
    likes: 86,
    dislikes: 2,
    comments: [
      {
        id: 'comment-01-01',
        author: 'Julien S.',
        role: 'Tailoring Enthusiast',
        text: 'This is brilliant! I struggled with sleeve bind on my previous tweed blazer, so adding ease makes total sense.',
        time: '1h ago'
      },
      {
        id: 'comment-01-02',
        author: 'Clara Hughes',
        role: 'Bespoke Atelier Designer',
        text: 'Do you also adjust the sleeve crown height when changing this balance?',
        time: '30m ago'
      }
    ]
  },
  {
    id: 'blog-post-02',
    author: 'Arielle Noor',
    role: 'Community mentor',
    time: 'Yesterday',
    title: 'Sleeve rotation checklist before publishing a pattern',
    content: 'If your sleeve pitch is off by even a few millimeters, mobility suffers. Here is the pre-publish checklist we now use in every sample review to ensure high armhole rotational comfort.',
    image: blouseImg,
    tags: ['fit-notes', 'sleeve-craft', 'maker-stories'],
    likes: 114,
    dislikes: 1,
    comments: [
      {
        id: 'comment-02-01',
        author: 'Marcus Vance',
        role: 'Slow Fashion Maker',
        text: 'I downloaded your checklist and it completely saved my latest silk wrap project! Absolute game-changer.',
        time: '18h ago'
      }
    ]
  }
];

export default function CreatorBlog() {
  const [posts, setPosts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);

  // Create Post Form State
  const [newAuthor, setNewAuthor] = useState('');
  const [newRole, setNewRole] = useState('Pattern maker');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [selectedPresetImage, setSelectedPresetImage] = useState(dressImg);
  const [formError, setFormError] = useState('');

  // New Comment Form State
  const [commentText, setCommentText] = useState('');
  const [commenterName, setCommenterName] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Load from LocalStorage or default presets
  useEffect(() => {
    const saved = localStorage.getItem('sartorial_atelier_blog_posts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPosts(parsed);
        } else {
          setPosts(PRESET_POSTS);
        }
      } catch (e) {
        setPosts(PRESET_POSTS);
      }
    } else {
      setPosts(PRESET_POSTS);
    }
  }, []);

  // Save changes helper
  const savePosts = (updatedPosts) => {
    setPosts(updatedPosts);
    localStorage.setItem('sartorial_atelier_blog_posts', JSON.stringify(updatedPosts));
  };

  // Like interaction
  const handleLike = (postId) => {
    const updated = posts.map(post => {
      if (post.id === postId) {
        let likesCount = post.likes || 0;
        let liked = !!post.likedByUser;
        let disliked = !!post.dislikedByUser;
        let dislikesCount = post.dislikes || 0;

        if (liked) {
          likesCount -= 1;
          liked = false;
        } else {
          likesCount += 1;
          liked = true;
          if (disliked) {
            dislikesCount -= 1;
            disliked = false;
          }
        }
        return { ...post, likes: likesCount, likedByUser: liked, dislikes: dislikesCount, dislikedByUser: disliked };
      }
      return post;
    });
    savePosts(updated);
  };

  // Dislike interaction
  const handleDislike = (postId) => {
    const updated = posts.map(post => {
      if (post.id === postId) {
        let dislikesCount = post.dislikes || 0;
        let disliked = !!post.dislikedByUser;
        let liked = !!post.likedByUser;
        let likesCount = post.likes || 0;

        if (disliked) {
          dislikesCount -= 1;
          disliked = false;
        } else {
          dislikesCount += 1;
          disliked = true;
          if (liked) {
            likesCount -= 1;
            liked = false;
          }
        }
        return { ...post, dislikes: dislikesCount, dislikedByUser: disliked, likes: likesCount, likedByUser: liked };
      }
      return post;
    });
    savePosts(updated);
  };

  // Submit new post
  const handleCreatePostSubmit = (e) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newTitle.trim() || !newContent.trim()) {
      setFormError('Please fill out the Author Name, Post Title, and Content fields.');
      return;
    }

    const tagList = newTags
      .split(',')
      .map(tag => tag.trim().toLowerCase().replace(/#/g, ''))
      .filter(tag => tag.length > 0);

    const newPost = {
      id: `custom-post-${Date.now()}`,
      author: newAuthor,
      role: newRole,
      time: 'Just now',
      title: newTitle,
      content: newContent,
      image: selectedPresetImage,
      tags: tagList.length > 0 ? tagList : ['slow-fashion', 'atelier-notes'],
      likes: 1,
      dislikes: 0,
      comments: []
    };

    const updated = [newPost, ...posts];
    savePosts(updated);

    // Reset Form
    setNewAuthor('');
    setNewRole('Pattern maker');
    setNewTitle('');
    setNewContent('');
    setNewTags('');
    setFormError('');
    setIsModalOpen(false);
  };

  // Submit new comment
  const handleAddComment = (postId) => {
    if (!commentText.trim()) return;
    const author = commenterName.trim() || 'Anonymous Maker';

    const newComment = {
      id: `comment-${Date.now()}`,
      author: author,
      role: 'Atelier Creator',
      text: commentText,
      time: 'Just now'
    };

    const updated = posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...(post.comments || []), newComment]
        };
      }
      return post;
    });

    savePosts(updated);
    setCommentText('');
    setCommenterName('');
  };

  return (
    <div className="bg-sand-50/20 rounded-[4px] border border-sand-200 p-6 md:p-8 space-y-8" id="creator-blog-main">

      {/* HEADER SECTION WITH METRICS PILLS */}
      <div className="bg-white border border-sand-200 rounded-[4px] p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6" id="blog-header">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-serif text-bark-900 tracking-tight leading-tight">
            Creator Blog &amp; Atelier Guild
          </h2>
          <p className="text-xs sm:text-sm text-bark-550 max-w-xl">
            A social-style space for studio updates, behind-the-scenes process posts, and comments. Share your sartorial journey with fellow crafters.
          </p>
        </div>

        {/* Live metrics stats pills */}
        <div className="flex flex-wrap gap-2.5" id="blog-stats-pills">
          <div className="bg-sand-100 border border-sand-250 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-bark-800 uppercase tracking-wider">
            Posts This Week: <b className="text-clay-705">9</b>
          </div>
          <div className="bg-sand-100 border border-sand-250 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-bark-800 uppercase tracking-wider">
            Active Creators: <b className="text-clay-705">42</b>
          </div>
          <div className="bg-sand-100 border border-sand-250 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-bark-800 uppercase tracking-wider">
            Engagement: <b className="text-emerald-700 font-extrabold">+18%</b>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start" id="blog-cols-grid">

        {/* LEFT COLUMN: SIDE ACTIONS & TRENDING TOPICS */}
        <div className="order-2 md:order-1 md:col-span-4 md:sticky md:top-24 space-y-6" id="blog-side-actions">

          {/* LinkedIn-Style User Profile Card */}
          <div className="bg-white border border-sand-200 rounded-[4px] overflow-hidden shadow-3xs" id="sidebar-user-profile-card">
            {/* Cover Banner */}
            <div className="h-16 w-full bg-gradient-to-r from-clay-700 to-bark-800 relative" id="profile-card-banner">
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
            </div>

            {/* Avatar & Info */}
            <div className="px-5 pb-5 text-center relative -mt-8" id="profile-card-details">
              {/* Overlapping Avatar */}
              <div className="w-16 h-16 rounded-full bg-white border-2 border-white shadow-md mx-auto flex items-center justify-center overflow-hidden" id="profile-card-avatar-wrapper">
                <div className="w-full h-full bg-sand-100 flex items-center justify-center text-bark-850 font-serif font-bold text-lg uppercase" id="profile-avatar-circle">
                  ML
                </div>
              </div>

              <div className="mt-2.5">
                <h4
                  id="profile-user-name"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="font-serif text-base font-bold text-bark-900 hover:bg-sand-50 rounded px-1.5 py-0.5 transition-colors cursor-text focus:outline-none focus:ring-1 focus:ring-clay-500 inline-block"
                >
                  Margot Leone
                </h4>
                <p
                  id="profile-user-headline"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[10px] text-bark-450 uppercase tracking-wider font-semibold block leading-tight mt-0.5 hover:bg-sand-50 rounded px-1.5 py-0.5 transition-colors cursor-text focus:outline-none focus:ring-1 focus:ring-clay-500"
                >
                  Bespoke Pattern Cutter &amp; Atelier Member
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-sand-100 my-4" />

              {/* Profile Stats */}
              <div className="space-y-2.5 text-left text-xs" id="profile-stats-block">
                <div className="flex justify-between items-center group/stat cursor-pointer hover:bg-sand-50/50 p-1 rounded transition-colors">
                  <span className="text-bark-500 font-sans">Who viewed your profile</span>
                  <span className="font-mono font-bold text-clay-700 text-[11px]">342</span>
                </div>
                <div className="flex justify-between items-center group/stat cursor-pointer hover:bg-sand-50/50 p-1 rounded transition-colors">
                  <span className="text-bark-500 font-sans">Views of your post</span>
                  <span className="font-mono font-bold text-clay-700 text-[11px]">1,894</span>
                </div>
                <div className="flex justify-between items-center group/stat cursor-pointer hover:bg-sand-50/50 p-1 rounded transition-colors">
                  <span className="text-bark-500 font-sans">Guild connection level</span>
                  <span className="font-mono font-bold text-emerald-700 text-[10px] uppercase tracking-wider">Gold Artisan</span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-sand-100 my-4" />

              {/* Shortcuts / Saved items */}
              <div className="space-y-2 text-left" id="profile-shortcuts">
                <a href="#gallery-section" className="flex items-center gap-2.5 text-[11px] text-bark-750 font-semibold hover:text-clay-605 transition-colors p-1 rounded hover:bg-sand-50/50">
                  <Bookmark className="w-3.5 h-3.5 text-bark-400" />
                  <span>My Saved Blueprints</span>
                </a>
                <a href="#creator-community-blog-section" className="flex items-center gap-2.5 text-[11px] text-bark-750 font-semibold hover:text-clay-605 transition-colors p-1 rounded hover:bg-sand-50/50">
                  <Users className="w-3.5 h-3.5 text-bark-400" />
                  <span>Atelier Guild Groups</span>
                </a>
                <a href="#orbital-featured-section" className="flex items-center gap-2.5 text-[11px] text-bark-750 font-semibold hover:text-clay-605 transition-colors p-1 rounded hover:bg-sand-50/50">
                  <Calendar className="w-3.5 h-3.5 text-bark-400" />
                  <span>Seasonal Guild Events</span>
                </a>
              </div>

            </div>
          </div>

          {/* Start a Post Card */}
          <div className="bg-white border border-sand-200 rounded-[4px] p-5 space-y-4" id="card-start-post">
            <h4 className="text-xs text-bark-400 font-bold uppercase tracking-wider">
              Start a post
            </h4>
            <p className="text-xs text-bark-550 leading-relaxed">
              Share a fitting note, production tip, or launch update with your audience in the Atelier Feed.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 bg-bark-900 hover:bg-bark-800 text-sand-50 rounded-lg transition-all text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              id="btn-trigger-post"
            >
              <Plus className="w-4 h-4" /> Create post
            </button>
          </div>

          {/* Trending Topics Card */}
          <div className="bg-white border border-sand-200 rounded-[4px] p-5 space-y-4" id="card-trending-tags">
            <h4 className="text-xs text-bark-400 font-bold uppercase tracking-wider">
              Trending topics
            </h4>
            <div className="flex flex-col gap-2 font-mono text-xs text-bark-750" id="trending-tags-list">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-sand-50 border border-transparent hover:border-sand-150 transition-all cursor-pointer">
                <span>#patternlab</span>
                <span className="text-[10px] text-bark-400">12 posts</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-sand-50 border border-transparent hover:border-sand-150 transition-all cursor-pointer">
                <span>#fit-notes</span>
                <span className="text-[10px] text-bark-400">28 posts</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-sand-50 border border-transparent hover:border-sand-150 transition-all cursor-pointer">
                <span>#makerstories</span>
                <span className="text-[10px] text-bark-400">19 posts</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-sand-50 border border-transparent hover:border-sand-150 transition-all cursor-pointer">
                <span>#samaradrop</span>
                <span className="text-[10px] text-bark-400">8 posts</span>
              </div>
            </div>
          </div>

          {/* Guidelines info card */}
          <div className="bg-sand-50 border border-sand-200 rounded-[4px] p-4 flex gap-3 items-start" id="blog-guidelines-box">
            <Sparkles className="w-4 h-4 text-clay-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-[11px] font-semibold text-bark-900 uppercase tracking-wider">Atelier Conduct Code</h5>
              <p className="text-[10px] text-bark-500 leading-normal">
                Encouraging high quality sizing discussions, construction diaries, and supportive feedback. No commercial self-promotions.
              </p>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: MAIN BLOG POSTS FEED */}
        <div className="order-1 md:order-2 md:col-span-8 space-y-6" id="blog-feed-posts">

           {posts.length === 0 && (
            <div className="bg-white border border-sand-200 rounded-[4px] p-12 text-center text-bark-500 font-sans" id="empty-feed">
              No articles are currently published. Be the first to start a thread!
            </div>
          )}

          {posts.map((post) => {
            const showComments = activeCommentPostId === post.id;
            const authorText = post.author || 'Anonymous';
            const commentsList = post.comments || [];
            const tagsList = post.tags || [];

            return (
              <div
                key={post.id}
                className="bg-white border border-sand-200 rounded-[4px] p-6 space-y-4 shadow-3xs"
                id={`blog-post-element-${post.id}`}
              >
                {/* Author row */}
                <div className="flex items-center justify-between" id="post-author-row">
                  <div className="flex items-center gap-3" id="author-meta">
                    {/* Placeholder Avatar */}
                    <div className="w-10 h-10 bg-sand-100 rounded-full flex items-center justify-center border border-sand-200 text-bark-600 font-serif font-bold uppercase" id="avatar-circle">
                      {authorText.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-bark-900 leading-none">
                        {authorText}
                      </p>
                      <span className="text-[9px] text-bark-450 uppercase tracking-widest font-mono mt-0.5 block">
                        {post.role || 'Maker'} • <Clock className="w-2.5 h-2.5 inline-block text-bark-400" /> {post.time || 'Just now'}
                      </span>
                    </div>
                  </div>

                  {/* Circle badge indicator */}
                  <div className="w-2 h-2 rounded-full bg-clay-500" />
                </div>

                {/* Title & Body */}
                <div className="space-y-2" id="post-text-body">
                  <h3 className="text-base font-serif font-semibold text-bark-900 leading-snug">
                    {post.title || ''}
                  </h3>
                  <p className="text-xs sm:text-sm text-bark-700 leading-relaxed font-sans">
                    {post.content || ''}
                  </p>
                </div>

                {/* Attachment Image */}
                {post.image && (
                  <div className="relative aspect-[16/9] bg-sand-50 border border-sand-200/60 rounded-[4px] overflow-hidden" id="post-img-wrapper">
                    <img
                      src={post.image}
                      alt={post.title || ''}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap gap-1.5 pt-1" id="post-tags-row">
                  {tagsList.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-sand-50 border border-sand-200 text-bark-600 text-[9px] font-mono font-medium px-2 py-0.5 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Social Interactions footer panel */}
                <div className="border-t border-sand-100 pt-4 flex items-center justify-between text-bark-650" id="post-social-panel">

                  {/* Left interactions */}
                  <div className="flex items-center gap-4" id="left-actions">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
                        post.likedByUser
                          ? 'bg-clay-50 text-clay-700'
                          : 'hover:bg-sand-50 text-bark-600'
                      }`}
                      id="action-like-btn"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${post.likedByUser ? 'fill-clay-605 text-clay-605' : ''}`} />
                      <span>{post.likes || 0}</span>
                    </button>

                    <button
                      onClick={() => handleDislike(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
                        post.dislikedByUser
                          ? 'bg-sand-100 text-bark-900'
                          : 'hover:bg-sand-50 text-bark-600'
                      }`}
                      id="action-dislike-btn"
                    >
                      <ThumbsDown className={`w-3.5 h-3.5 ${post.dislikedByUser ? 'fill-bark-800 text-bark-800' : ''}`} />
                      <span>{post.dislikes || 0}</span>
                    </button>

                    <button
                      onClick={() => setActiveCommentPostId(showComments ? null : post.id)}
                      className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
                        showComments
                          ? 'bg-sand-100 text-bark-900'
                          : 'hover:bg-sand-50 text-bark-600'
                      }`}
                      id="action-comments-toggle"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-bark-500" />
                      <span>Comments ({commentsList.length})</span>
                    </button>
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center gap-2" id="right-actions">
                    <button
                      onClick={() => {
                        setToastMessage(`Direct link to post "${post.title || 'Entry'}" copied to clipboard!`);
                        setTimeout(() => setToastMessage(''), 3000);
                      }}
                      className="p-1.5 rounded-lg hover:bg-sand-50 transition-colors text-bark-550 cursor-pointer"
                      title="Copy Link to Post"
                      id="action-share-btn"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>

                {/* NESTED COMMENTS COLLAPSIBLE AREA */}
                <AnimatePresence>
                  {showComments && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-sand-100 pt-4 space-y-4"
                      id={`comments-drawer-${post.id}`}
                    >
                      <h4 className="text-[10px] text-bark-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <MessageCircle className="w-3 h-3 text-clay-605" /> Review Comments
                      </h4>

                      {/* Comments Feed List */}
                      {commentsList.length === 0 ? (
                        <p className="text-[11px] text-bark-450 italic pl-1">
                          No comment has been registered for this entry.
                        </p>
                      ) : (
                        <div className="space-y-3 pl-1" id="comments-list">
                          {commentsList.map((comment) => (
                            <div
                              key={comment.id}
                              className="bg-sand-50/50 border border-sand-150 p-3.5 rounded-[4px] space-y-1.5 font-sans"
                              id={`comment-element-${comment.id}`}
                            >
                              <div className="flex justify-between items-start" id="comment-meta">
                                <div>
                                  <strong className="text-xs text-bark-900 block font-bold leading-none">
                                    {comment.author || 'Anonymous'}
                                  </strong>
                                  <span className="text-[9px] text-bark-400 font-mono tracking-wider block mt-0.5">
                                    {comment.role || 'Member'}
                                  </span>
                                </div>
                                <span className="text-[9px] text-bark-400 font-mono">
                                  {comment.time || 'Just now'}
                                </span>
                              </div>
                              <p className="text-xs text-bark-700 leading-normal">
                                {comment.text || ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Write a comment interface */}
                      <div className="bg-sand-50/45 border border-sand-150/80 p-4 rounded-[4px] space-y-3" id="write-comment-card">
                        <h5 className="text-[10px] text-bark-500 font-bold uppercase tracking-wider">
                          Leave a remark
                        </h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="comment-inputs-grid">
                          <input
                            type="text"
                            placeholder="Your Name (e.g. Margot L.)"
                            value={commenterName}
                            onChange={(e) => setCommenterName(e.target.value)}
                            className="bg-white border border-sand-200 rounded-lg px-3 py-1.5 text-xs text-bark-800 focus:outline-none focus:ring-1 focus:ring-clay-500"
                            id="commenter-name-input"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Type your comment..."
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              className="flex-1 bg-white border border-sand-200 rounded-lg px-3 py-1.5 text-xs text-bark-800 focus:outline-none focus:ring-1 focus:ring-clay-500"
                              id="comment-text-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddComment(post.id);
                              }}
                            />
                            <button
                              onClick={() => handleAddComment(post.id)}
                              className="px-3 bg-bark-900 hover:bg-bark-800 text-sand-50 rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                              id="comment-submit-btn"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            );
          })}
        </div>

      </div>

      {/* CREATE POST MODAL DIALOG */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="post-modal-overlay">

            {/* Dark background overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-bark-950/40 backdrop-blur-xs"
              id="post-modal-backdrop"
            />

            {/* Modal card content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[4px] border border-sand-200 shadow-lux w-full max-w-xl overflow-hidden relative z-10 font-sans"
              id="post-modal-card"
            >
              {/* Header */}
              <div className="border-b border-sand-150 p-5 flex items-center justify-between bg-sand-50/30" id="post-modal-head">
                <h3 className="font-serif font-medium text-bark-900 text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-clay-605" /> Publish to Atelier Community Feed
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-bark-400 hover:text-bark-700 hover:bg-sand-100 rounded-lg transition-colors cursor-pointer"
                  id="post-modal-close-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleCreatePostSubmit} className="p-6 space-y-4" id="post-modal-form">

                {formError && (
                  <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-150" id="post-form-error">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="author-meta-inputs">
                  <div>
                    <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-author">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      id="input-author"
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      placeholder="e.g. Margot Leone"
                      className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="select-role">
                      Guild Role
                    </label>
                    <select
                      id="select-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full bg-white border border-sand-250 rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="Pattern maker">Pattern maker</option>
                      <option value="Hobbyist Maker">Hobbyist Maker</option>
                      <option value="Community mentor">Community mentor</option>
                      <option value="Atelier Designer">Atelier Designer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-title">
                    Post Title / Entry Subject *
                  </label>
                  <input
                    type="text"
                    id="input-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Adjusting the back waist curve on wide palazzo"
                    className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-content">
                    Story / Tip Content *
                  </label>
                  <textarea
                    id="input-content"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={4}
                    placeholder="Write your sewing tips or custom fitting observations here..."
                    className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-1" htmlFor="input-tags">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    id="input-tags"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="e.g. fit-notes, palazzo, linen"
                    className="w-full bg-white border border-sand-250 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-clay-500"
                  />
                </div>

                {/* Choice of Preset Attachment Image */}
                <div>
                  <span className="block text-[10px] font-bold text-bark-500 uppercase tracking-wider mb-2">
                    Attach Pattern Sample Image
                  </span>
                  <div className="grid grid-cols-4 gap-2.5" id="preset-images-choice">
                    {[
                      { img: dressImg, label: 'Aurelia Wrap' },
                      { img: trenchImg, label: 'Utility Trench' },
                      { img: trouserImg, label: 'Palazzo Pants' },
                      { img: blouseImg, label: 'Asymmetric Blouse' }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPresetImage(item.img)}
                        className={`relative aspect-[4/3] rounded-[4px] overflow-hidden border transition-all cursor-pointer ${
                          selectedPresetImage === item.img
                            ? 'border-clay-500 ring-2 ring-clay-200'
                            : 'border-sand-200 hover:border-sand-300'
                        }`}
                        id={`choose-img-btn-${idx}`}
                      >
                        <img src={item.img} alt={item.label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[8px] text-white font-bold uppercase tracking-wider opacity-0 hover:opacity-100 transition-opacity">
                          {item.label}
                        </div>
                        {selectedPresetImage === item.img && (
                          <div className="absolute top-1 right-1 bg-clay-605 text-white p-0.5 rounded-full" id="checked-badge">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="border-t border-sand-150 pt-4 flex justify-end gap-3" id="post-modal-footer">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-white border border-sand-250 text-bark-700 rounded-lg text-sm hover:bg-sand-50 cursor-pointer"
                    id="post-btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-bark-900 hover:bg-bark-800 text-sand-50 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-1.5"
                    id="post-btn-submit"
                  >
                    <Plus className="w-4 h-4" /> Publish Post
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Native Toast Notification */}
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
