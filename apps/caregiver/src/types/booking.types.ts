// Import base API types
import type { ApiResponse, PaginatedResponse } from './api.types'

export interface BookingRequest {
  id: string
  booking_code: string
  patient_id: string
  service_type: string
  assistance_type: string
  condition?: string
  duration_hours: number
  scheduled_date: string
  scheduled_end_date: string
  patient_address: string
  patient_latitude: number
  patient_longitude: number
  patient_city: string
  patient_state: string
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled" | "declined"
  payment_status: "pending" | "paid" | "failed" | "refunded"
  total_amount: number
  service_fee: number
  platform_fee: number
  special_instructions?: string
  booking_for: string
  created_at: string
  updated_at: string
  patient?: {
    full_name: string
    phone_number?: string
    email: string
  }
  distance_km?: number
}

export interface BookingNotification {
  id: string
  booking_id: string
  title: string
  message: string
  notification_type: string
  is_read: boolean
  created_at: string
  booking: BookingRequest
}

export interface ChatMessage {
  id: string
  booking_id: string
  sender_id: string
  message: string
  message_type: string
  attachment_url?: string
  is_read: boolean
  created_at: string
  sender?: {
    full_name: string
    user_type: string
  }
}

export interface BookingNote {
  id: string
  booking_id: string
  caregiver_id: string
  title: string
  content?: string
  audio_transcript?: string
  ai_summary?: string
  ai_keywords?: string[]
  ai_recommendations?: string
  created_at: string
}

export interface LocationUpdate {
  latitude: number
  longitude: number
  accuracy?: number
  heading?: number
  speed?: number
  is_available: boolean
}

// Component Props
export interface CaregiverBookingsProps {
  route?: any
}

export interface BookingDetailsProps {
  route?: {
    params?: {
      booking?: BookingRequest
    }
  }
}

export interface ChatScreenProps {
  route?: {
    params?: {
      booking?: BookingRequest
    }
  }
}

export interface CallScreenProps {
  route?: {
    params?: {
      booking?: BookingRequest
      isVideo?: boolean
    }
  }
}

export interface AINoteTakerProps {
  route?: {
    params?: {
      booking?: BookingRequest
    }
  }
}
