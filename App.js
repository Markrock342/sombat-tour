import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { DialogProvider } from './src/components/SweetDialog';
import DashboardScreen from './src/screens/DashboardScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import VehicleSearchScreen from './src/screens/VehicleSearchScreen';
import VehicleDetailScreen from './src/screens/VehicleDetailScreen';
import SearchScreen from './src/screens/SearchScreen';
import LoginScreen from './src/screens/LoginScreen';
import RepairFormScreen from './src/screens/RepairFormScreen';
import RepairDetailScreen from './src/screens/RepairDetailScreen';
import PublicReportScreen from './src/screens/PublicReportScreen';
import ReportSuccessScreen from './src/screens/ReportSuccessScreen';
import TrackRepairScreen from './src/screens/TrackRepairScreen';
import BoardScreen from './src/screens/BoardScreen';
import BreakdownScreen from './src/screens/BreakdownScreen';
import LocationScreen from './src/screens/LocationScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';
import { initPwaInstallCapture } from './src/data/pwaInstall';

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

const linking = {
  prefixes: ['https://425service.vercel.app', 'http://localhost:8081', 'http://localhost:19006'],
  config: {
    screens: {
      TrackRepair: {
        path: 'track/:token?',
        parse: {
          token: (value) => {
            if (!value || value === 'undefined' || value === 'null') return undefined;
            return value;
          },
        },
      },
      PublicReport: 'report',
      ReportSuccess: 'report/success',
    },
  },
};

function dismissPwaSplash() {
  if (typeof window === 'undefined') return;
  const hide = window.__hidePwaSplash;
  if (typeof hide === 'function') hide();
}

function AuthGate() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.onNavy} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="VehicleSearch" component={VehicleSearchScreen} />
            <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
            <Stack.Screen name="RepairForm" component={RepairFormScreen} />
            <Stack.Screen name="RepairDetail" component={RepairDetailScreen} />
            <Stack.Screen name="Board" component={BoardScreen} />
            <Stack.Screen name="Breakdown" component={BreakdownScreen} />
            <Stack.Screen name="Locations" component={LocationScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
        {/* หน้าสาธารณะ — ลูกค้าเปิดจากลิงก์/QR ได้โดยไม่ต้องล็อกอิน */}
        <Stack.Screen name="PublicReport" component={PublicReportScreen} />
        <Stack.Screen name="ReportSuccess" component={ReportSuccessScreen} />
        <Stack.Screen name="TrackRepair" component={TrackRepairScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    dismissPwaSplash();
    initPwaInstallCapture();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DialogProvider>
          <StatusBar style="light" />
          <AuthGate />
        </DialogProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
