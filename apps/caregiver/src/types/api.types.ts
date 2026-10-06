// Base API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  status_code?: number;
  isNetworkError?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  phone_number?: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  user_type: string;
  created_at: string;
  updated_at: string;
}

// Authentication Types
export interface LoginRequest {
  email_or_phone: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  phone_number?: string;
  full_name: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

// API Error Types
export interface ApiError {
  detail: string;
  status_code?: number;
}

// Form Validation Types
export interface ValidationErrors {
  [key: string]: string;
}

// Component Props Types
export interface CreateAccountProps {
  route?: any;
}

export interface LoginProps {
  route?: any;
}

export interface VerifyEmailProps {
  route?: {
    params?: {
      email?: string;
    };
  };
}

export interface RecoverPasswordProps {
  route?: any;
}

export interface ResetPasswordProps {
  route?: {
    params?: {
      token?: string;
    };
  };
}