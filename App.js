import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider } from './src/auth/AuthContext';
import { DialogProvider } from './src/components/SweetDialog';
import DashboardScreen from './src/screens/DashboardScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import VehicleSearchScreen from './src/screens/VehicleSearchScreen';
import VehicleDetailScreen from './src/screens/VehicleDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import BreakdownScreen from './src/screens/BreakdownScreen';
import RepairDetailScreen from './src/screens/RepairDetailScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

const navTheme = {
  dark: false,
  colors: {
    primary: colors.navy,
    background: colors.navy,
    card: colors.navy,
    text: colors.onNavy,
    border: 'transparent',
    notification: colors.barFillAlt,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DialogProvider>
          <StatusBar style="light" />
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="JobDetail" component={JobDetailScreen} />
              <Stack.Screen name="VehicleSearch" component={VehicleSearchScreen} />
              <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Breakdown" component={BreakdownScreen} />
              <Stack.Screen name="RepairDetail" component={RepairDetailScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </DialogProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
