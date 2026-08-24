import type { FieldErrors } from './formValidation';
import { tryValidateField } from './formValidation';
import {
  validateImageUrl,
  validateMaxLength,
  validateRequired,
  validateSlug,
} from './validators';
import {
  CATEGORY_MAX_DESCRIPTION,
  CATEGORY_MAX_IMAGE_URL,
  CATEGORY_MAX_NAME,
  CATEGORY_MAX_SLUG,
  type CategoryFormValues,
} from '../components/admin/categoryFormConstants';

export type CategoryFormField = 'name' | 'slug' | 'description' | 'imageUrl' | 'parentId' | 'sortOrder';

export function validateCategoryFormFields(
  form: CategoryFormValues,
  mode: 'create' | 'edit',
): FieldErrors<CategoryFormField> {
  const errors: FieldErrors<CategoryFormField> = {};

  const nameError = tryValidateField(() =>
    validateMaxLength(
      validateRequired(form.name, 'Category name'),
      CATEGORY_MAX_NAME,
      'Category name',
    ),
  );
  if (nameError) errors.name = nameError;

  if (mode === 'create') {
    const slugError = tryValidateField(() => validateSlug(form.slug, CATEGORY_MAX_SLUG));
    if (slugError) errors.slug = slugError;
  }

  if (form.parentId.trim()) {
    const parentId = Number(form.parentId);
    if (!Number.isInteger(parentId) || parentId <= 0) {
      errors.parentId = 'Parent category is invalid.';
    }
  }

  const descriptionError = tryValidateField(() =>
    validateMaxLength(
      validateRequired(form.description, 'Description'),
      CATEGORY_MAX_DESCRIPTION,
      'Description',
    ),
  );
  if (descriptionError) errors.description = descriptionError;

  if (mode === 'create') {
    const imageError = tryValidateField(() => validateImageUrl(form.imageUrl, CATEGORY_MAX_IMAGE_URL));
    if (imageError) errors.imageUrl = imageError;
  } else if (form.imageUrl.trim()) {
    const imageError = tryValidateField(() => validateImageUrl(form.imageUrl, CATEGORY_MAX_IMAGE_URL));
    if (imageError) errors.imageUrl = imageError;
  }

  const sortError = tryValidateField(() => {
    const sortRaw = form.sortOrder.trim();
    if (!sortRaw) throw new Error('Sort order is required.');
    const sortOrder = Number(sortRaw);
    if (!Number.isInteger(sortOrder)) throw new Error('Sort order must be an integer.');
  });
  if (sortError) errors.sortOrder = sortError;

  return errors;
}

export function isCategoryFormDirty(
  form: CategoryFormValues,
  initialValues: CategoryFormValues,
  mode: 'create' | 'edit',
): boolean {
  if (mode === 'create') {
    return (
      form.name.trim() !== '' ||
      form.slug.trim() !== '' ||
      form.description.trim() !== '' ||
      form.imageUrl.trim() !== '' ||
      form.parentId !== '' ||
      form.sortOrder.trim() !== String(initialValues.sortOrder) ||
      form.isActive !== initialValues.isActive
    );
  }

  return (
    form.name.trim() !== initialValues.name.trim() ||
    form.description.trim() !== (initialValues.description ?? '').trim() ||
    form.imageUrl.trim() !== (initialValues.imageUrl ?? '').trim() ||
    form.parentId !== initialValues.parentId ||
    form.sortOrder.trim() !== initialValues.sortOrder.trim()
  );
}

export function canSubmitCategoryForm(
  form: CategoryFormValues,
  initialValues: CategoryFormValues,
  mode: 'create' | 'edit',
  errors: FieldErrors<CategoryFormField>,
): boolean {
  if (Object.keys(errors).length > 0) return false;
  if (!isCategoryFormDirty(form, initialValues, mode)) return false;
  if (mode === 'create') {
    return Boolean(
      form.name.trim() &&
        form.slug.trim() &&
        form.description.trim() &&
        form.imageUrl.trim() &&
        form.sortOrder.trim(),
    );
  }
  return true;
}
