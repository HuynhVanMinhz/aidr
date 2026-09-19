/**
 * Helpers for return evidence media (Cloudinary video/image URLs).
 */

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)(\?|#|$)/i;
const CLOUDINARY_VIDEO = /\/video\/upload\//i;
const CLOUDINARY_IMAGE = /\/image\/upload\//i;
const CLOUDINARY_HOST = /res\.cloudinary\.com/i;
const RETURNS_FOLDER = /\/returns\//i;
const YOUTUBE_HOST = /(?:youtu\.be|youtube\.com)/i;

/** Extract YouTube video ID from watch/short/embed/youtu.be URLs. */
export function youTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (/youtu\.be/i.test(u.hostname)) return u.pathname.slice(1).split('/')[0] || null;
    if (/youtube\.com/i.test(u.hostname)) {
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
      return u.searchParams.get('v');
    }
  } catch {
    // not a valid URL
  }
  return null;
}

/** True when the URL points to a YouTube video. */
export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return YOUTUBE_HOST.test(url.trim()) && youTubeVideoId(url) !== null;
}

/** True when the URL is expected to be playable as video. */
export function isReturnVideoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const value = url.trim();
  if (isYouTubeUrl(value)) return true;
  if (CLOUDINARY_VIDEO.test(value)) return true;
  // Unsigned image preset sometimes stores return clips under /image/upload/returns/
  if (CLOUDINARY_HOST.test(value) && CLOUDINARY_IMAGE.test(value) && RETURNS_FOLDER.test(value)) {
    return true;
  }
  return VIDEO_EXT.test(value);
}

/**
 * Normalize Cloudinary URLs so HTML5 video can play them.
 * Forces MP4 delivery for .mov/.mkv which Chrome often cannot play natively.
 */
export function toPlayableReturnMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (!CLOUDINARY_HOST.test(trimmed)) {
    return trimmed;
  }

  let next = trimmed;

  // Mis-stored return videos under the image delivery path
  if (CLOUDINARY_IMAGE.test(next) && RETURNS_FOLDER.test(next)) {
    next = next.replace(CLOUDINARY_IMAGE, '/video/upload/');
  }

  if (!CLOUDINARY_VIDEO.test(next)) {
    return next;
  }

  // Already has an explicit format / quality transform after /upload/
  if (/\/video\/upload\/(?:[^/]+,)*f_/i.test(next)) {
    return next.replace(/\.(mov|mkv|avi)(\?|#|$)/i, '.mp4$2');
  }

  next = next.replace(/\/video\/upload\//i, '/video/upload/f_mp4,q_auto/');
  next = next.replace(/\.(mov|mkv|avi)(\?|#|$)/i, '.mp4$2');
  // Drop image extensions that block video delivery
  next = next.replace(/\.(jpe?g|png|webp|gif)(\?|#|$)/i, '.mp4$2');

  return next;
}

export function returnEvidencePosterUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!CLOUDINARY_HOST.test(trimmed)) {
    return undefined;
  }

  let base = trimmed;
  if (CLOUDINARY_IMAGE.test(base) && RETURNS_FOLDER.test(base)) {
    base = base.replace(CLOUDINARY_IMAGE, '/video/upload/');
  }

  if (!CLOUDINARY_VIDEO.test(base)) {
    return undefined;
  }

  // First frame as JPG poster - helps UI while metadata loads
  if (/\/video\/upload\/(?:[^/]+,)*so_/i.test(base)) {
    return undefined;
  }

  return base
    .replace(/\/video\/upload\//i, '/video/upload/so_0,f_jpg,q_auto/')
    .replace(/\.(mp4|webm|ogg|mov|m4v|mkv|avi|jpe?g|png|webp|gif)(\?|#|$)/i, '.jpg$2');
}
