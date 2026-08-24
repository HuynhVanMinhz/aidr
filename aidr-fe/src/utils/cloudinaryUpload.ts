const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Cloudinary folder layout — keep media types separated. */
export const CloudinaryFolders = {
  profile: 'profile',
  product: 'product',
  category: 'category',
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

/** Reserved for product images — folder `product`. */
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

/** Upload category image to folder `category`. */
export async function uploadCategoryImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  validateCategoryImageFile(file);
  return uploadImageToCloudinary(file, CloudinaryFolders.category);
}
