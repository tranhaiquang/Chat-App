import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Android channel used for all chat notifications. */
export const CHAT_CHANNEL_ID = 'chat-messages';

/**
 * Shows notifications while the app is in the foreground. Set once, at module
 * load, before any notification arrives.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers the Expo push token for this device and stores it server-side.
 * Safe to call repeatedly: the token is upserted by its unique value.
 *
 * Returns the token, or null when the device cannot receive pushes (web,
 * simulator without a project id, or the user declined permission).
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  // Push notifications are unavailable on web.
  if (Platform.OS === 'web') return null;

  // Android requires a channel to exist before a token can be obtained.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHAT_CHANNEL_ID, {
      name: 'Chat messages',
      // AndroidImportance is re-exported from the package root at runtime;
      // the import/namespace rule cannot see through that re-export.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  }

  if (!Device.isDevice) {
    // Physical device required for a real push token.
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') return null;

  // The project id comes from EAS; it is required to mint an Expo push token.
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    (await getEasProjectId());

  if (!projectId) {
    console.warn(
      '[notifications] No EAS projectId found — skipping push token registration.',
    );
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  const token = tokenData.data;
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  const { error: upsertError } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform },
      { onConflict: 'token' },
    );

  if (upsertError) throw upsertError;

  return token;
}

/** Reads the EAS project id out of the Expo config, if present. */
async function getEasProjectId(): Promise<string | null> {
  try {
    const Constants = await import('expo-constants');
    const config = Constants.default ?? Constants;
    return (
      config?.expoConfig?.extra?.eas?.projectId ??
      config?.easConfig?.projectId ??
      null
    );
  } catch {
    return null;
  }
}

/** Removes this device's push token so it stops receiving notifications. */
export async function unregisterFromPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? undefined,
  });

  if (tokenData?.data) {
    await supabase.from('push_tokens').delete().eq('token', tokenData.data);
  }
}

/**
 * Subscribes to incoming notifications and routes the user to the right
 * conversation when they tap one.
 */
export function addNotificationResponseListener(
  onOpenConversation: (conversationId: string) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const conversationId =
        response.notification.request.content.data?.conversationId;
      if (typeof conversationId === 'string') {
        onOpenConversation(conversationId);
      }
    },
  );

  return () => subscription.remove();
}
