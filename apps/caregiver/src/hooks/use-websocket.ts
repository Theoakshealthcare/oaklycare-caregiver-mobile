"use client"

import { useEffect, useRef, useState } from "react"
import { useAuthStore } from "@/src/stores/auth.store"

interface WebSocketMessage {
  type: string
  data?: any
  booking_id?: string
  sender_id?: string
  message?: string
  timestamp?: string
}

export const useWebSocket = () => {
  const { user, token, isAuthenticated } = useAuthStore()
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<WebSocketMessage[]>([])
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const getWebSocketUrl = (): string => {
    // Use the same base URL as the API service
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000"
    return baseUrl.replace('http', 'ws')
  }

  const connect = () => {
    if (!token || !user || !isAuthenticated) return

    try {
      const wsBaseUrl = getWebSocketUrl()
      const wsUrl = `${wsBaseUrl}/api/v1/ws/${token}`

      console.log("Connecting to WebSocket:", wsUrl)
      ws.current = new WebSocket(wsUrl)

      ws.current.onopen = () => {
        console.log("WebSocket connected")
        setIsConnected(true)
        reconnectAttempts.current = 0
      }

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          console.log("WebSocket message received:", message)
          setMessages((prev) => [...prev, message])
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error)
        }
      }

      ws.current.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason)
        setIsConnected(false)

        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          const delay = 2000 * Math.pow(2, reconnectAttempts.current - 1) // Exponential backoff
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`)

          setTimeout(() => {
            connect()
          }, delay)
        }
      }

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error)
      }
    } catch (error) {
      console.error("Failed to connect WebSocket:", error)
    }
  }

  const disconnect = () => {
    if (ws.current) {
      ws.current.close(1000, "Manual disconnect")
      ws.current = null
    }
  }

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("Sending WebSocket message:", message)
      ws.current.send(JSON.stringify(message))
    } else {
      console.warn("WebSocket not connected, cannot send message:", message)
    }
  }

  const joinBooking = (bookingId: string) => {
    sendMessage({
      type: "join_booking",
      booking_id: bookingId,
    })
  }

  const leaveBooking = (bookingId: string) => {
    sendMessage({
      type: "leave_booking",
      booking_id: bookingId,
    })
  }

  const sendChatMessage = (bookingId: string, message: string) => {
    sendMessage({
      type: "chat_message",
      booking_id: bookingId,
      message,
      timestamp: new Date().toISOString(),
    })
  }

  const sendLocationUpdate = (bookingId: string, latitude: number, longitude: number) => {
    sendMessage({
      type: "location_update",
      booking_id: bookingId,
      data: {
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      },
    })
  }

  useEffect(() => {
    if (isAuthenticated) {
      connect()
    } else {
      disconnect()
    }

    return () => disconnect()
  }, [token, user, isAuthenticated, connect])

  return {
    isConnected,
    messages,
    sendMessage,
    joinBooking,
    leaveBooking,
    sendChatMessage,
    sendLocationUpdate,
  }
}
