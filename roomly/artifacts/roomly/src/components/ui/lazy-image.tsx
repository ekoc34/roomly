import { useState } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  formatWebp?: boolean;
  widths?: number[];
  sizes?: string;
};

export function LazyImage({ 
  src, 
  alt = "", 
  className = "", 
  formatWebp = true,
  widths = [400, 800, 1200],
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
}: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Generate srcSet with Supabase transformations for different widths
  const generateSrcSet = (baseSrc: string, isWebp: boolean): string => {
    const separator = baseSrc.includes("?") ? "&" : "?";
    const formatParam = isWebp ? "format=webp" : "";
    
    return widths
      .map((width) => {
        const params = [
          formatParam,
          `width=${width}`,
          `quality=${isWebp ? 85 : 90}`,
        ].filter(Boolean).join("&");
        
        return `${baseSrc}${separator}${params} ${width}w`;
      })
      .join(", ");
  };

  const webpSrcSet = generateSrcSet(src, true);
  const fallbackSrcSet = generateSrcSet(src, false);

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
      <picture>
        {formatWebp && (
          <source
            srcSet={webpSrcSet}
            sizes={sizes}
            type="image/webp"
          />
        )}
        <img
          srcSet={fallbackSrcSet}
          sizes={sizes}
          alt={alt || "Afbeelding"}
          className={`h-full w-full object-cover ${className}`}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      </picture>
    </div>
  );
}
