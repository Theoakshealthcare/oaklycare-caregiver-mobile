import { ApiResponse } from '../types/api.types'
import { get, post, put } from './api'
import type {
  CaregiverProfile,
  CaregiverProfileStep1,
  CaregiverProfileStep2,
  CaregiverConsentData,
  FormOptions,
  IdentityVerificationResponse,
  DocumentUploadResponse,
} from '@/src/types/caregiver.types'

class CaregiverService {
  private readonly baseURL = "/caregiver"

  async getProfile(): Promise<ApiResponse<CaregiverProfile>> {
    return await get<CaregiverProfile>(`${this.baseURL}/profile`)
  }

  async updateProfileStep1(data: CaregiverProfileStep1): Promise<ApiResponse<CaregiverProfile>> {
    return await put<CaregiverProfile>(`${this.baseURL}/profile/step1`, data)
  }

  async updateProfileStep2(data: CaregiverProfileStep2): Promise<ApiResponse<CaregiverProfile>> {
    return await put<CaregiverProfile>(`${this.baseURL}/profile/step2`, data)
  }

  async uploadDocument(file: any, documentType: string): Promise<ApiResponse<DocumentUploadResponse>> {
    const formData = new FormData()
    formData.append("file", {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any)
    formData.append("document_type", documentType)

    return await post<DocumentUploadResponse>(`${this.baseURL}/documents/upload`, formData, {
      "Content-Type": "multipart/form-data",
    })
  }

  async initiateIdentityVerification(): Promise<ApiResponse<IdentityVerificationResponse>> {
    return await post<IdentityVerificationResponse>(`${this.baseURL}/identity-verification/initiate`, {})
  }

  async completeIdentityVerification(): Promise<ApiResponse<any>> {
    return await post<any>(`${this.baseURL}/identity-verification/complete`, {})
  }

  async updateConsent(data: CaregiverConsentData): Promise<ApiResponse<CaregiverProfile>> {
    return await put<CaregiverProfile>(`${this.baseURL}/consent`, data)
  }

  async getVerificationStatus(): Promise<ApiResponse<any>> {
    return await get<any>(`${this.baseURL}/verification-status`)
  }

  async getFormOptions(): Promise<ApiResponse<FormOptions>> {
    return await get<FormOptions>(`${this.baseURL}/form-options`)
  }
}

export const caregiverService = new CaregiverService()
export default caregiverService
