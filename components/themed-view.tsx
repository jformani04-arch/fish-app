import { View, type ViewProps } from 'react-native'
import { useColorScheme } from 'react-native'

export type ThemedViewProps = ViewProps & {
  lightColor?: string
  darkColor?: string
}

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const theme = useColorScheme()

  const backgroundColor =
    theme === 'dark'
      ? darkColor ?? '#121212'
      : lightColor ?? '#FFFFFF'

  return (
    <View
      style={[
        { backgroundColor },
        style
      ]}
      {...otherProps}
    />
  )
}
