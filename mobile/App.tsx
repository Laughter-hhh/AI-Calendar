import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

// 网站地址：部署后改成你的服务器地址
const SITE_URL = "http://39.106.121.28:3000";

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        ref={webViewRef}
        source={{ uri: SITE_URL }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
      />

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#18181b" />
          <Text style={styles.loadingText}>正在加载 AI Calendar…</Text>
        </View>
      )}

      {failed && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>无法连接到服务器</Text>
          <Text style={styles.errorHint}>请检查网络后重试</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  webview: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
    gap: 10,
  },
  loadingText: {
    color: "#52525b",
    fontSize: 14,
  },
  errorText: {
    color: "#18181b",
    fontSize: 16,
    fontWeight: "600",
  },
  errorHint: {
    color: "#71717a",
    fontSize: 13,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: "#18181b",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
