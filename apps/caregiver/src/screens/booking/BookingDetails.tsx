"use client"

import type React from "react"
import { useState } from "react"
import { View, ScrollView, Alert } from "react-native"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import bookingService from "@/src/services/booking.service"
import type { BookingDetailsProps } from "@/src/types/booking.types"

const BookingDetails: React.FC<BookingDetailsProps> = ({ route }) => {
  const { navigation } = Navigation()
  const { booking } = route?.params || {}

  const [isLoading, setIsLoading] = useState(false)

  if (!booking) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text variant="body">Booking not found</Text>
      </View>
    )
  }

  const handleAcceptJob = async () => {
    try {
      setIsLoading(true)
      await bookingService.acceptBooking(booking.id)
      Alert.alert("Success", "Job accepted successfully!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ])
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to accept job")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeclineJob = async () => {
    Alert.alert("Decline Job", "Are you sure you want to decline this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoading(true)
            await bookingService.declineBooking(booking.id)
            Alert.alert("Success", "Job declined", [
              {
                text: "OK",
                onPress: () => navigation.goBack(),
              },
            ])
          } catch (error: any) {
            Alert.alert("Error", error.detail || "Failed to decline job")
          } finally {
            setIsLoading(false)
          }
        },
      },
    ])
  }

  const renderDetailRow = (label: string, value: string, valueColor?: string) => (
    <View style={[globalStyles.row, { justifyContent: "space-between", marginBottom: 16 }]}>
      <Text variant="body" color={theme.colors.textLight}>
        {label}
      </Text>
      <Text variant="body" weight="medium" color={valueColor || theme.colors.text}>
        {value}
      </Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView>
        <View style={globalStyles.container}>
          <HeaderBack />

          <View style={{ marginVertical: "5%" }}>
            <Text variant="h2" weight="bold">
              Job Details
            </Text>
          </View>

          <View style={{ marginBottom: 30 }}>
            <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
              Service Information
            </Text>

            {renderDetailRow("Service Type", booking.assistance_type)}
            {renderDetailRow("Client", booking.patient?.full_name || "N/A")}
            {renderDetailRow(
              "Date & Time",
              new Date(booking.scheduled_date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            )}
            {renderDetailRow("Duration", `${booking.duration_hours * 60} minutes`)}
            {renderDetailRow("Payment", `₦${booking.total_amount.toLocaleString()}`)}
            {renderDetailRow(
              "Payment Status",
              booking.payment_status.toUpperCase(),
              booking.payment_status === "paid" ? theme.colors.success : theme.colors.warning,
            )}
          </View>

          <View style={{ marginBottom: 30 }}>
            <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
              Location
            </Text>

            {renderDetailRow("Address", booking.patient_address.split(",")[0] || "N/A")}
            {renderDetailRow("City", `${booking.patient_city}, ${booking.patient_state}`)}
            <View style={[globalStyles.row, { justifyContent: "space-between", marginBottom: 16 }]}>
              <Text variant="body" color={theme.colors.textLight}>
                Distance
              </Text>
              <View style={[globalStyles.row, { alignItems: "center" }]}>
                <Button
                  title="Get Direction"
                  variant="outline"
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    marginRight: 8,
                  }}
                  textStyle={{ fontSize: 12 }}
                />
                <Text variant="body" weight="medium">
                  {booking.distance_km ? `${booking.distance_km} miles from you` : "3.2 miles from you"}
                </Text>
              </View>
            </View>
          </View>

          {booking.special_instructions && (
            <View style={{ marginBottom: 30 }}>
              <Text variant="h3" weight="bold" style={{ marginBottom: 16 }}>
                Special Instructions
              </Text>
              <View
                style={{
                  backgroundColor: theme.colors.background,
                  padding: 16,
                  borderRadius: 8,
                }}
              >
                <Text variant="body" style={{ lineHeight: 22 }}>
                  {booking.special_instructions}
                </Text>
              </View>
            </View>
          )}

          <View style={[globalStyles.row, { gap: 12, marginTop: 20 }]}>
            <Button title="Accept Job" onPress={handleAcceptJob} loading={isLoading} style={{ flex: 1 }} />
            <Button
              title="Decline Job"
              onPress={handleDeclineJob}
              variant="outline"
              style={{
                flex: 1,
                borderColor: theme.colors.error,
              }}
              textStyle={{ color: theme.colors.error }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default BookingDetails
