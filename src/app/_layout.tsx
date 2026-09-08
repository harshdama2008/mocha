import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

// The native tab bar (NativeTabs, in (tabs)/_layout.tsx) only ever renders
// screens that have a <NativeTabs.Trigger> — correction and status have
// none, so without a Stack here they exist in navigation state but have no
// render surface at all: router.push resolves, nothing appears on screen.
// This Stack is what gives them one, as modal screens on top of the tabs.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="correction" options={{ presentation: 'modal' }} />
        <Stack.Screen name="status" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
