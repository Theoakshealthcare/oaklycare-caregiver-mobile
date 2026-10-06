import { get, post } from './api'
import type {
  BookingRequest,
  BookingNotification,
  ChatMessage,
  BookingNote,
  LocationUpdate,
  ApiResponse,
  PaginatedResponse,
} from '@/src/types/booking.types'

class BookingService {
  private readonly baseURL = "/booking"

  // Caregiver Booking Management
  async getCaregiverBookings(status?: string): Promise<ApiResponse<BookingRequest[]>> {
    const params = status ? { status } : undefined
    return await get<BookingRequest[]>(`${this.baseURL}/caregiver/bookings`, params)
  }

  async getCaregiverNotifications(unreadOnly = false): Promise<ApiResponse<BookingNotification[]>> {
    const params = unreadOnly ? { unread_only: true } : undefined
    return await get<BookingNotification[]>(`${this.baseURL}/caregiver/notifications`, params)
  }

  async handleBookingAction(bookingId: string, action: string, reason?: string): Promise<ApiResponse<any>> {
    const body = reason ? { action, reason } : { action }
    return await post<any>(`${this.baseURL}/caregiver/action/${bookingId}`, body)
  }

  async getBookingDetails(bookingId: string): Promise<ApiResponse<BookingRequest>> {
    return await get<BookingRequest>(`${this.baseURL}/booking/${bookingId}`)
  }

  // Location Services
  async updateLocation(locationData: LocationUpdate): Promise<ApiResponse<any>> {
    return await post<any>(`${this.baseURL}/caregiver/location`, locationData)
  }

  async getCurrentLocation(): Promise<ApiResponse<any>> {
    return await get<any>(`${this.baseURL}/caregiver/location`)
  }

  // Chat Services
  async sendChatMessage(bookingId: string, message: string): Promise<ApiResponse<ChatMessage>> {
    return await post<ChatMessage>(`${this.baseURL}/chat/${bookingId}/send`, {
      message,
      message_type: "text",
    })
  }

  async getChatMessages(bookingId: string): Promise<ApiResponse<ChatMessage[]>> {
    return await get<ChatMessage[]>(`${this.baseURL}/chat/${bookingId}/messages`)
  }

  // Notes Services
  async createBookingNote(
    bookingId: string,
    title: string,
    content?: string,
    audioTranscript?: string,
  ): Promise<ApiResponse<BookingNote>> {
    return await post<BookingNote>(`${this.baseURL}/notes/${bookingId}/create`, {
      title,
      content,
      audio_transcript: audioTranscript,
    })
  }

  async getBookingNotes(bookingId: string): Promise<ApiResponse<BookingNote[]>> {
    return await get<BookingNote[]>(`${this.baseURL}/notes/${bookingId}`)
  }

  // Accept/Decline Actions
  async acceptBooking(bookingId: string): Promise<ApiResponse<any>> {
    return this.handleBookingAction(bookingId, "accept")
  }

  async declineBooking(bookingId: string, reason?: string): Promise<ApiResponse<any>> {
    return this.handleBookingAction(bookingId, "decline", reason)
  }

  async startService(bookingId: string): Promise<ApiResponse<any>> {
    return this.handleBookingAction(bookingId, "start")
  }

  async completeService(bookingId: string): Promise<ApiResponse<any>> {
    return this.handleBookingAction(bookingId, "complete")
  }
}

export const bookingService = new BookingService()
export default bookingService
