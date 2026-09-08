import type {
  CreateProductAnswerRequest,
  CreateProductQuestionRequest,
  ProductAnswerApiResult,
  ProductQuestionApiResult,
  ProductQuestionListApiResult,
  ProductQuestionListResult,
} from '../types/v2Features';
import { apiClient } from './apiClient';

export async function listProductQuestions(
  productId: string,
  page = 1,
  pageSize = 10,
) {
  const { data } = await apiClient.get<ProductQuestionListApiResult>(
    `/products/${productId}/questions`,
    { params: { page, pageSize } },
  );
  return data;
}

export async function askProductQuestion(
  productId: string,
  request: CreateProductQuestionRequest,
) {
  const { data } = await apiClient.post<ProductQuestionApiResult>(
    `/products/${productId}/questions`,
    request,
  );
  return data;
}

export async function answerProductQuestion(
  questionId: string,
  request: CreateProductAnswerRequest,
) {
  const { data } = await apiClient.post<ProductAnswerApiResult>(
    `/questions/${questionId}/answers`,
    request,
  );
  return data;
}

export function requireProductQuestionList(
  result: ProductQuestionListApiResult,
): ProductQuestionListResult {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load questions.');
  }
  return result.data;
}
