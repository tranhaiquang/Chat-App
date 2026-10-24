import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { addNotificationResponseListener } from '@/lib/notifications';
import { colors } from '@/theme';

/**
 * Wires push-notification taps to navigation. Lives inside AuthProvider so
 * it can react to the signed-in user.
 */
function NotificationRouter() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    return addNotificationResponseListener((conversationId) => {
      router.push(`/chat/${conversationId}`);
    });
  }, [user]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationRouter />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="login"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="signup"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="new-chat"
            options={{ title: 'New conversation', presentation: 'modal' }}
          />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
