import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

const WEBSITE_URL = 'https://ackit.iotfiysolutions.com';
/** Only allow pull-to-reload if the gesture starts within this top fraction of the screen. */
const TOP_REFRESH_ZONE = 0.2;

SystemUI.setBackgroundColorAsync('#ffffff').catch(() => {});
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Mushaba-style Android system nav hide.
 * Requires edgeToEdgeEnabled: false in app.json so setBehaviorAsync works.
 */
async function setupNavigationBar() {
  if (Platform.OS !== 'android') return;
  try {
    await NavigationBar.setVisibilityAsync('hidden');
    await NavigationBar.setBehaviorAsync('overlay-swipe');
    await NavigationBar.setBackgroundColorAsync('#00000000');
  } catch {
    // Expected on iOS / Expo Go limitations.
  }
}

/**
 * Mobile WebView app only:
 * Opaque website bottom nav (no content bleed-through).
 * Do NOT inject padding-bottom — the website already reserves nav space.
 */
const BRIDGE_JS = `
(function () {
  if (window.__ackitBridgeInstalled) { true; return; }
  window.__ackitBridgeInstalled = true;

  function scrollTop() {
    var y = window.pageYOffset
      || document.documentElement.scrollTop
      || document.body.scrollTop
      || 0;
    var el = document.scrollingElement || document.documentElement;
    if (el && typeof el.scrollTop === 'number') y = Math.max(y, el.scrollTop);
    return y;
  }

  function sendScroll() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'scroll',
        y: scrollTop(),
        h: window.innerHeight || 0
      }));
    } catch (e) {}
  }

  function fixWebsiteBottomNav() {
    try {
      var nav = document.querySelector('[aria-label="Primary"], [aria-label="Mobile bottom navigation"]');
      if (!nav) return;

      nav.style.setProperty('background', '#ffffff', 'important');
      nav.style.setProperty('background-color', '#ffffff', 'important');
      nav.style.setProperty('opacity', '1', 'important');
      nav.style.setProperty('backdrop-filter', 'none', 'important');
      nav.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
      nav.style.setProperty('z-index', '9999', 'important');
    } catch (e) {}
  }

  window.addEventListener('scroll', sendScroll, { passive: true, capture: true });
  document.addEventListener('touchstart', function (e) {
    try {
      var t = e.touches && e.touches[0];
      if (!t) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'touchstart',
        y: t.clientY,
        h: window.innerHeight || 0,
        scrollY: scrollTop()
      }));
    } catch (err) {}
  }, { passive: true, capture: true });

  fixWebsiteBottomNav();
  setInterval(fixWebsiteBottomNav, 1000);
  sendScroll();
  true;
})();
`;

function AppContent() {
  const webRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const initialDoneRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [atPageTop, setAtPageTop] = useState(true);
  const [touchInTopZone, setTouchInTopZone] = useState(true);
  const [layoutH, setLayoutH] = useState(0);

  const refreshEnabled = atPageTop && touchInTopZone;

  useEffect(() => {
    setupNavigationBar();

    const sub = AppState.addEventListener('change', (next) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        setTimeout(() => setupNavigationBar(), 100);
      }
      appState.current = next;
    });

    const interval = setInterval(() => {
      setupNavigationBar();
    }, 2000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  const finishInitialLoad = useCallback(() => {
    if (initialDoneRef.current) return;
    initialDoneRef.current = true;
    setRefreshing(false);
    setupNavigationBar();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleWebViewError = useCallback(() => {
    finishInitialLoad();
  }, [finishInitialLoad]);

  const onRefresh = useCallback(() => {
    if (!refreshEnabled) return;
    setRefreshing(true);
    webRef.current?.reload();
  }, [refreshEnabled]);

  const onLayout = useCallback((e) => {
    setLayoutH(e.nativeEvent.layout.height);
  }, []);

  const onStartShouldSetResponderCapture = useCallback(
    (evt) => {
      if (layoutH > 0) {
        const y = evt.nativeEvent.locationY;
        setTouchInTopZone(y <= layoutH * TOP_REFRESH_ZONE);
      }
      return false;
    },
    [layoutH]
  );

  const onWebMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'scroll') {
          setAtPageTop(Number(data.y) <= 2);
        } else if (data.type === 'touchstart') {
          const h = Number(data.h) || layoutH || 1;
          const y = Number(data.y) || 0;
          setTouchInTopZone(y <= h * TOP_REFRESH_ZONE);
          if (typeof data.scrollY === 'number') {
            setAtPageTop(data.scrollY <= 2);
          }
        }
      } catch {
        // ignore non-JSON messages from the page
      }
    },
    [layoutH]
  );

  const onWebScroll = useCallback((event) => {
    const y = Number(event?.nativeEvent?.contentOffset?.y ?? 0);
    setAtPageTop(y <= 2);
  }, []);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        enabled={refreshEnabled}
        colors={['#2563eb']}
        tintColor="#2563eb"
      />
    ),
    [refreshing, onRefresh, refreshEnabled]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View
        style={styles.container}
        onLayout={onLayout}
        onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}
          bounces
          overScrollMode="always"
        >
          <WebView
            ref={webRef}
            source={{ uri: WEBSITE_URL }}
            style={styles.webview}
            onLoadEnd={() => {
              finishInitialLoad();
              setRefreshing(false);
              setupNavigationBar();
            }}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress >= 1) {
                finishInitialLoad();
                setRefreshing(false);
              }
            }}
            onError={handleWebViewError}
            onHttpError={handleWebViewError}
            onScroll={onWebScroll}
            onMessage={onWebMessage}
            injectedJavaScript={BRIDGE_JS}
            startInLoadingState={false}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
            originWhitelist={['https://*', 'http://*']}
            pullToRefreshEnabled={false}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
