// Import base API types

export interface CaregiverProfileStep1 {
  date_of_birth?: string
  gender?: "male" | "female" | "other"
  state?: string
  house_address?: string
  emergency_contact_phone?: string
}

export interface CaregiverProfileStep2 {
  specialization?: string
  years_of_experience?: number
  preferred_work_hours?: string
  service_areas?: string[]
}

export interface CaregiverConsentData {
  terms_accepted: boolean
  privacy_policy_accepted: boolean
  background_check_consent: boolean
}

export interface CaregiverProfile {
  id: string
  user_id: string
  email: string
  full_name: string
  phone_number?: string
  date_of_birth?: string
  gender?: string
  state?: string
  house_address?: string
  emergency_contact_phone?: string
  specialization?: string
  years_of_experience?: number
  preferred_work_hours?: string
  service_areas?: string[]
  profile_completion_step: number
  identity_verification_status: string
  background_check_status: string
  profile_status: string
  terms_accepted: boolean
  privacy_policy_accepted: boolean
  background_check_consent: boolean
  created_at: string
  updated_at: string
}

export interface FormOptions {
  specializations: string[]
  service_areas: string[]
  work_hours: string[]
  states: string[]
}

export interface IdentityVerificationResponse {
  applicant_id: string
  sdk_token: string
  check_id?: string
}

export interface DocumentUploadResponse {
  id: string
  document_type: string
  document_name: string
  file_path: string
  verification_status: string
  uploaded_at: string
}

// Component Props
export interface CaregiverSetupStep1Props {
  route?: any
}

export interface CaregiverSetupStep2Props {
  route?: any
}

export interface IdentityVerificationProps {
  route?: any
}

export interface DocumentScanProps {
  route?: {
    params?: {
      applicant_id?: string
      sdk_token?: string
    }
  }
}

export interface ProfileCompletedProps {
  route?: any
}

export interface ConsentScreenProps {
  route?: any
}
