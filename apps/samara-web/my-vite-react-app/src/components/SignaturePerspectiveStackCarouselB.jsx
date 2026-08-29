import React, { useMemo, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

function normalizeDelta(index, activeIndex, length) {
  let delta = index - activeIndex;

  if (delta > length / 2) delta -= length;
  if (delta < -length / 2) delta += length;

  return delta;
}

function getPatternImage(pattern) {
  return (
    pattern?.image ||
    pattern?.imageUrl ||
    pattern?.coverImage ||
    pattern?.cover ||
    pattern?.thumbnail ||
    pattern?.heroImage ||
    pattern?.media?.[0]?.url ||
    ''
  );
}

function formatPrice(value) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return value || '$0.00';
  return `$${amount.toFixed(2)}`;
}

function CardImage({ pattern }) {
  const image = getPatternImage(pattern);

  if (!image) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-sand-100 via-sand-50 to-bark-100" />
    );
  }

  return (
    <img
      src={image}
      alt={pattern.name}
      className="absolute inset-0 h-full w-full object-cover"
      draggable="false"
    />
  );
}

function PatternCard({
  pattern,
  isActive,
  style,
  onClick,
  onQuickView
}) {
  const category = pattern.category || pattern.mainCategory || 'Pattern';
  const difficulty = pattern.difficulty || 'Intermediate';
  const price = formatPrice(pattern.pricePDF ?? pattern.price);

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 cursor-pointer will-change-transform"
      style={style}
      onClick={onClick}
      initial={false}
      animate={style}
      transition={{
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      <div
        className={`relative flex aspect-[3/4.1] w-[160px] flex-col justify-end overflow-hidden rounded-[12px] bg-white transition-all duration-700 sm:w-[205px] md:w-[255px] lg:w-[305px] ${
          isActive
            ? 'shadow-[0_42px_100px_rgba(45,30,21,0.24)] ring-1 ring-white/95'
            : 'shadow-[0_22px_54px_rgba(45,30,21,0.13)] ring-1 ring-white/60'
        }`}
      >
        <CardImage pattern={pattern} />

        <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/16 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/55 to-transparent" />

        <div className="absolute left-4 top-4 z-20">
          <span
            className={`rounded-[7px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
              isActive
                ? 'bg-clay-700/90 text-sand-50'
                : 'bg-bark-900/82 text-sand-50'
            }`}
          >
            {String(category).replaceAll('-', ' ')}
          </span>
        </div>

        <div className="absolute right-4 top-4 z-20">
          <span className="rounded-[7px] bg-white/88 px-3 py-1.5 text-[10px] font-semibold text-bark-700 shadow-sm ring-1 ring-white/60">
            {difficulty}
          </span>
        </div>

        {isActive && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onQuickView?.(pattern);
            }}
            className="absolute left-1/2 top-1/2 z-30 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-white/18 text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all hover:bg-white/26 hover:scale-105"
            aria-label={`View ${pattern.name}`}
            title={`View ${pattern.name}`}
          >
            <Eye className="h-5 w-5" />
          </button>
        )}

        <div className="relative z-20 p-5 text-white">
          <h4 className="max-w-[95%] font-serif text-base font-semibold leading-tight drop-shadow-sm md:text-xl">
            {pattern.name}
          </h4>

          <p className="mt-2 text-xs font-medium tracking-wide text-sand-100/90">
            Pattern No. {pattern.patternNo || pattern.number || pattern.id || '12'}
          </p>

          <div className="mt-3 h-px w-7 bg-sand-100/80" />

          <p className="mt-3 font-mono text-sm font-bold text-sand-50 md:text-base">
            From {price}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function SignaturePerspectiveStackCarouselB({
  patterns = [],
  title = 'Our Signature Collections',
  subtitle = 'Let Your Uniqueness Take Shape',
  label = 'Version B · 3D Perspective Stack',
  showLabel = false,
  onQuickView,
  onFocusPattern
}) {
  const safePatterns = useMemo(() => patterns.filter(Boolean).slice(0, 10), [patterns]);
  const [activeIndex, setActiveIndex] = useState(0);

  const total = safePatterns.length;

  if (!total) return null;

  const goPrev = () => {
    setActiveIndex((current) => (current - 1 + total) % total);
  };

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % total);
  };

  const focusCard = (index, pattern) => {
    if (index === activeIndex) {
      onQuickView?.(pattern);
      return;
    }

    setActiveIndex(index);
    onFocusPattern?.(pattern);
  };

  return (
    <section className="relative overflow-hidden bg-[#FAF8F5] px-4 py-20 sm:px-6 lg:px-8" id="signature-perspective-stack-carousel-b">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(194,107,74,0.05)_0%,rgba(250,248,245,0)_46%)]" />

      {showLabel && (
        <div className="absolute right-6 top-8 z-20 hidden rounded-xl border border-sand-200 bg-sand-100/70 px-4 py-2 text-xs font-semibold text-bark-700 shadow-sm backdrop-blur-sm md:block">
          {label}
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-5 text-center">
          <h2 className="font-serif text-5xl font-light leading-none tracking-tight text-bark-950 sm:text-6xl lg:text-7xl">{pfUiT("ui.components.signatureperspectivestackcarouselb.fa4e9f2983")}<span className="italic text-clay-700">{pfUiT("ui.components.signatureperspectivestackcarouselb.57afea2eef")}</span>{pfUiT("ui.components.signatureperspectivestackcarouselb.f2fc44ed4f")}</h2>

          <p className="mt-5 font-serif text-2xl italic leading-relaxed text-bark-600 sm:text-3xl">
            {subtitle}
          </p>
        </div>

        <div
          className="relative mx-auto h-[570px] max-w-[1500px] overflow-visible md:h-[650px] lg:h-[690px]"
          style={{ perspective: '1700px' }}
          id="signature-stack-stage-b"
        >
          <div className="pointer-events-none absolute left-1/2 top-[78%] h-[145px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,30,21,0.14)_0%,rgba(194,107,74,0.08)_36%,transparent_72%)] blur-3xl" />

          <div className="pointer-events-none absolute left-1/2 top-[76%] h-[92px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(194,107,74,0.14)_0%,transparent_70%)]" />

          {safePatterns.map((pattern, index) => {
            const delta = normalizeDelta(index, activeIndex, total);
            const abs = Math.abs(delta);

            if (abs > 4) {
              return null;
            }

            const isActive = delta === 0;
            const direction = delta < 0 ? -1 : 1;

            const xMap = {
              0: 0,
              1: 330,
              2: 560,
              3: 735,
              4: 875
            };

            const yMap = {
              0: -4,
              1: 36,
              2: 58,
              3: 76,
              4: 88
            };

            const scaleMap = {
              0: 1.1,
              1: 0.88,
              2: 0.7,
              3: 0.54,
              4: 0.42
            };

            const rotateYMap = {
              0: 0,
              1: -10,
              2: -16,
              3: -22,
              4: -28
            };

            const opacityMap = {
              0: 1,
              1: 0.78,
              2: 0.55,
              3: 0.34,
              4: 0.2
            };

            const x = isActive ? 0 : direction * xMap[abs];
            const y = yMap[abs];
            const scale = scaleMap[abs];
            const rotateY = direction * rotateYMap[abs];
            const rotateZ = isActive ? 0 : direction * (abs * 0.75);
            const opacity = opacityMap[abs];
            const zIndex = isActive ? 90 : 80 - abs * 12;
            const zDepth = isActive ? 140 : -abs * 115;
            const filter = isActive
              ? 'none'
              : `saturate(${Math.max(0.55, 0.9 - abs * 0.1)}) brightness(${Math.max(0.62, 0.9 - abs * 0.09)})`;

            const style = {
              transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${zDepth}px) scale(${scale}) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
              opacity,
              zIndex,
              filter,
              transformStyle: 'preserve-3d'
            };

            return (
              <PatternCard
                key={pattern.id || index}
                pattern={pattern}
                isActive={isActive}
                style={style}
                onClick={() => focusCard(index, pattern)}
                onQuickView={onQuickView}
              />
            );
          })}

          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-[56%] z-[110] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-sand-200 bg-white/92 text-bark-800 shadow-[0_16px_35px_rgba(45,30,21,0.12)] transition-all hover:bg-white hover:scale-105 active:scale-95 md:left-8"
            aria-label={pfUiT("ui.components.signatureperspectivestackcarouselb.4889c7f791")}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-[56%] z-[110] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-sand-200 bg-white/92 text-bark-800 shadow-[0_16px_35px_rgba(45,30,21,0.12)] transition-all hover:bg-white hover:scale-105 active:scale-95 md:right-8"
            aria-label={pfUiT("ui.components.signatureperspectivestackcarouselb.c243e94318")}
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="absolute bottom-8 left-1/2 z-[115] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#FAF8F5]/80 px-4 py-2 backdrop-blur-sm">
            {safePatterns.map((pattern, index) => (
              <button
                key={pattern.id || index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-3 rounded-full transition-all duration-300 ${
                  activeIndex === index
                    ? 'w-3 bg-clay-700 shadow-[0_0_0_4px_rgba(194,107,74,0.12)]'
                    : 'w-3 bg-bark-300/35 hover:bg-bark-400/60'
                }`}
                aria-label={`Show pattern ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}