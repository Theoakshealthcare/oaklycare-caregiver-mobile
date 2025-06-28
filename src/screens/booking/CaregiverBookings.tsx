"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, Image, ActivityIndicator, Linking } from "react-native"
import { Feather } from "@expo/vector-icons"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import bookingService from "@/src/services/booking.service"
import type { CaregiverBookingsProps, BookingRequest, BookingNotification } from "@/src/types/booking.types"

const CaregiverBookings: React.FC<CaregiverBookingsProps> = ({ route }) => {
  const { navigation } = Navigation()

  const [activeTab, setActiveTab] = useState<"new_requests" | "upcoming" | "completed">("new_requests")
  const [bookings, setBookings] = useState<BookingRequest[]>([])
  const [notifications, setNotifications] = useState<BookingNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null)

  useEffect(() => {
    loadBookings()
    if (activeTab === "new_requests") {
      loadNotifications()
    }
  }, [activeTab])

  const loadBookings = async () => {
    try {
      setIsLoading(true)
      let status: string | undefined

      switch (activeTab) {
        case "upcoming":
          status = "accepted,in_progress"
          break
        case "completed":
          status = "completed"
          break
        case "new_requests":
          status = "new_requests"
          break
      }

      const data = await bookingService.getCaregiverBookings(status)
      setBookings(data)
    } catch (error) {
      console.error("Failed to load bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const data = await bookingService.getCaregiverNotifications(true)
      setNotifications(data)
    } catch (error) {
      console.error("Failed to load notifications:", error)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadBookings()
    if (activeTab === "new_requests") {
      await loadNotifications()
    }
    setRefreshing(false)
  }

  const handleAcceptBooking = async (bookingId: string) => {
    try {
      await bookingService.acceptBooking(bookingId)
      Alert.alert("Success", "Booking accepted successfully!")
      loadBookings()
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to accept booking")
    }
  }

  const handleDeclineBooking = (bookingId: string) => {
    setDeclineBookingId(bookingId)
    setShowDeclineModal(true)
  }

  const confirmDeclineBooking = async () => {
    if (!declineBookingId) return
    try {
      setIsLoading(true)
      await bookingService.declineBooking(declineBookingId)
      Alert.alert("Success", "Booking declined")
      setShowDeclineModal(false)
      setDeclineBookingId(null)
      loadBookings()
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to decline booking")
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewDetails = (booking: BookingRequest) => {
    navigation.navigate('BookingDetails', { booking })
  }

  const handleStartService = async (bookingId: string) => {
    try {
      await bookingService.startService(bookingId)
      Alert.alert("Success", "Service started!")
      loadBookings()
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to start service")
    }
  }

  const handleGetDirection = (booking: BookingRequest) => {
    const url = `https://maps.google.com/?daddr=${booking.patient_latitude},${booking.patient_longitude}`
    Linking.openURL(url)
  }

  const renderTabButton = (tab: string, title: string) => (
    <TouchableOpacity
      key={tab}
      style={{
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 25,
        backgroundColor: activeTab === tab ? theme.colors.primary : "transparent",
        alignItems: "center",
      }}
      onPress={() => setActiveTab(tab as any)}
    >
      <Text variant="body" weight="medium" color={activeTab === tab ? theme.colors.white : theme.colors.textLight}>
        {title}
      </Text>
    </TouchableOpacity>
  )

  // Helper for icon+text button
  const IconButton = ({ icon, title, onPress, style, variant = "primary", textStyle }: any) => (
    <TouchableOpacity
      style={[{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.borderRadius.xxl,
        paddingVertical: theme.sizes.large,
        paddingHorizontal: theme.sizes.extraLarge,
        backgroundColor: variant === 'primary' ? theme.colors.primary : theme.colors.white,
        borderWidth: variant === 'neutral' ? 1 : 0,
        borderColor: variant === 'neutral' ? theme.colors.primary : 'transparent',
      }, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[{ marginLeft: 8, color: variant === 'primary' ? theme.colors.white : theme.colors.primary, fontWeight: '600', fontSize: 16 }, textStyle]}>{title}</Text>
    </TouchableOpacity>
  )

  const renderBookingCard = (booking: BookingRequest) => (
    <View
      key={booking.id}
      style={{
        backgroundColor: theme.colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <View style={[globalStyles.row, { justifyContent: "space-between", marginBottom: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text variant="h3" weight="bold">
            {booking.patient?.full_name || "Patient"}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.primaryLight,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              alignSelf: "flex-start",
              marginTop: 4,
            }}
          >
            <Text variant="small" color={theme.colors.primary} weight="medium">
              {booking.assistance_type}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: theme.colors.primaryLight,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Text variant="small" color={theme.colors.primary} weight="medium">
            Confirmed
          </Text>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <View style={[globalStyles.row, { marginBottom: 4 }]}>
          <Feather name="calendar" size={16} color={theme.colors.textLight} />
          <Text variant="body" color={theme.colors.textLight} style={{ marginLeft: 8 }}>
            {booking.patient_address}
          </Text>
        </View>
        <View style={[globalStyles.row, { marginBottom: 4 }]}>
          <Feather name="clock" size={16} color={theme.colors.textLight} />
          <Text variant="body" color={theme.colors.textLight} style={{ marginLeft: 8 }}>
            {new Date(booking.scheduled_date).toLocaleDateString("en-US", {
              weekday: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <Text variant="body" weight="bold" style={{ marginTop: 8 }}>
          ₦{booking.total_amount.toLocaleString()} ({booking.duration_hours * 60} min session)
        </Text>
      </View>

      {activeTab === "new_requests" && (
        <View style={[globalStyles.row, { gap: 12 }]}>
          <IconButton
            icon={<Feather name="eye" size={16} color={theme.colors.primary} />}
            title="View Details"
            onPress={() => handleViewDetails(booking)}
            style={{ flex: 1 }}
          />
          <IconButton
            icon={<Feather name="x" size={16} color={theme.colors.error} />}
            title="Decline"
            onPress={() => handleDeclineBooking(booking.id)}
            style={{ flex: 1, borderColor: theme.colors.error }}
            textStyle={{ color: theme.colors.error }}
          />
          <IconButton
            icon={<Feather name="check" size={16} color={theme.colors.white} />}
            title="Accept"
            onPress={() => handleAcceptBooking(booking.id)}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {activeTab === "upcoming" && (
        <View style={[globalStyles.row, { gap: 12 }]}>
          <IconButton
            icon={<Feather name="eye" size={16} color={theme.colors.primary} />}
            title="View Details"
            onPress={() => handleViewDetails(booking)}
            style={{ flex: 1 }}
          />
          {booking.status === "accepted" && (
            <IconButton
              icon={<Feather name="play" size={16} color={theme.colors.white} />}
              title="Start Service"
              onPress={() => handleStartService(booking.id)}
              style={{ flex: 1 }}
            />
          )}
          {booking.status === "in_progress" && (
            <IconButton
              icon={<Feather name="navigation" size={16} color={theme.colors.white} />}
              title="Get Direction"
              onPress={() => handleGetDirection(booking)}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}

      {activeTab === "completed" && (
        <View style={[globalStyles.row, { gap: 12 }]}>
          <IconButton
            icon={<Feather name="eye" size={16} color={theme.colors.primary} />}
            title="View Details"
            onPress={() => handleViewDetails(booking)}
            style={{ flex: 1 }}
          />
          <IconButton
            icon={<Feather name="navigation" size={16} color={theme.colors.white} />}
            title="Get Direction"
            onPress={() => handleGetDirection(booking)}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  )

  const renderDeclineModal = () => (
    <Modal visible={showDeclineModal} transparent animationType="fade" onRequestClose={() => setShowDeclineModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: theme.colors.white, borderRadius: 24, padding: 28, width: '85%', alignItems: 'center' }}>
          <TouchableOpacity style={{ alignSelf: 'flex-end' }} onPress={() => setShowDeclineModal(false)}>
            <Feather name="x" size={24} color={theme.colors.textLight} />
          </TouchableOpacity>
          <Image source={require('@/assets/images/pngs/decline.png')} style={{ width: 64, height: 64, marginVertical: 12 }} />
          <Text variant="h2" weight="bold" style={{ textAlign: 'center', marginBottom: 8 }}>Are you sure you want to decline this Booking?</Text>
          <Text variant="body" color={theme.colors.textLight} style={{ textAlign: 'center', marginBottom: 24 }}>
            Once you decline this booking, you won&apos;t have access to a patient.
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Button title="No, Go Back" variant="neutral" style={{ flex: 1 }} textStyle={{ color: theme.colors.primary }} onPress={() => setShowDeclineModal(false)} />
            <Button title="Yes, Cancel" style={{ flex: 1, backgroundColor: theme.colors.error }} onPress={confirmDeclineBooking} />
          </View>
        </View>
      </View>
    </Modal>
  )

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
      {/* Header */}
      <View
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text variant="h2" weight="bold" color={theme.colors.white}>
          Bookings
        </Text>
        <TouchableOpacity>
          <Feather name="bell" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View
        style={{
          backgroundColor: theme.colors.white,
          borderRadius: 30,
          padding: 4,
          marginHorizontal: 20,
          marginBottom: 20,
          flexDirection: "row",
        }}
      >
        {renderTabButton("new_requests", "New Request")}
        {renderTabButton("upcoming", "Upcoming")}
        {renderTabButton("completed", "Completed")}
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 20,
        }}
      >
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={{ paddingHorizontal: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {bookings.length === 0 ? (
              <View style={{ alignItems: "center", marginTop: 50 }}>
                <Image source={require('@/assets/images/pngs/calendar-remove.png')} style={{ width: 120, height: 120, marginBottom: 16 }} />
                <Text variant="h3" weight="bold" style={{ textAlign: 'center', marginBottom: 8 }}>You do not have any appointments</Text>
                <Text variant="body" color={theme.colors.textLight} style={{ textAlign: 'center' }}>
                  Click on start booking to book appointments for your loved ones
                </Text>
              </View>
            ) : (
              bookings.map(renderBookingCard)
            )}
          </ScrollView>
        )}
        {renderDeclineModal()}
      </View>
    </View>
  )
}

export default CaregiverBookings
