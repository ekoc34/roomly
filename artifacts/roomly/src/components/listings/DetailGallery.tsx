import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  images: string[];
  title: string;
};

// ── Focus trap hook ──────────────────────────────────────────────────────────

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    el.addEventListener("keydown", onTab);
    return () => el.removeEventListener("keydown", onTab);
  }, [ref]);
}

// ── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  images,
  title,
  startIndex,
  onClose,
}: {
  images: string[];
  title: string;
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  useFocusTrap(dialogRef);

  const prev = useCallback(() => {
    setCurrent((i) => (i > 0 ? i - 1 : images.length - 1));
    setLoaded(false);
  }, [images.length]);

  const next = useCallback(() => {
    setCurrent((i) => (i < images.length - 1 ? i + 1 : 0));
    setLoaded(false);
  }, [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  // Preload adjacent images
  useEffect(() => {
    const preload = (idx: number) => {
      if (images[idx]) {
        const img = new Image();
        img.src = images[idx];
      }
    };
    preload(current + 1 < images.length ? current + 1 : 0);
    preload(current - 1 >= 0 ? current - 1 : images.length - 1);
  }, [current, images]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto's van ${title}`}
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#0f0f0f]"
      style={{ animation: "lb-fade-in 0.15s ease-out both" }}
    >
      <style>{`@keyframes lb-fade-in{from{opacity:0}to{opacity:1}}`}</style>

      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <span className="text-sm tabular-nums text-white/50 select-none">
          {current + 1}
          <span className="mx-1.5 text-white/25">/</span>
          {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Lightbox sluiten"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-12 sm:px-16"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onClose}
      >
        {/* Loading skeleton */}
        {!loaded && (
          <div className="absolute inset-x-16 inset-y-4 flex items-center justify-center">
            <div
              className="h-48 w-full max-w-lg rounded-xl opacity-10"
              style={{
                background: "linear-gradient(90deg,#333 25%,#444 50%,#333 75%)",
                backgroundSize: "200% 100%",
                animation: "skeleton-shimmer 1.4s ease-in-out infinite",
              }}
            />
          </div>
        )}

        <img
          key={current}
          src={images[current]}
          alt={`${title} — foto ${current + 1}`}
          className={`max-h-full max-w-full select-none rounded-lg object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ maxHeight: "calc(100vh - 10rem)" }}
          onLoad={() => setLoaded(true)}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Vorige foto"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:left-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Volgende foto"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:right-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex shrink-0 justify-center gap-1.5 overflow-x-auto px-4 py-3">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setCurrent(i); setLoaded(false); }}
              aria-label={`Foto ${i + 1}`}
              aria-pressed={i === current}
              className={`h-11 w-16 shrink-0 overflow-hidden rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                i === current
                  ? "ring-2 ring-white ring-offset-1 ring-offset-[#0f0f0f] opacity-100"
                  : "opacity-35 hover:opacity-65"
              }`}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ── Skeleton shimmer tile ─────────────────────────────────────────────────────

function SkeletonTile({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${className} skeleton`}
      aria-hidden="true"
    />
  );
}

// ── Gallery image tile ────────────────────────────────────────────────────────

function GalleryTile({
  src,
  alt,
  priority = false,
  onClick,
  className = "",
  roundingClass = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  onClick: () => void;
  className?: string;
  roundingClass?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${alt} — klik om te vergroten`}
      className={`group relative block w-full overflow-hidden bg-stone-100 ${roundingClass} ${className}`}
    >
      {!loaded && <SkeletonTile className="absolute inset-0 h-full w-full rounded-none" />}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-all duration-300 group-hover:brightness-[0.93] ${loaded ? "opacity-100" : "opacity-0"}`}
        draggable={false}
      />
    </button>
  );
}

// ── Main gallery component ────────────────────────────────────────────────────

export function DetailGallery({ images, title }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mobileActive, setMobileActive] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const mobilePrev = useCallback(
    () => setMobileActive((i) => (i > 0 ? i - 1 : images.length - 1)),
    [images.length]
  );
  const mobileNext = useCallback(
    () => setMobileActive((i) => (i < images.length - 1 ? i + 1 : 0)),
    [images.length]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? mobileNext() : mobilePrev();
    touchStartX.current = null;
  };

  // Empty state
  if (!images || images.length === 0) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl bg-stone-100">
        <svg className="h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <p className="text-sm text-stone-400">Geen foto beschikbaar</p>
      </div>
    );
  }

  const rest = images.slice(1, 5);
  const totalExtra = images.length - 1;

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          title={title}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ── Mobile: single swipeable image ── */}
      <div className="sm:hidden">
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 cursor-pointer"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => setLightboxIndex(mobileActive)}
          aria-label="Klik om foto's te bekijken"
        >
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === 0 ? `${title} — hoofdfoto` : `${title} — foto ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                i === mobileActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            />
          ))}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); mobilePrev(); }}
                aria-label="Vorige foto"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); mobileNext(); }}
                aria-label="Volgende foto"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-white tabular-nums select-none">
                {mobileActive + 1} / {images.length}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Desktop: Airbnb-style grid ── */}
      <div className="hidden sm:block">
        {images.length === 1 && (
          <GalleryTile
            src={images[0]}
            alt={`${title} — hoofdfoto`}
            priority
            onClick={() => setLightboxIndex(0)}
            className="aspect-[16/9]"
            roundingClass="rounded-2xl"
          />
        )}

        {images.length === 2 && (
          <div className="grid h-72 grid-cols-2 gap-2 lg:h-80">
            <GalleryTile
              src={images[0]}
              alt={`${title} — foto 1`}
              priority
              onClick={() => setLightboxIndex(0)}
              className="h-full"
              roundingClass="rounded-l-2xl rounded-r-lg"
            />
            <GalleryTile
              src={images[1]}
              alt={`${title} — foto 2`}
              onClick={() => setLightboxIndex(1)}
              className="h-full"
              roundingClass="rounded-l-lg rounded-r-2xl"
            />
          </div>
        )}

        {images.length >= 3 && (
          <div className="grid h-72 grid-cols-[1fr_1fr] gap-2 lg:h-80">
            {/* Main large image */}
            <GalleryTile
              src={images[0]}
              alt={`${title} — hoofdfoto`}
              priority
              onClick={() => setLightboxIndex(0)}
              className="h-full"
              roundingClass="rounded-l-2xl rounded-r-lg"
            />

            {/* Right column: 1 or 2 thumbnails */}
            <div className="grid gap-2" style={{ gridTemplateRows: rest.length === 1 ? "1fr" : "1fr 1fr" }}>
              {rest.slice(0, 2).map((src, i) => {
                const globalIndex = i + 1;
                const isLast = i === Math.min(rest.length, 2) - 1;
                const hiddenCount = totalExtra > 2 ? totalExtra - 2 : 0;
                return (
                  <div key={src} className="relative h-full overflow-hidden">
                    <GalleryTile
                      src={src}
                      alt={`${title} — foto ${globalIndex + 1}`}
                      onClick={() => setLightboxIndex(globalIndex)}
                      className="h-full"
                      roundingClass={
                        rest.length === 1
                          ? "rounded-l-lg rounded-r-2xl"
                          : i === 0
                          ? "rounded-tl-lg rounded-tr-2xl"
                          : "rounded-bl-lg rounded-br-2xl"
                      }
                    />
                    {/* "Alle foto's" badge on last slot when there are hidden images */}
                    {isLast && hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(0)}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-white transition hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        style={{
                          borderRadius: rest.length === 1 ? "0.375rem 1rem 1rem 0.375rem" : "0 0 1rem 0",
                        }}
                        aria-label={`Bekijk alle ${images.length} foto's`}
                      >
                        <svg className="h-5 w-5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm font-medium">+{hiddenCount} foto's</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
