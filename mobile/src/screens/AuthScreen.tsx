import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type AuthMode = 'LOGIN' | 'REGISTER';

type AuthScreenProps = {
  errorMessage: string | null;
  isSubmitting: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
};

export function AuthScreen({
  errorMessage,
  isSubmitting,
  onLogin,
  onRegister,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = useMemo(
    () => !isSubmitting && email.trim().length > 0 && password.length >= 8,
    [email, isSubmitting, password],
  );

  async function handleSubmit() {
    const safeEmail = email.trim().toLowerCase();
    if (!safeEmail || password.length < 8 || isSubmitting) {
      return;
    }

    if (mode === 'LOGIN') {
      await onLogin(safeEmail, password);
      return;
    }
    await onRegister(safeEmail, password);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Design Your Tesla</Text>
        <Text style={styles.subtitle}>
          {mode === 'LOGIN' ? 'Sign in to sync your designs' : 'Create an account to save designs'}
        </Text>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('LOGIN')}
            style={[styles.modeButton, mode === 'LOGIN' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === 'LOGIN' && styles.modeTextActive]}>Login</Text>
          </Pressable>

          <Pressable
            onPress={() => setMode('REGISTER')}
            style={[styles.modeButton, mode === 'REGISTER' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === 'REGISTER' && styles.modeTextActive]}>
              Register
            </Text>
          </Pressable>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#7E8597"
          style={styles.input}
          value={email}
        />

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder="Password (min 8 chars)"
          placeholderTextColor="#7E8597"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            void handleSubmit();
          }}
          style={[styles.submitButton, !canSubmit && styles.disabled]}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? 'Please wait...' : mode === 'LOGIN' ? 'Login' : 'Create account'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D7DDE6',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  errorText: {
    color: '#AA1325',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F7F8FA',
    borderColor: '#D8DCE3',
    borderRadius: 10,
    borderWidth: 1,
    color: '#1E2532',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: '#F1F4F9',
    borderColor: '#D2D8E1',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: '#101317',
    borderColor: '#101317',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeText: {
    color: '#42506A',
    fontSize: 12,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#F6F8FC',
  },
  screen: {
    alignItems: 'center',
    backgroundColor: '#EDF1F6',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#101317',
    borderRadius: 10,
    paddingVertical: 12,
  },
  submitText: {
    color: '#F5F8FF',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5A6372',
    fontSize: 13,
  },
  title: {
    color: '#121722',
    fontSize: 25,
    fontWeight: '700',
  },
});
