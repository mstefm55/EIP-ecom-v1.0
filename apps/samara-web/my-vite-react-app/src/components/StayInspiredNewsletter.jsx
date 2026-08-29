import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Check, Sparkles, AlertCircle, Bookmark, Compass, Scissors } from 'lucide-react';

export default function StayInspiredNewsletter({ addToast }) {
  const [email, setEmail] = useState('');
  const [selectedTopics, setSelectedTopics] = useState(['updates', 'news']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribedData, setSubscribedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Sourced slow-fashion/atelier sewing tips
  const ATELIER_TIPS = [
    "Slow-Fashion Guide: Pre-wash pure linen or cotton twill with lukewarm water to let fibers shrink before laying out pattern blocks.",
    "Tailoring Detail: For crisp lapel folds, cut the undercollar on a true 45-degree bias line and press with a heavy wooden clapper.",
    "Bespoke Assembly: French seams are ideal for lightweight silk slips, while flat-felled seams offer rugged durability on trousers."
  ];

  const [currentTip, setCurrentTip] = useState(ATELIER_TIPS[0]);

  useEffect(() => {
    // Select a random tailoring tip for the subscriber experience
    const randomTip = ATELIER_TIPS[Math.floor(Math.random() * ATELIER_TIPS.length)];
    setCurrentTip(randomTip);
  }, [subscribedData]);

  // Check if already subscribed in localStorage on mount
  useEffect(() => {
    try {
      const savedSubs = runtimeDataStorage.getItem('sartorial_newsletter_subscribers');
      if (savedSubs) {
        const subs = JSON.parse(savedSubs);
        // Find if this browser session has subscribed before
        const sessionSub = subs[subs.length - 1]; // Look at last subscriber as reference
        if (sessionSub && sessionSub.source === 'Join the Atelier Footer') {
          // Keep internal tracking of current state if requested
        }
      }
    } catch (e) {
      console.error("Failed to read existing newsletter state", e);
    }
  }, []);

  const handleTopicToggle = (topic) => {
    setErrorMsg('');
    setSelectedTopics((prev) => {
      if (prev.includes(topic)) {
        if (prev.length === 1) {
          setErrorMsg('Please select at least one inspiration topic to join.');
          return prev;
        }
        return prev.filter((t) => t !== topic);
      } else {
        return [...prev, topic];
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !email.includes('@')) {
      setErrorMsg('Please provide a valid email address.');
      return;
    }

    if (selectedTopics.length === 0) {
      setErrorMsg('Please choose at least one mailing list category.');
      return;
    }

    setIsSubmitting(true);

    // Simulate high-precision indexing queue
    setTimeout(() => {
      try {
        const savedSubsStr = runtimeDataStorage.getItem('sartorial_newsletter_subscribers') || '[]';
        const savedSubs = JSON.parse(savedSubsStr);

        const trimmedEmail = email.trim();
        const nextSub = {
          email: trimmedEmail,
          topics: selectedTopics,
          timestamp: new Date().toISOString(),
          source: 'Join the Atelier Footer'
        };

        const alreadyExists = savedSubs.some(
          (sub) => sub.email.toLowerCase() === trimmedEmail.toLowerCase()
        );

        if (!alreadyExists) {
          savedSubs.push(nextSub);
          runtimeDataStorage.setItem('sartorial_newsletter_subscribers', JSON.stringify(savedSubs));
        }

        setSubscribedData(nextSub);
        setEmail('');

        if (addToast) {
          addToast(
            `Successfully registered ${trimmedEmail} for our tailored updates.`,
            'success',
            'Mailing Verified'
          );
        }
      } catch (err) {
        console.error("Local storage sync error", err);
        setErrorMsg('Could not register subscriber due to browser storage limits.');
      } finally {
        setIsSubmitting(false);
      }
    }, 650);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
      id="stay-inspired-newsletter-widget"
    >
      <div className="space-y-2">
        <span className="text-[10px] font-mono font-bold text-clay-400 uppercase tracking-[0.2em] block">
          JOIN THE COMMUNITY
        </span>
        <h5 className="font-serif text-sand-50 tracking-wide font-semibold text-sm">{pfUiT("ui.components.stayinspirednewsletter.5f45f9c250")}</h5>
        <p className="text-xs text-sand-300/85 leading-relaxed" id="stay-inspired-desc">{pfUiT("ui.components.stayinspirednewsletter.2ccc642076")}</p>
      </div>

      <AnimatePresence mode="wait">
        {!subscribedData ? (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
            id="stay-inspired-form"
          >
            {/* Topic Toggles / Interest Selectors */}
            <div className="space-y-1.5" id="topic-selector-container">
              <label className="text-[9px] font-mono font-bold text-sand-400 uppercase tracking-widest block mb-1">{pfUiT("ui.components.stayinspirednewsletter.01644973f8")}</label>
              <div className="flex flex-wrap gap-2" id="topic-checkboxes">
                {/* Pattern Updates Topic */}
                <button
  type="button"
  onClick={() => handleTopicToggle('updates')}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border text-[10px] font-sans transition-all duration-300 cursor-pointer ${
    selectedTopics.includes('updates')
      ? 'bg-[#e0a894] border-[#e0a894] text-[#1c1917] font-bold shadow-md ring-2 ring-[#e0a894]/30'
      : 'bg-bark-900/40 border-bark-800 text-sand-300 hover:border-[#e0a894] hover:text-sand-50'
  }`}
  id="topic-btn-updates"
>
  <Compass className={`w-3 h-3 ${selectedTopics.includes('updates') ? 'text-[#1c1917]' : 'text-sand-400'}`} />
  <span>{pfUiT("ui.components.stayinspirednewsletter.f7e36c96d7")}</span>
</button>
                {/* Atelier News Topic */}
                <button
  type="button"
  onClick={() => handleTopicToggle('news')}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border text-[10px] font-sans transition-all duration-300 cursor-pointer ${
    selectedTopics.includes('news')
      ? 'bg-[#e0a894] border-[#e0a894] text-[#1c1917] font-bold shadow-md ring-2 ring-[#e0a894]/30'
      : 'bg-bark-900/40 border-bark-800 text-sand-300 hover:border-[#e0a894] hover:text-sand-50'
  }`}
  id="topic-btn-news"
>
  <Sparkles className={`w-3 h-3 ${selectedTopics.includes('news') ? 'text-[#1c1917]' : 'text-sand-400'}`} />
  <span>{pfUiT("ui.components.stayinspirednewsletter.bde5a8b7c5")}</span>
</button>
              </div>
            </div>

            {/* Email field and register action */}
            <div className="space-y-1.5">
              <div className="flex gap-2 relative" id="email-field-wrapper">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  type="email"
                  placeholder={pfUiT("ui.components.stayinspirednewsletter.bfac95637d")}
                  value={email}
                  onChange={(e) => {
                    setErrorMsg('');
                    setEmail(e.target.value);
                  }}
                  required
                  className="bg-bark-900/60 border border-bark-800 text-sand-50 text-xs pl-9 pr-3.5 py-2.5 rounded-[4px] focus:outline-none focus:border-clay-500 w-full transition-colors placeholder-sand-500"
                  id="stay-inspired-email-input"
                />
                <button
  className="bg-[#e0a894] hover:bg-[#d28b6d] text-[#1c1917] font-bold px-5 py-3 rounded-md"
>
  {isSubmitting ? (
    <span className="w-3.5 h-3.5 border-2 border-[#1c1917] border-t-transparent rounded-full animate-spin" />
  ) : (
    <span>{pfUiT("ui.components.stayinspirednewsletter.932a821c29")}</span>
  )}
</button>
              </div>

              {/* Validation warnings */}
              {errorMsg && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[11px] text-rose-400 flex items-center gap-1.5 font-sans"
                  id="stay-inspired-error"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </motion.p>
              )}
            </div>
          </motion.form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-bark-900/50 border border-bark-800 rounded-[4px] space-y-3.5 text-left"
            id="stay-inspired-success-panel"
          >
            <div className="flex items-center gap-2 text-emerald-400" id="success-header">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-serif font-bold tracking-wide">{pfUiT("ui.components.stayinspirednewsletter.0db771155e")}</span>
            </div>

            <p className="text-[11px] text-sand-300/90 leading-relaxed font-sans" id="success-code-info">{pfUiT("ui.components.stayinspirednewsletter.555c025d18")}<b className="text-amber-300 font-mono select-all bg-bark-900 px-1.5 py-0.5 rounded border border-bark-800">ARTISAN15</b>{pfUiT("ui.components.stayinspirednewsletter.02294664b2")}<span className="font-semibold text-sand-50">{pfUiT("ui.components.stayinspirednewsletter.045a07fa93")}</span>{pfUiT("ui.components.stayinspirednewsletter.84e5e7d9e1")}</p>

            <div className="pt-2.5 border-t border-bark-800/80 space-y-1" id="success-tailored-tip">
              <div className="flex items-center gap-1 text-[9.5px] font-mono text-clay-400 uppercase font-bold tracking-wider">
                <Sparkles className="w-3 h-3 text-clay-400" />
                <span>Subscribed Interests: {subscribedData.topics.map(t => t === 'updates' ? 'Pattern Updates' : t === 'news' ? 'Perfect Fit News' : t).join(' & ')}</span>
              </div>
              <p className="text-[10.5px] text-sand-400 leading-normal italic pl-1 font-sans">
                "{currentTip}"
              </p>
            </div>

            <button
              onClick={() => setSubscribedData(null)}
              className="text-[10px] font-mono text-sand-400/80 hover:text-sand-100 underline underline-offset-2 transition-colors uppercase font-bold"
              id="resubscribe-btn"
              type="button"
            >{pfUiT("ui.components.stayinspirednewsletter.da68683d32")}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
