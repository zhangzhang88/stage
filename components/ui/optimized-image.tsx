"use client";


interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  sizes?: string;
  [key: string]: any;
}

/**
 * Simple image component without Cloudinary optimization.
 * Uses regular img tag for all images.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill,
  className,
  priority,
  sizes,
  ...props
}: OptimizedImageProps) {
  // Use regular img tag without Cloudinary
  if (fill) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        sizes={sizes}
        {...props}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      {...props}
    />
  );
}
