module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Expo SDK 57 + babel-preset-expo auto-wires worklets when
    // react-native-reanimated / react-native-worklets are installed.
    // Keep plugins empty so the worklets plugin is not duplicated.
  };
};
