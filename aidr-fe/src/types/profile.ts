import type { ApiResult } from './auth';

export type Address = {
  addressId: string;
  receiverName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  isDefault: boolean;
};

export type Profile = {
  userId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  hasPassword: boolean;
  roles: string[];
  defaultAddress?: Address | null;
  addresses: Address[];
};

export type AddressUpsert = {
  addressId?: string | null;
  receiverName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  isDefault: boolean;
};

export type UpdateProfileRequest = {
  fullName: string;
  phone: string;
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
  addresses?: AddressUpsert[] | null;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ProfileApiResult = ApiResult<Profile>;
