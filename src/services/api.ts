import type { ApiResponse, PaginatedResponse } from "@/src/types/api.types"
import { useAuthStore } from "@/src/stores/auth.store"

// Base API URL - would come from environment variables in a real app
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.135.210:8000/api/v1"

// API request options type
type RequestOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  headers?: Record<string, string>
  body?: any
  params?: Record<string, string | number | boolean | undefined>
}

// Helper to build URL with query parameters
const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean | undefined>): string => {
  const url = new URL(`${API_BASE_URL}${endpoint}`)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })
  }

  return url.toString()
}

// Get auth headers from store
const getAuthHeaders = (): Record<string, string> => {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Main API request function
export async function apiRequest<T>(endpoint: string, options: RequestOptions): Promise<ApiResponse<T>> {
  try {
    const { method, headers = {}, body, params } = options

    // Build request URL with any query parameters
    const url = buildUrl(endpoint, params)

    // Get auth headers if user is authenticated
    const authHeaders = getAuthHeaders()

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders,
        ...headers,
      },
    }

    // Add body for non-GET requests
    if (body && method !== "GET") {
      requestOptions.body = JSON.stringify(body)
    }

    // Make the request
    const response = await fetch(url, requestOptions)

    // Parse the JSON response
    let data: any
    try {
      data = await response.json()
    } catch (parseError) {
      // If response is not JSON, create a basic error object
      data = {
        detail: `Server returned invalid response (${response.status})`,
        message: "Unable to parse server response"
      }
    }

    // Check if the request was successful
    if (!response.ok) {
      // Handle 401 Unauthorized by clearing auth tokens
      if (response.status === 401) {
        useAuthStore.getState().logout()
      }

      // Provide specific error messages based on status code
      let errorMessage = data.error || data.detail || data.message
      
      switch (response.status) {
        case 400:
          errorMessage = errorMessage || "Invalid request. Please check your input."
          break
        case 401:
          errorMessage = errorMessage || "Invalid email/phone or password. Please try again."
          break
        case 403:
          errorMessage = errorMessage || "Access denied. You don't have permission for this action."
          break
        case 404:
          errorMessage = errorMessage || "The requested resource was not found."
          break
        case 422:
          errorMessage = errorMessage || "Validation error. Please check your input."
          break
        case 429:
          errorMessage = errorMessage || "Too many requests. Please try again later."
          break
        case 500:
          errorMessage = errorMessage || "Server error. Please try again later."
          break
        default:
          errorMessage = errorMessage || `Request failed with status ${response.status}`
      }

      return {
        success: false,
        error: errorMessage,
        message: data.message || "An error occurred",
        status_code: response.status,
      }
    }

    // Return successful response
    return {
      success: true,
      data: data.data || data,
      message: data.message,
    }
  } catch (error) {
    // Handle network and other errors
    console.error("API request error:", error)
    
    let errorMessage = "Unknown error occurred"
    let isNetworkError = false
    
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      errorMessage = "Network connection failed. Please check your internet connection and try again."
      isNetworkError = true
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = "Unable to connect to the server. Please check your connection and try again."
      isNetworkError = true
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return {
      success: false,
      error: errorMessage,
      message: "Failed to complete request",
      isNetworkError,
    }
  }
}

// Generic GET request
export async function get<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
  headers?: Record<string, string>,
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: "GET",
    headers,
    params,
  })
}

// Generic POST request
export async function post<T>(endpoint: string, body: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    headers,
    body,
  })
}

// Generic PUT request
export async function put<T>(endpoint: string, body: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: "PUT",
    headers,
    body,
  })
}

// Generic DELETE request
export async function del<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: "DELETE",
    headers,
  })
}

// Generic PATCH request
export async function patch<T>(endpoint: string, body: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: "PATCH",
    headers,
    body,
  })
}

// Helper for paginated requests
export async function getPaginated<T>(
  endpoint: string,
  page = 1,
  limit = 10,
  filters?: Record<string, string | number | boolean | undefined>,
  headers?: Record<string, string>,
): Promise<ApiResponse<PaginatedResponse<T>>> {
  return get<PaginatedResponse<T>>(
    endpoint,
    {
      page,
      limit,
      ...filters,
    },
    headers,
  )
} 