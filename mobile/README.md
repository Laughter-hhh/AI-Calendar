# AI Calendar 手机 App（Expo / React Native）

这是 AI Calendar 的手机端 App，目前采用 **WebView 方案**：App 是一个外壳，内部加载网页版网站。优点是最快上线、不用重写业务逻辑；以后可以逐步把核心页面替换成原生界面。

## 技术栈

- [Expo](https://expo.dev)（React Native）SDK 57
- `react-native-webview` 加载网站

## 运行（开发预览，手机上看效果）

需要 Node.js 22+ 和 npm（或 pnpm）。

```bash
cd mobile
npm install
npm start
```

然后：

1. 手机上安装 **Expo Go**（iOS App Store 或安卓应用市场搜索 Expo Go）
2. 手机和电脑连**同一个 WiFi**
3. 用 Expo Go 扫终端里显示的二维码，即可打开 App

> 如果同一 WiFi 扫不出来，按终端提示按 `s` 切换到 tunnel 模式（需要 Expo 账号）。

## 打包安卓安装包（APK）

**方式 A（推荐）：Expo EAS 云端打包**（免费额度够用）

```bash
cd mobile
npx eas-cli login
npx eas-cli build -p android --profile preview
```

打包完成后会给你一个下载链接，下载 APK 安装到手机即可（首次安装需允许"未知来源"）。

**方式 B：本机打包**

安装 Android Studio + SDK 后，`npm run android` 可以直接跑到模拟器或真机。

## 修改网站地址

编辑 [App.tsx](App.tsx) 顶部的 `SITE_URL`，改成你的服务器地址后重新打包。

## 重要提醒：HTTPS

当前网站是 `http://`（非 https）。**Expo Go 预览没问题**；但打包正式 APK 时，Android 默认禁止明文 HTTP 流量，建议先给网站配上 HTTPS（域名 + 免费证书），或者用 `expo-build-properties` 插件开启 `usesCleartextTraffic`。

## 后续路线

- 登录、日程列表等核心页面逐步原生化
- 推送通知（提醒日程）
- 离线缓存
- 上架应用商店（需要开发者账号）
