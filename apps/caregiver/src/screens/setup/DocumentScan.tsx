"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, StyleSheet, Alert } from "react-native"
import { Camera } from "expo-camera"
import { Feather } from "@expo/vector-icons"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import type { DocumentScanProps } from "@/src/types/caregiver.types"

const DocumentScan = () => {
  const { navigation } = Navigation()
  // const { applicant_id, sdk_token } = route?.params || {}

  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [cameraRef, setCameraRef] = useState<Camera | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === "granted")
    })()
  }, [])

  const takePicture = async () => {
    if (cameraRef && !isCapturing) {
      try {
        setIsCapturing(true)
        const photo = await Camera.takePictureAsync({
          quality: 0.8,
          base64: false,
        })

        // Here you would integrate with Onfido SDK to upload the document
        // For now, we'll simulate success and navigate back
        Alert.alert("Document Captured", "Document has been captured successfully", [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ])
      } catch (error) {
        Alert.alert("Error", "Failed to capture document")
      } finally {
        setIsCapturing(false)
      }
    }
  }

  if (hasPermission === null) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text>Requesting camera permission...</Text>
      </View>
    )
  }

  if (hasPermission === false) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text>No access to camera</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          title="Back"
          onPress={() => navigation.goBack()}
          variant="ghost"
          leftIcon={<Feather name="chevron-left" size={20} />}
        />
        <Text variant="h3" weight="medium">
          Document Scan
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.cameraContainer}>
        <Camera style={styles.camera} type={Camera.Constants.Type.back} ref={(ref) => setCameraRef(ref)}>
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
          </View>
        </Camera>
      </View>

      <View style={styles.controls}>
        <Button
          title={isCapturing ? "Capturing..." : "Capture Document"}
          onPress={takePicture}
          loading={isCapturing}
          style={styles.captureButton}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "white",
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 300,
    height: 200,
    borderWidth: 2,
    borderColor: "white",
    borderRadius: 10,
  },
  controls: {
    backgroundColor: "white",
    padding: 20,
  },
  captureButton: {
    width: "100%",
  },
})

export default DocumentScan
