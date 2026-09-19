const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Cloudinary folder layout - keep media types separated. */
export const CloudinaryFolders = {
  profile: 'profile',
  product: 'product',
  category: 'category',
  shop: 'shop',
  chat: 'chat',
  kyc: 'kyc',
  returns: 'returns',
} as const;

export type CloudinaryFolder = (typeof CloudinaryFolders)[keyof typeof CloudinaryFolders];

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

export function validateAvatarFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Avatar image must be 2MB or smaller.');
  }
}

/**
 * Validate category image (same rules as avatar: image/* and MAX_AVATAR_BYTES).
 */
export function validateCategoryImageFile(file: File): void {
  validateAvatarFile(file);
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
  );
}

async function uploadImageToCloudinary(
  file: File,
  folder: CloudinaryFolder,
): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_* to .env.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', uploadPreset);
  form.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error('Failed to upload image to Cloudinary.');
  }

  const payload = (await response.json()) as { secure_url?: string; public_id?: string };
  if (!payload.secure_url || !payload.public_id) {
    throw new Error('Cloudinary did not return an image URL.');
  }

  return {
    secureUrl: payload.secure_url,
    publicId: payload.public_id,
  };
}

export async function uploadAvatarToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateAvatarFile(file);
  return uploadImageToCloudinary(file, CloudinaryFolders.profile);
}

/** Reserved for product images - folder `product`. */
export function validateProductImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Product image must be 2MB or smaller.');
  }
}

export async function uploadProductImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateProductImageFile(file);
  return uploadImageToCloudinary(file, CloudinaryFolders.product);
}

const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateChatImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be sent in chat.');
  }
  if (file.size > MAX_CHAT_IMAGE_BYTES) {
    throw new Error('Image must be 5MB or smaller.');
  }
}

/** Upload a chat photo to folder `chat`. */
export async function uploadChatImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateChatImageFile(file);
  return uploadImageToCloudinary(file, CloudinaryFolders.chat);
}

const MAX_SHOP_IMAGE_BYTES = 4 * 1024 * 1024;

/** A shop banner is displayed wide, so it gets more headroom than an avatar. */
export function validateShopImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }
  if (file.size > MAX_SHOP_IMAGE_BYTES) {
    throw new Error('Shop image must be 4MB or smaller.');
  }
}

/** Upload a shop logo or banner to folder `shop`. */
export async function uploadShopImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateShopImageFile(file);
  return uploadImageToCloudinary(file, CloudinaryFolders.shop);
}

/** Upload category image to folder `category`. */
export async function uploadCategoryImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateCategoryImageFile(file);
  return uploadImageToCloudinary(file, CloudinaryFolders.category);
}

const MAX_KYC_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateKycImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a photo (JPG or PNG).');
  }
  if (file.size > MAX_KYC_IMAGE_BYTES) {
    throw new Error('Photo must be 8MB or smaller.');
  }
}

/** Upload an eKYC photo (ID card or portrait) to folder `kyc`. */
export async function uploadKycImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateKycImageFile(file);
  return uploadImageToCloudinary(file, CloudinaryFolders.kyc);
}

const MAX_RETURN_VIDEO_BYTES = 50 * 1024 * 1024;

const RETURN_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]);

/** Return evidence videos - Unboxing / Testing. */
export function validateReturnVideoFile(file: File): void {
  const typeOk =
    file.type.startsWith('video/') || RETURN_VIDEO_TYPES.has(file.type) || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name);
  if (!typeOk) {
    throw new Error('Please choose a video file (MP4, WebM, or MOV).');
  }
  if (file.size > MAX_RETURN_VIDEO_BYTES) {
    throw new Error('Video must be 50MB or smaller.');
  }
}

async function uploadVideoToCloudinary(
  file: File,
  folder: CloudinaryFolder,
): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_* to .env.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', uploadPreset);
  form.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error('Failed to upload video to Cloudinary.');
  }

  const payload = (await response.json()) as {
    secure_url?: string;
    public_id?: string;
    resource_type?: string;
    format?: string;
  };
  if (!payload.secure_url || !payload.public_id) {
    throw new Error('Cloudinary did not return a video URL.');
  }

  let secureUrl = payload.secure_url;
  // Guard against presets that echo an image delivery path for video uploads
  if (secureUrl.includes('/image/upload/')) {
    secureUrl = secureUrl.replace('/image/upload/', '/video/upload/');
  }
  const pathOnly = secureUrl.split('?')[0] ?? secureUrl;
  if (payload.format && !/\.[a-z0-9]+$/i.test(pathOnly)) {
    secureUrl = `${secureUrl}.${payload.format}`;
  }

  return {
    secureUrl,
    publicId: payload.public_id,
  };
}

/** Upload a return evidence video to folder `returns`. */
export async function uploadReturnVideoToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateReturnVideoFile(file);
  return uploadVideoToCloudinary(file, CloudinaryFolders.returns);
}
