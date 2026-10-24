import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors, fonts, spacing } from '@/theme';

/**
 * Entry point. Waits for the session to restore, then routes to the tabs
 * (signed in) or the login screen (signed out).
 */
export default function Index() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Nothing to do here — the render below handles routing.
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.brand}>ChatApp</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  brand: {
    fontSize: 28,
    fontFamily: fonts.medium,
    fontWeight: '700',
    color: colors.text,
  },
});
