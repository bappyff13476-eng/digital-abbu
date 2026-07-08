/**
 * DIGITAL ABBU — Root Application Component
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { DEEP_BACKGROUND } from './src/constants/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: '#38BDF8',
            background: DEEP_BACKGROUND,
            card: DEEP_BACKGROUND,
            text: '#F8FAFC',
            border: 'transparent',
            notification: '#38BDF8',
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: '400' },
            medium: { fontFamily: 'System', fontWeight: '500' },
            bold: { fontFamily: 'System', fontWeight: '700' },
            heavy: { fontFamily: 'System', fontWeight: '900' },
          },
        }}
      >
        <StatusBar style="light" backgroundColor={DEEP_BACKGROUND} />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
