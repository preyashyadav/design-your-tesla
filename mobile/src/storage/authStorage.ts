import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'design-your-tesla:auth-token:v1';

async function writeFallback(value: string | null): Promise<void> {
  if (value === null) {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, value);
}

export async function loadAuthToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    if (token) {
      return token;
    }
  } catch {
    // Fall back for platforms where SecureStore is unavailable.
  }

  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function persistAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    await writeFallback(token);
    return;
  } catch {
    await writeFallback(token);
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {
    // Ignore deletion errors.
  }

  await writeFallback(null);
}
