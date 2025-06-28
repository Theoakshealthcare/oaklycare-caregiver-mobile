"use client"

import { useRef } from "react"
import { Animated, Easing } from "react-native"

interface AnimationOptions {
  duration?: number
  easing?: (value: number) => number
  delay?: number
  useNativeDriver?: boolean
}

export const useAnimation = (initialValue = 0) => {
  const animatedValue = useRef(new Animated.Value(initialValue)).current

  const animate = (toValue: number, options: AnimationOptions = {}) => {
    const { duration = 300, easing = Easing.ease, delay = 0, useNativeDriver = true } = options

    return Animated.timing(animatedValue, {
      toValue,
      duration,
      easing,
      delay,
      useNativeDriver,
    })
  }

  const interpolate = (config: Animated.InterpolationConfigType) => {
    return animatedValue.interpolate(config)
  }

  return {
    value: animatedValue,
    animate,
    interpolate,
  }
}
