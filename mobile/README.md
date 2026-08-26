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

### 方式 A（推荐）：Expo EAS 云端打包 —— 生成可直接下载安装的 APK

首次使用需要注册 Expo 账号：https://expo.dev/signup（免费）。

```bash
cd mobile
npx eas-cli login            # 用 Expo 账号登录（首次会要求安装 eas-cli）
npx eas-cli build -p android --profile preview
```

构建完成后，EAS 会输出一个 **APK 下载链接**（免费额度内可用）。把 APK 下载后放到服务器即可通过网页分发：

```bash
# 在服务器上（/opt/ai-calendar/downloads 目录）
mkdir -p /opt/ai-calendar/downloads
mv ai-calendar.apk /opt/ai-calendar/downloads/ai-calendar.apk
```

然后访问 http://39.106.121.28:3000/download 就能直接下载安装。

> EAS 免费额度：安卓构建有每月免费次数（约 30 次），个人测试足够。

### 方式 B：上架 Google Play 用（AAB 格式）

```bash
cd mobile
npx eas-cli build -p android --profile production
```

生产构建产出 AAB 文件，用于上传 Google Play。

### 方式 C：本机打包

安装 Android Studio + JDK + Android SDK 后，`npm run android` 可以直接跑到模拟器或真机；`npx expo run:android --variant release` 可生成本地 release APK。

## 修改网站地址

编辑 [App.tsx](App.tsx) 顶部的 `SITE_URL`，改成你的服务器地址后重新打包。

## 重要提醒：HTTPS

当前网站是 `http://`（非 https）。本项目已通过 `expo-build-properties` 插件开启 `usesCleartextTraffic`，因此**独立 APK 可以直接加载 http 网站**。上架商店前仍建议升级 HTTPS（商店审核更友好）。

## 版本与更新

- `eas.json` 已配置 `autoIncrement`：每次构建版本号自动 +1
- App 是网页容器：**网站功能更新不需要重新安装 App**；只有改壳（图标、名称、原生能力）时才需要重新构建发布

## 后续路线

- 登录、日程列表等核心页面逐步原生化
- 推送通知（提醒日程）
- 离线缓存
- 上架应用商店（需要开发者账号）
