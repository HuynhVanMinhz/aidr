export const CATEGORY_MAX_NAME = 120;
export const CATEGORY_MAX_SLUG = 140;
export const CATEGORY_MAX_DESCRIPTION = 500;
export const CATEGORY_MAX_IMAGE_URL = 512;

export type CategoryFormValues = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
};

export const emptyCategoryForm = (overrides?: Partial<CategoryFormValues>): CategoryFormValues => ({
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  parentId: '',
  sortOrder: '0',
  isActive: true,
  ...overrides,
});
