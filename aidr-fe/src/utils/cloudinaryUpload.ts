const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Cloudinary folder layout — keep media types separated. */
export const CloudinaryFolders = {
  profile: 'profile',
  product: 'product',
} as const;

export type CloudinaryFolder = (typeof CloudinaryFolders)[keyof typeof CloudinaryFolders];

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

export function validateAvatarFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn file ảnh hợp lệ.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Ảnh đại diện tối đa 2MB.');
  }
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
    throw new Error('Cloudinary chưa được cấu hình. Thêm VITE_CLOUDINARY_* vào .env.');
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
    throw new Error('Upload ảnh lên Cloudinary thất bại.');
  }

  const payload = (await response.json()) as { secure_url?: string; public_id?: string };
  if (!payload.secure_url || !payload.public_id) {
    throw new Error('Cloudinary không trả về URL ảnh.');
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
export async function uploadProductImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn file ảnh hợp lệ.');
  }
  return uploadImageToCloudinary(file, CloudinaryFolders.product);
}
