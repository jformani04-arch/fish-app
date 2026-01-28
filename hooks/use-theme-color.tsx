import { useColorScheme } from '@/hooks/use-color-scheme'

export function useThemeColor(props: {
  light?: string
  dark?: string
}): string {
  const theme = useColorScheme()
  const colorFromProps = props[theme ?? 'light']

  if (!colorFromProps) {
    return theme === 'dark' ? '#FFFFFF' : '#000000'
  }

  return colorFromProps
}
