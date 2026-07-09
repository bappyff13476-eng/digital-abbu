/**
 * AppNavigator — Stack navigator for DIGITAL ABBU
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import AdminScreen from '../screens/AdminScreen';
import LockOverlayScreen from '../screens/LockOverlayScreen';
import { DEEP_BACKGROUND } from '../constants/colors';

export type RootStackParamList = {
  Dashboard: undefined;
  Admin: undefined;
  LockOverlay: { adminAuthorized: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: DEEP_BACKGROUND },
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
      <Stack.Screen
        name="LockOverlay"
        component={LockOverlayScreen}
        options={{
          presentation: 'modal',
          animation: 'fade_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}
