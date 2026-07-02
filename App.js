import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from './src/screens/DashboardScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import VehicleSearchScreen from './src/screens/VehicleSearchScreen';
import VehicleDetailScreen from './src/screens/VehicleDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import LoadingView from './src/components/LoadingView';
import { colors } from './src/theme';
import { warmRepairCache, probeRangeApiOnce } from './src/data/api';
import { AuthProvider, useAuth } from './src/data/AuthContext';
import JobPreviewLauncher from './src/components/JobPreviewLauncher';

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

function AppNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (session) {
      warmRepairCache();
      probeRangeApiOnce();
    }
  }, [session]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <LoadingView message="กำลังโหลด..." />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="JobDetail" component={JobDetailScreen} />
          <Stack.Screen name="VehicleSearch" component={VehicleSearchScreen} />
          <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
      <JobPreviewLauncher />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.navy },
});
