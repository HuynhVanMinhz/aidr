export type AdminCategory = {
  categoryId: number;
  parentId?: number | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryPayload = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentId?: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type UpdateCategoryPayload = {
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
};
