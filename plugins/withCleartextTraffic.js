/**
 * Expo config plugin: allow plain HTTP (cleartext) in the RELEASE manifest.
 *
 * WHY: the AC Kit SoftAP is http://192.168.4.1 (no TLS on the ESP). Android 9+
 * blocks cleartext by default in release builds. `android.usesCleartextTraffic`
 * inside app.json is NOT a real Expo field (prebuild silently ignores it), and
 * `/android` is git-ignored, so EAS regenerates the native project from
 * app.json on every build — any hand edits under /android never reach EAS.
 * Debug builds only worked because Android's *debug* manifest overlay enables
 * cleartext (needed for Metro).
 *
 * This plugin runs on every prebuild (local + EAS) and writes
 * android:usesCleartextTraffic="true" into the main manifest.
 * The cloud API / MQTT host remain HTTPS / raw TCP and are unaffected.
 */
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults?.manifest?.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$['android:usesCleartextTraffic'] = 'true';
      // Never let a stray networkSecurityConfig override the flag above.
      delete app.$['android:networkSecurityConfig'];
    }
    return cfg;
  });
};
