import { useCallback } from 'react';
import {
  createSellerProduct,
  deleteSellerProduct,
  fetchSellerProduct,
  fetchSellerProducts,
  selectSellerDetailError,
  selectSellerDetailLoading,
  selectSellerListError,
  selectSellerListLoading,
  selectSellerListPaging,
  selectSellerListQuery,
  selectSellerMutating,
  selectSellerProducts,
  selectSellerSelectedProduct,
  updateSellerProduct,
  uploadSellerProductImages,
} from '../store/sellerSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type {
  CreateSellerProductPayload,
  SellerProductQuery,
  UpdateSellerProductPayload,
  UploadSellerProductImagesPayload,
} from '../types/seller';
import { getApiErrorMessage } from '../utils/apiError';

export function useSellerProducts() {
  const dispatch = useAppDispatch();
  const products = useAppSelector(selectSellerProducts);
  const listQuery = useAppSelector(selectSellerListQuery);
  const paging = useAppSelector(selectSellerListPaging);
  const listLoading = useAppSelector(selectSellerListLoading);
  const listError = useAppSelector(selectSellerListError);
  const selectedProduct = useAppSelector(selectSellerSelectedProduct);
  const detailLoading = useAppSelector(selectSellerDetailLoading);
  const detailError = useAppSelector(selectSellerDetailError);
  const mutating = useAppSelector(selectSellerMutating);

  const loadList = useCallback(
    (query: SellerProductQuery) => dispatch(fetchSellerProducts(query)),
    [dispatch],
  );

  const loadOne = useCallback(
    async (id: string) => {
      const result = await dispatch(fetchSellerProduct(id));
      if (fetchSellerProduct.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Product not found.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const create = useCallback(
    async (payload: CreateSellerProductPayload) => {
      const result = await dispatch(createSellerProduct(payload));
      if (createSellerProduct.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to create product.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const update = useCallback(
    async (id: string, payload: UpdateSellerProductPayload) => {
      const result = await dispatch(updateSellerProduct({ id, payload }));
      if (updateSellerProduct.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to update product.');
      }
      return result.payload;
    },
    [dispatch],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await dispatch(deleteSellerProduct(id));
      if (deleteSellerProduct.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to delete product.');
      }
    },
    [dispatch],
  );

  const uploadImages = useCallback(
    async (id: string, payload: UploadSellerProductImagesPayload) => {
      const result = await dispatch(uploadSellerProductImages({ id, payload }));
      if (uploadSellerProductImages.rejected.match(result)) {
        throw new Error((result.payload as string) || 'Unable to save product images.');
      }
      return result.payload;
    },
    [dispatch],
  );

  return {
    products,
    listQuery,
    paging,
    listLoading,
    listError,
    selectedProduct,
    detailLoading,
    detailError,
    mutating,
    loadList,
    loadOne,
    create,
    update,
    remove,
    uploadImages,
    getErrorMessage: getApiErrorMessage,
  };
}
