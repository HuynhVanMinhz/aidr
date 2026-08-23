export type AuthUser = {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
};

export type AuthTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    userId: string;
    email: string;
    fullName: string;
    roles: string[];
  };
};

export type ApiResult<T> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
  confirmPassword: string;
};

export type GoogleAuthUrlPayload = {
  authorizationUrl: string;
};
