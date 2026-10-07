import 'react-native-gesture-handler';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* App is already edge-to-edge (safe-area insets handled in screens), so
            keep the layout untouched and only use the provider for keyboard events. */}
        <KeyboardProvider
          statusBarTranslucent
          navigationBarTranslucent
          preserveEdgeToEdge
        >
          {/* BottomSheetModal portals into this provider — it must sit *inside*
              Auth/App so sheet content still sees those contexts. */}
          <AuthProvider>
            <AppProvider>
              <BottomSheetModalProvider>
                <RootNavigator />
                <StatusBar style="dark" />
              </BottomSheetModalProvider>
            </AppProvider>
          </AuthProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
