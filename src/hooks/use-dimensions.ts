"use client"

import { useState, useEffect } from "react"
import { Dimensions, type ScaledSize } from "react-native"

interface DimensionsState {
  window: ScaledSize
  screen: ScaledSize
}

export const useDimensions = () => {
  const [dimensions, setDimensions] = useState<DimensionsState>({
    window: Dimensions.get("window"),
    screen: Dimensions.get("screen"),
  })

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window, screen }) => {
      setDimensions({ window, screen })
    })

    return () => subscription.remove()
  }, [])

  return dimensions
}
