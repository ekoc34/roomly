import { useState } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  formatWebp?: boolean;
};

export function LazyImage({ src, alt = "", className = "", formatWebp = false }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Append ?format=webp to Supabase Storage URLs if requested
  const imageSrc = formatWebp && !src.includes("?format=") ? `${src}?format=webp` : src;

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-stone-100 ${className}`}>
        <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-stone-200" />
      )}
      <img
        src={imageSrc}
        alt={alt || "Afbeelding"}
        className={`h-full w-full object-cover ${className}`}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
