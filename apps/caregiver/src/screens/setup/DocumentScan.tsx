"use client"

import type React from "react"
import { useRef, useState } from "react"
import { View, StyleSheet, Alert } from "react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { Feather } from "@expo/vector-icons"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"

const DocumentScan: React.FC = () => {
  const { navigation } = Navigation()

  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  // The photo is not uploaded or reported as verified here: identity is decided by an
  // admin review of the submitted documents, so a capture alone never claims success.
  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return
    try {
      setIsCapturing(true)
      await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false })
      navigation.goBack()
    } catch {
      Alert.alert("Error", "Failed to capture document")
    } finally {
      setIsCapturing(false)
    }
  }

  if (!permission) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text>Checking camera permission...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <Text>Oakly needs camera access to capture your documents.</Text>
        {permission.canAskAgain && (
          <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: 20 }} />
        )}
        <Button title="Go Back" onPress={() => navigation.goBack()} variant="ghost" style={{ marginTop: 20 }} />
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
        <CameraView style={styles.camera} facing="back" ref={cameraRef} />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.scanFrame} />
        </View>
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
    ...StyleSheet.absoluteFill,
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
