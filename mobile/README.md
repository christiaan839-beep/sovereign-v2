# Sovereign Matrix — Mobile App

React Native / Expo app for running AI agents from your phone.

## Setup

```bash
cd mobile
npx create-expo-app@latest sovereign-mobile --template tabs
cd sovereign-mobile
npx expo start
```

## Architecture

The mobile app is a thin client that calls the existing API:
- `POST /api/v1/agents/{name}` — Run any agent (API key auth)
- `GET /api/_misc/usage` — Usage dashboard
- `GET /api/_misc/inbox` — Agent activity feed
- `POST /api/free/run` — Free tool proxy (no auth needed)
- `POST /api/_webhooks/zapier` — Automation triggers

## Screens

1. **Home** — Quick launch solutions (Lead Pipeline, Content Engine, etc.)
2. **Chat** — Streaming chat with agent selection (connects to /api/ai/stream)
3. **Results** — Agent execution history with replay
4. **Settings** — API keys, notifications, plan management

## Push Notifications

Uses Expo Push Notifications + the existing notify.ts webhook system:
- Agent completion → push notification
- Budget alerts → push notification
- HITL approval requests → push notification with approve/deny actions

## Key Dependencies

```json
{
  "expo": "~52.0.0",
  "react-native": "0.76",
  "@react-navigation/native": "^7.0",
  "expo-secure-store": "~14.0",
  "expo-notifications": "~0.29"
}
```

## API Key Storage

Uses `expo-secure-store` for encrypted API key storage on device.
Never stores keys in AsyncStorage or plain text.

## Offline Mode

Agents require network connectivity (they call AI models).
The app caches recent results for offline viewing.
