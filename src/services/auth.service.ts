import { post, get } from './api'
import { useAuthStore } from '@/src/stores/auth.store'
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
  VerifyEmailRequest,
  ResendVerificationRequest,
  PasswordResetRequest,
  ResetPasswordRequest,
  ApiResponse,
} from '@/src/types/api.types'

class AuthService {
  // Register new user
  async register(userData: RegisterRequest): Promise<ApiResponse<User>> {
    useAuthStore.getState().setLoading(true)
    useAuthStore.getState().clearError()

    try {
      // Always set user_type to 'caregiver' for caregiver app registration
      const payload = { ...userData, user_type: 'caregiver' };
      const response = await post<User>('/auth/register', payload)
      
      if (response.success && response.data) {
        useAuthStore.getState().setUser(response.data)
      } else {
        // Handle different types of errors
        let errorDetail = response.error || 'Registration failed'
        let statusCode = response.status_code || 400
        
        // Provide more specific error messages
        if (response.isNetworkError) {
          errorDetail = 'Unable to connect to the server. Please check your internet connection and try again.'
          statusCode = 0 // Network error
        } else if (response.status_code === 400) {
          errorDetail = 'Invalid registration data. Please check your information and try again.'
        } else if (response.status_code === 409) {
          errorDetail = 'An account with this email or phone number already exists.'
        } else if (response.status_code === 422) {
          errorDetail = 'Please check your input format and try again.'
        } else if (response.status_code === 429) {
          errorDetail = 'Too many registration attempts. Please wait a moment and try again.'
        } else if (response.status_code && response.status_code >= 500) {
          errorDetail = 'Server error. Please try again later.'
        }
        
        useAuthStore.getState().setError({
          detail: errorDetail,
          status_code: statusCode,
        })
      }
      
      return response
    } catch (error) {
      // Handle unexpected errors
      console.error('Registration error:', error)
      
      let errorDetail = 'Registration failed'
      let statusCode = 500
      
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorDetail = 'Network connection failed. Please check your internet connection and try again.'
          statusCode = 0
        } else if (error.message.includes('fetch')) {
          errorDetail = 'Unable to connect to the server. Please check your connection and try again.'
          statusCode = 0
        } else {
          errorDetail = error.message
        }
      }
      
      const apiError = {
        detail: errorDetail,
        status_code: statusCode,
      }
      useAuthStore.getState().setError(apiError)
      throw apiError
    } finally {
      useAuthStore.getState().setLoading(false)
    }
  }

  // Login user
  async login(credentials: LoginRequest): Promise<ApiResponse<TokenResponse>> {
    useAuthStore.getState().setLoading(true)
    useAuthStore.getState().clearError()

    try {
      const response = await post<TokenResponse>('/auth/login/mobile', credentials)
      
      if (response.success && response.data) {
        // Set the token first
        useAuthStore.getState().setToken(response.data.access_token)
        
        // Fetch user data separately since backend doesn't include it in login response
        try {
          const userResponse = await get<User>('/auth/me')
          if (userResponse.success && userResponse.data) {
            useAuthStore.getState().setUser(userResponse.data)
          } else {
            // If we can't fetch user data, still set the token but log the issue
            console.warn('Failed to fetch user data after login:', userResponse.error)
            useAuthStore.getState().setError({
              detail: 'Login successful but failed to fetch user profile. Please try again.',
              status_code: 500,
            })
            return response
          }
        } catch (userError) {
          console.error('Error fetching user data after login:', userError)
          useAuthStore.getState().setError({
            detail: 'Login successful but failed to fetch user profile. Please try again.',
            status_code: 500,
          })
          return response
        }
      } else {
        // Handle different types of errors
        let errorDetail = response.error || 'Login failed'
        let statusCode = response.status_code || 401
        
        // Provide more specific error messages
        if (response.isNetworkError) {
          errorDetail = 'Unable to connect to the server. Please check your internet connection and try again.'
          statusCode = 0 // Network error
        } else if (response.status_code === 401) {
          errorDetail = 'Invalid email/phone or password. Please check your credentials and try again.'
        } else if (response.status_code === 422) {
          errorDetail = 'Please check your email/phone format and try again.'
        } else if (response.status_code === 429) {
          errorDetail = 'Too many login attempts. Please wait a moment and try again.'
        } else if (response.status_code && response.status_code >= 500) {
          errorDetail = 'Server error. Please try again later.'
        }
        
        useAuthStore.getState().setError({
          detail: errorDetail,
          status_code: statusCode,
        })
      }
      
      return response
    } catch (error) {
      // Handle unexpected errors
      console.error('Login error:', error)
      
      let errorDetail = 'Login failed'
      let statusCode = 500
      
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorDetail = 'Network connection failed. Please check your internet connection and try again.'
          statusCode = 0
        } else if (error.message.includes('fetch')) {
          errorDetail = 'Unable to connect to the server. Please check your connection and try again.'
          statusCode = 0
        } else {
          errorDetail = error.message
        }
      }
      
      const apiError = {
        detail: errorDetail,
        status_code: statusCode,
      }
      useAuthStore.getState().setError(apiError)
      throw apiError
    } finally {
      useAuthStore.getState().setLoading(false)
    }
  }

  // Verify email
  async verifyEmail(data: VerifyEmailRequest): Promise<ApiResponse> {
    useAuthStore.getState().setLoading(true)
    useAuthStore.getState().clearError()

    try {
      const response = await post('/auth/verify-email', data)
      
      if (!response.success) {
        useAuthStore.getState().setError({
          detail: response.error || 'Email verification failed',
          status_code: 400,
        })
      }
      
      return response
    } catch (error) {
      const apiError = {
        detail: error instanceof Error ? error.message : 'Email verification failed',
        status_code: 500,
      }
      useAuthStore.getState().setError(apiError)
      throw apiError
    } finally {
      useAuthStore.getState().setLoading(false)
    }
  }

  // Resend verification email
  async resendVerification(data: ResendVerificationRequest): Promise<ApiResponse> {
    try {
      return await post('/auth/resend-verification', data)
    } catch (error) {
      throw {
        detail: error instanceof Error ? error.message : 'Failed to resend verification',
        status_code: 500,
      }
    }
  }

  // Request password reset
  async requestPasswordReset(data: PasswordResetRequest): Promise<ApiResponse> {
    try {
      return await post('/auth/password-recovery', data)
    } catch (error) {
      throw {
        detail: error instanceof Error ? error.message : 'Failed to request password reset',
        status_code: 500,
      }
    }
  }

  // Reset password
  async resetPassword(data: ResetPasswordRequest): Promise<ApiResponse> {
    try {
      return await post('/auth/reset-password', data)
    } catch (error) {
      throw {
        detail: error instanceof Error ? error.message : 'Failed to reset password',
        status_code: 500,
      }
    }
  }

  // Get current user profile
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      return await get<User>('/auth/me')
    } catch (error) {
      throw {
        detail: error instanceof Error ? error.message : 'Failed to get user profile',
        status_code: 500,
      }
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      // Optionally call logout endpoint if your backend supports it
      await post('/auth/logout', {})
    } catch (error) {
      // Even if the API call fails, we should still logout locally
      console.warn('Logout API call failed:', error)
    } finally {
      useAuthStore.getState().logout()
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return useAuthStore.getState().isAuthenticated
  }

  // Get current user
  getCurrentUserFromStore(): User | null {
    return useAuthStore.getState().user
  }

  // Get auth token
  getToken(): string | null {
    return useAuthStore.getState().token
  }
}

export const authService = new AuthService()
export default authService 