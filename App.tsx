/**
 * DIGITAL ABBU — Root Application Component
 */
import React, { useMemo, memo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { DEEP_BACKGROUND } from './src/constants/colors';

import { EmergencyLockProvider } from './src/contexts/EmergencyLockContext';

function GlobalBrandMark() {
  return (
    <View pointerEvents="none" style={styles.brandMarkContainer}>
      <Text style={styles.brandMark}>MEMENTO MORI</Text>
    </View>
  );
}

const App = memo(function App() {
  const navigationTheme = useMemo(() => ({
    dark: true,
    colors: {
      primary: '#6DB1B7',
      background: DEEP_BACKGROUND,
      card: DEEP_BACKGROUND,
      text: '#F5F7FA',
      border: 'transparent',
      notification: '#6DB1B7',
    },
    fonts: {
      regular: { fontFamily: 'Aquire', fontWeight: '400' as const },
      medium: { fontFamily: 'AquireLight', fontWeight: '500' as const },
      bold: { fontFamily: 'AquireBold', fontWeight: '700' as const },
      heavy: { fontFamily: 'AquireBold', fontWeight: '900' as const },
    },
  }), []);

  return (
    <SafeAreaProvider>
      <View style={styles.appShell}>
        <StatusBar style="light" backgroundColor={DEEP_BACKGROUND} />
        <GlobalBrandMark />
        <NavigationContainer theme={navigationTheme}>
          <EmergencyLockProvider>
            <AppNavigator />
          </EmergencyLockProvider>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
});

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: DEEP_BACKGROUND,
  },
  brandMarkContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  brandMark: {
    fontFamily: 'Aquire',
    fontSize: 14,
    letterSpacing: 4,
    color: '#F5F7FA',
    opacity: 0.6,
    textShadowColor: '#6DB1B7',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

export default App;
