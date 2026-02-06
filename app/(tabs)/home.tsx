import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import LogoutButton from '@/components/LogoutButton'

export default function home() {
  return (
    <SafeAreaView>
      <Text>home</Text>
      <LogoutButton></LogoutButton>
    </SafeAreaView>
  )
}


const styles = StyleSheet.create({})