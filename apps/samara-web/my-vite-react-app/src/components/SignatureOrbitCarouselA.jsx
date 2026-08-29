import { useMemo, useRef, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

function mod(n, m) {
  return ((n % m) + m) % m;
}

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

function PatternCardContent({
  pattern,
  isActive,
  onQuickView,
  mobile = false
}) {
  const category = pattern.category || pattern.mainCategory || 'Pattern';
  const difficulty = pattern.difficulty || 'Intermediate';
  const price = formatPrice(pattern.pricePDF ?? pattern.price);

  return (
    <div
      className={`relative flex flex-col justify-end overflow-hidden bg-white ${
        mobile
          ? 'aspect-[4/5] w-full rounded-[20px] shadow-[0_28px_70px_rgba(45,30,21,0.22)] ring-1 ring-white/90'
          : `aspect-[3/4.12] w-[165px] rounded-[14px] transition-all duration-700 sm:w-[205px] md:w-[250px] lg:w-[285px] ${
              isActive
                ? 'shadow-[0_40px_95px_rgba(45,30,21,0.26)] ring-1 ring-white/90'
                : 'shadow-[0_24px_58px_rgba(45,30,21,0.15)] ring-1 ring-white/65'
            }`
      }`}
    >
      <CardImage pattern={pattern} />

      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/18 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />

      <div className="absolute left-4 top-4 z-20">
        <span className="rounded-[7px] bg-bark-900/88 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sand-50 shadow-sm">
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
          className={`absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-white/18 text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/26 ${
            mobile ? 'h-12 w-12' : 'h-7 w-7'
          }`}
          aria-label={`View ${pattern.name}`}
          title={`View ${pattern.name}`}
        >
          <Eye className={mobile ? 'h-6 w-6' : 'h-5 w-5'} />
        </button>
      )}

      <div className={`relative z-20 text-white ${mobile ? 'p-6' : 'p-5'}`}>
        <h4
          className={`max-w-[92%] font-serif font-semibold leading-tight drop-shadow-sm ${
            mobile ? 'text-[28px]' : 'text-lg md:text-xl'
          }`}
        >
          {pattern.name}
        </h4>

        <p
          className={`mt-2 font-medium tracking-wide text-sand-100/90 ${
            mobile ? 'text-sm' : 'text-xs'
          }`}
        >
          Pattern No. {pattern.patternNo || pattern.number || pattern.id || '12'}
        </p>

        <div className={`mt-4 h-px bg-sand-100/80 ${mobile ? 'w-10' : 'w-7'}`} />

        <p
          className={`mt-4 font-mono font-bold text-sand-50 ${
            mobile ? 'text-xl' : 'text-sm md:text-base'
          }`}
        >
          From {price}
        </p>
      </div>
    </div>
  );
}

function DesktopPatternCard({
  pattern,
  isActive,
  motionTarget,
  shellStyle,
  onClick,
  onQuickView
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 cursor-pointer will-change-transform"
      style={shellStyle}
      onClick={onClick}
    >
      <motion.div
        initial={false}
        animate={motionTarget}
        transition={{
          type: 'spring',
          stiffness: 95,
          damping: 22,
          mass: 0.9
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <PatternCardContent
          pattern={pattern}
          isActive={isActive}
          onQuickView={onQuickView}
        />
      </motion.div>
    </div>
  );
}

export default function SignatureOrbitCarouselA({
  patterns = [],
  title = 'Our Signature Collections',
  subtitle = 'Let Your Uniqueness Take Shape',
  label = 'Version A · Layered Orbit',
  showLabel = false,
  onQuickView,
  onFocusPattern
}) {
  const safePatterns = useMemo(
    () => patterns.filter(Boolean).slice(0, 8),
    [patterns]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartXRef = useRef(null);

  const total = safePatterns.length;

  if (!total) return null;

  const focusIndex = (index) => {
    const nextIndex = mod(index, total);
    setActiveIndex(nextIndex);
    onFocusPattern?.(safePatterns[nextIndex]);
  };

  const goPrev = () => {
    focusIndex(activeIndex - 1);
  };

  const goNext = () => {
    focusIndex(activeIndex + 1);
  };

  const focusCard = (index, pattern) => {
    if (index === activeIndex) {
      onQuickView?.(pattern);
      return;
    }

    setActiveIndex(index);
    onFocusPattern?.(pattern);
  };

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current == null) return;

    const endX =
      event.changedTouches?.[0]?.clientX ??
      touchStartXRef.current;

    const distance = endX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(distance) < 45) return;

    if (distance < 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  const activePattern = safePatterns[activeIndex];

  return (
    <section
      className="relative overflow-hidden bg-[#FAF8F5] px-4 py-10 md:flex md:min-h-screen md:items-center md:px-6 md:py-6 lg:px-8"
      id="signature-orbit-carousel-a"
      aria-label={title}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(194,107,74,0.055)_0%,rgba(250,248,245,0)_42%)]" />

      {showLabel && (
        <div className="absolute right-6 top-8 z-20 hidden rounded-xl border border-clay-300/70 bg-sand-50/80 px-4 py-2 text-xs font-semibold text-clay-700 shadow-sm backdrop-blur-sm md:block">
          {label}
        </div>
      )}

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className="text-center">
          <h2 className="font-serif text-[38px] font-light leading-[0.98] tracking-tight text-bark-950 sm:text-5xl lg:text-6xl">{pfUiT("ui.components.signatureorbitcarousela.6b5d85351e")}<span className="italic text-clay-700">{pfUiT("ui.components.signatureorbitcarousela.c64b027470")}</span>{pfUiT("ui.components.signatureorbitcarousela.0ee5bb573d")}</h2>

          <p className="mt-4 font-serif text-[21px] italic leading-relaxed text-bark-600 sm:text-2xl">
            {subtitle}
          </p>
        </div>

        {/* Mobile: full-width premium slider */}
        <div className="mt-9 md:hidden">
          <div
            className="mx-auto w-full max-w-[430px] touch-pan-y select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <motion.div
              key={
                activePattern.id ||
                activePattern.slug ||
                activePattern.code ||
                activePattern.patternNo ||
                activeIndex
              }
              initial={{ opacity: 0, x: 18, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <PatternCardContent
                pattern={activePattern}
                isActive
                mobile
                onQuickView={onQuickView}
              />
            </motion.div>
          </div>

          {total > 1 && (
            <div className="mx-auto mt-5 flex max-w-[430px] items-center justify-between gap-3 px-1">
              <button
                type="button"
                onClick={goPrev}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sand-200 bg-white text-bark-800 shadow-[0_10px_26px_rgba(45,30,21,0.10)] active:scale-95"
                aria-label={pfUiT("ui.components.signatureorbitcarousela.6100ac2018")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                {safePatterns.map((pattern, index) => (
                  <button
                    key={
                      pattern.id ||
                      pattern.slug ||
                      pattern.code ||
                      pattern.patternNo ||
                      index
                    }
                    type="button"
                    onClick={() => focusIndex(index)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      activeIndex === index
                        ? 'w-7 bg-clay-700'
                        : 'w-2.5 bg-sand-300'
                    }`}
                    aria-label={`Show pattern ${index + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={goNext}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sand-200 bg-white text-bark-800 shadow-[0_10px_26px_rgba(45,30,21,0.10)] active:scale-95"
                aria-label={pfUiT("ui.components.signatureorbitcarousela.48a39b902c")}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop/tablet: preserve layered orbit */}
        <motion.div
          className="relative mx-auto -mt-8 hidden h-[500px] max-w-[1180px] overflow-visible md:block lg:h-[540px]"
          style={{ perspective: '1500px' }}
          id="signature-orbit-stage-a"
        >
          <div className="pointer-events-none absolute left-1/2 top-[78%] h-[150px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,30,21,0.16)_0%,rgba(194,107,74,0.08)_34%,transparent_72%)] blur-3xl" />

          <div className="pointer-events-none absolute left-1/2 top-[76%] h-[92px] w-[560px] -translate-x-1/2 rounded-full border border-clay-300/20 bg-[radial-gradient(ellipse_at_center,rgba(194,107,74,0.13)_0%,transparent_70%)]" />

          {safePatterns.map((pattern, index) => {
            const delta = normalizeDelta(index, activeIndex, total);
            const abs = Math.abs(delta);

            const isActive = delta === 0;
            const visible = abs <= 3;
            const direction = delta < 0 ? 1 : -1;

            const motionTarget = isActive
              ? {
                  x: 0,
                  y: -2,
                  z: 110,
                  scale: 1.04,
                  rotateY: 0,
                  rotateZ: 0,
                  opacity: 1,
                  filter: 'none'
                }
              : abs === 1
                ? {
                    x: direction * 285,
                    y: 12,
                    z: -55,
                    scale: 0.86,
                    rotateY: direction * -12,
                    rotateZ: direction * 0.8,
                    opacity: 0.82,
                    filter: 'saturate(0.96) brightness(0.92)'
                  }
                : abs === 2
                  ? {
                      x: direction * 455,
                      y: 22,
                      z: -180,
                      scale: 0.62,
                      rotateY: direction * -24,
                      rotateZ: direction * 1.6,
                      opacity: 0.52,
                      filter: 'saturate(0.9) brightness(0.88)'
                    }
                  : {
                      x: direction * 620,
                      y: 40,
                      z: -260,
                      scale: 0.48,
                      rotateY: direction * -32,
                      rotateZ: direction * 2,
                      opacity: 0,
                      filter: 'saturate(0.85) brightness(0.84)'
                    };

            const shellStyle = {
              zIndex: isActive ? 70 : abs === 1 ? 42 : abs === 2 ? 18 : 1,
              pointerEvents: visible ? 'auto' : 'none',
              transform: 'translate(-50%, -50%)'
            };

            return (
              <DesktopPatternCard
                key={
                  pattern.id ||
                  pattern.slug ||
                  pattern.code ||
                  pattern.patternNo ||
                  pattern.name ||
                  index
                }
                pattern={pattern}
                isActive={isActive}
                motionTarget={motionTarget}
                shellStyle={shellStyle}
                onClick={() => focusCard(index, pattern)}
                onQuickView={onQuickView}
              />
            );
          })}
        </motion.div>
      </div>

      {/* Desktop orbit arrows */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[58%] z-[35] hidden -translate-y-1/2 items-center justify-between px-5 md:flex lg:px-8 xl:px-12 2xl:px-16"
        id="signature-orbit-section-arrows"
      >
        <button
          type="button"
          onClick={goPrev}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-sand-200 bg-white/94 text-bark-800 shadow-[0_16px_35px_rgba(45,30,21,0.12)] transition-all hover:scale-105 hover:bg-white active:scale-95"
          aria-label={pfUiT("ui.components.signatureorbitcarousela.6100ac2018")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={goNext}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-sand-200 bg-white/94 text-bark-800 shadow-[0_16px_35px_rgba(45,30,21,0.12)] transition-all hover:scale-105 hover:bg-white active:scale-95"
          aria-label={pfUiT("ui.components.signatureorbitcarousela.48a39b902c")}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
