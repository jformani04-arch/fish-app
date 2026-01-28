import { Text, type TextProps } from 'react-native'
import { useColorScheme } from 'react-native'

export type ThemedTextProps = TextProps & {
  lightColor?: string
  darkColor?: string
  type?: 'default' | 'title' | 'subtitle' | 'link'
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const theme = useColorScheme()

  const color =
    theme === 'dark'
      ? darkColor ?? '#FFFFFF'
      : lightColor ?? '#000000'

  const textStyles = {
    default: { fontSize: 16 },
    title: { fontSize: 28, fontWeight: '700' },
    subtitle: { fontSize: 18, fontWeight: '500' },
    link: { fontSize: 16, color: '#1E90FF' }
  }

  return (
    <Text
      style={[
        { color },
        textStyles[type],
        style
      ]}
      {...rest}
    />
  )
}
