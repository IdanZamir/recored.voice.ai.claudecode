# Speech-to-Text Application

A high-performance, real-time speech-to-text application with a Node.js backend and React Native (Expo) mobile app. Designed for Apple App Store and Google Play Store compliance.

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     gRPC      ┌─────────────────┐
│   Mobile App    │ ◄──────────────► │   Node.js       │ ◄──────────► │  Google Cloud   │
│   (Expo/RN)     │    Audio/Text    │   Server        │   Streaming  │  Speech-to-Text │
└─────────────────┘                   └─────────────────┘              └─────────────────┘
```

## Project Structure

```
├── server/                 # Node.js backend
│   ├── package.json
│   ├── server.js          # WebSocket + Google Speech server
│   └── .env.example
│
├── mobile-app/            # Expo React Native app
│   ├── package.json
│   ├── app.json           # Expo config (store-compliant)
│   ├── eas.json           # EAS Build config
│   ├── App.js             # Main application
│   ├── babel.config.js
│   ├── src/
│   │   ├── components/    # UI components
│   │   │   ├── RecordButton.js
│   │   │   ├── TranscriptDisplay.js
│   │   │   └── StatusIndicator.js
│   │   └── hooks/         # Custom hooks
│   │       ├── useWebSocket.js
│   │       └── useSpeechToText.js
│   └── assets/            # App icons and splash screens
│
└── README.md
```

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Google Cloud account with Speech-to-Text API enabled
- Xcode (for iOS development)
- Android Studio (for Android development)

## Server Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Google Cloud Credentials

1. Create a Google Cloud project
2. Enable the Speech-to-Text API
3. Create a service account and download the JSON key
4. Set the environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account.json
```

Or create a `.env` file:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start on `ws://localhost:8080`

## Mobile App Setup

### 1. Install Dependencies

```bash
cd mobile-app
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your server URL
```

For local development with a physical device, use your computer's IP address:
```
EXPO_PUBLIC_WS_URL=ws://192.168.1.100:8080
```

### 3. Add App Assets

Replace placeholder files in `assets/` with your actual images:
- `icon.png` - 1024x1024 app icon
- `splash.png` - 1284x2778 splash screen
- `adaptive-icon.png` - 1024x1024 Android adaptive icon
- `favicon.png` - 48x48 web favicon

### 4. Development Build

This app requires a development build due to native audio streaming:

```bash
# Install Expo Dev Client
npx expo install expo-dev-client

# Create development build
npx expo prebuild

# iOS (requires Mac)
npx expo run:ios

# Android
npx expo run:android
```

### 5. EAS Build (for Store Submission)

```bash
# Login to Expo
eas login

# Configure your project
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

## Store Compliance Features

This project includes configurations required for App Store and Play Store approval:

### iOS (App Store)
- ✅ `NSMicrophoneUsageDescription` - Clear microphone permission message
- ✅ `UIBackgroundModes` configured (empty, no background audio needed)
- ✅ Minimum iOS 14.0 deployment target
- ✅ Safe area handling for notch devices

### Android (Play Store)
- ✅ `RECORD_AUDIO` permission declared
- ✅ `INTERNET` permission declared
- ✅ Minimum SDK 24 (Android 7.0)
- ✅ Target SDK 34 (Android 14)
- ✅ Adaptive icon support

## API Documentation

### WebSocket Protocol

#### Client → Server

**Start Recording:**
```json
{ "type": "start" }
```

**Stop Recording:**
```json
{ "type": "stop" }
```

**Audio Data:**
- Send binary PCM data directly, or
- Send base64-encoded audio string

#### Server → Client

**Connected:**
```json
{
  "type": "connected",
  "clientId": "client-123456",
  "timestamp": 1699999999999,
  "config": {
    "sampleRate": 16000,
    "encoding": "LINEAR16"
  }
}
```

**Transcript:**
```json
{
  "type": "transcript",
  "transcript": "hello world",
  "isFinal": true,
  "confidence": 0.95,
  "timestamp": 1699999999999
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description",
  "code": 11
}
```

## Audio Configuration

The app is configured for optimal speech recognition:

| Setting | Value | Reason |
|---------|-------|--------|
| Sample Rate | 16000 Hz | Google Speech-to-Text optimal rate |
| Channels | 1 (Mono) | Speech recognition doesn't need stereo |
| Encoding | LINEAR16 (PCM) | Uncompressed for best quality |
| Chunk Interval | 250ms | Balance between latency and network efficiency |

## Troubleshooting

### Server Issues

**"Could not load the default credentials"**
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- Verify the service account JSON file exists and is readable

**WebSocket connection refused**
- Check if the server is running
- Verify firewall allows port 8080
- For mobile devices, use computer's IP instead of localhost

### Mobile App Issues

**"Microphone permission denied"**
- On iOS: Settings → Privacy → Microphone → Enable for app
- On Android: Settings → Apps → [App] → Permissions → Microphone

**"Development build required"**
- This app uses native modules and cannot run in Expo Go
- Create a development build with `npx expo run:ios` or `npx expo run:android`

**Audio not streaming**
- Check WebSocket connection status
- Verify server is running and reachable
- Check device network connectivity

## License

MIT
