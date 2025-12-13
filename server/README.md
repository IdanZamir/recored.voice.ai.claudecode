# Speech-to-Text Server

WebSocket server for real-time speech-to-text using Google Cloud Speech API.

## Quick Start

```bash
# Install dependencies
npm install

# Set Google credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Start server
npm start
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | WebSocket server port |
| `GOOGLE_APPLICATION_CREDENTIALS` | - | Path to Google Cloud service account JSON |
| `LANGUAGE_CODE` | en-US | Speech recognition language |

## Google Cloud Setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable "Cloud Speech-to-Text API"
3. Create a service account with "Cloud Speech Client" role
4. Download the JSON key file
5. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
