import React, { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'
import type { DimensionValue } from 'react-native'

import { useTheme } from '../../theme/ThemeContext'
import { useReducedMotion } from '../../theme/useReducedMotion'

interface SkeletonProps {
  height?: number
  width?: DimensionValue
  /** Arredondamento; use `999` para avatares. */
  radius?: number
}

/**
 * Placeholder de carregamento. A pulsação é sutil de propósito — animação forte
 * numa lista inteira de skeletons vira ruído visual — e é desligada quando o
 * sistema pede movimento reduzido, caso em que o bloco fica estático.
 */
export default function Skeleton({ height = 16, width = '100%', radius = 8 }: SkeletonProps) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reducedMotion) return

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, reducedMotion])

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      style={[
        styles.base,
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: theme.border,
          opacity: reducedMotion
            ? 0.75
            : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({ base: { overflow: 'hidden' } })
