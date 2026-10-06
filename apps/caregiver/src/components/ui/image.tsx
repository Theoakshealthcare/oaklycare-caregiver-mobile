"use client"

import type React from "react"
import { useState } from "react"
import {
  // type ImageProps as RNImageProps,
  StyleSheet,
  ActivityIndicator,
  View,
  type StyleProp,
  type ViewStyle,
  type ImageStyle,
} from "react-native"
import { Image as RNImage, type ImageProps as RNImageProps } from "expo-image";
import { theme } from "../../constants/theme"

interface ImageProps extends RNImageProps {
  containerStyle?: StyleProp<ViewStyle>
  imageStyle?: StyleProp<ImageStyle>
  showLoader?: boolean
  loaderColor?: string
  contentFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}

const Image: React.FC<ImageProps> = ({
  containerStyle,
  imageStyle,
  showLoader = true,
  loaderColor = theme.colors.primary,
  contentFit = "cover",
  onLoad,
  ...rest
}) => {
  const [isLoading, setIsLoading] = useState(true)

  const handleLoad: NonNullable<ImageProps["onLoad"]> = (event) => {
    setIsLoading(false)
    onLoad && onLoad(event)
  }

  const blurhash =
  "|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[";

  return (
    <View style={[{overflow: "hidden"}, containerStyle]}>
      <RNImage style={[{width: '100%', height: '100%'}, imageStyle]} contentFit={contentFit} onLoad={handleLoad} cachePolicy={"memory-disk"} placeholder={blurhash} {...rest} />

      {isLoading && showLoader && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={loaderColor} size="small" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  loaderContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
})

export default Image
