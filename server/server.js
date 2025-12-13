/**
 * Speech-to-Text WebSocket Server
 *
 * Handles real-time audio streaming from mobile clients and processes
 * through Google Cloud Speech-to-Text API using gRPC streaming.
 */

require('dotenv').config();
const { WebSocketServer, WebSocket } = require('ws');
const speech = require('@google-cloud/speech');

// Configuration
const PORT = process.env.PORT || 8080;
const SPEECH_CONFIG = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: process.env.LANGUAGE_CODE || 'en-US',
    model: 'command_and_search', // Optimized for short queries, fastest response
    enableAutomaticPunctuation: true,
    useEnhanced: true,
  },
  interimResults: true, // Send results before audio stream ends
};

// Initialize Google Cloud Speech client
// Assumes GOOGLE_APPLICATION_CREDENTIALS env var is set
const speechClient = new speech.SpeechClient();

// Create WebSocket server
const wss = new WebSocketServer({
  port: PORT,
  perMessageDeflate: false, // Disable compression for lower latency
});

console.log(`[Server] WebSocket server starting on port ${PORT}...`);

/**
 * Handles incoming WebSocket connections
 */
wss.on('connection', (ws, req) => {
  const clientId = `client-${Date.now()}`;
  console.log(`[${clientId}] New connection from ${req.socket.remoteAddress}`);

  let recognizeStream = null;
  let isStreamActive = false;
  let streamRestartTimeout = null;

  /**
   * Creates a new Google Speech streaming recognition stream
   */
  const startRecognitionStream = () => {
    if (recognizeStream) {
      recognizeStream.end();
    }

    isStreamActive = true;

    recognizeStream = speechClient
      .streamingRecognize(SPEECH_CONFIG)
      .on('error', (error) => {
        console.error(`[${clientId}] Speech API Error:`, error.message);

        // Handle specific error codes
        if (error.code === 11) {
          // Stream duration exceeded - restart stream
          console.log(`[${clientId}] Stream timeout, restarting...`);
          restartStream();
        } else {
          sendToClient({
            type: 'error',
            message: error.message,
            code: error.code,
          });
        }
      })
      .on('data', (data) => {
        if (data.results && data.results[0]) {
          const result = data.results[0];
          const transcript = result.alternatives[0]?.transcript || '';
          const isFinal = result.isFinal;

          console.log(`[${clientId}] ${isFinal ? 'Final' : 'Interim'}: "${transcript}"`);

          sendToClient({
            type: 'transcript',
            transcript,
            isFinal,
            confidence: result.alternatives[0]?.confidence || 0,
            timestamp: Date.now(),
          });

          // If final result, restart stream to prevent timeout
          if (isFinal) {
            scheduleStreamRestart();
          }
        }
      })
      .on('end', () => {
        console.log(`[${clientId}] Recognition stream ended`);
        isStreamActive = false;
      });

    console.log(`[${clientId}] Recognition stream started`);
  };

  /**
   * Schedules a stream restart to handle Google's 305-second limit
   */
  const scheduleStreamRestart = () => {
    if (streamRestartTimeout) {
      clearTimeout(streamRestartTimeout);
    }

    // Restart stream after 290 seconds (before the 305s limit)
    streamRestartTimeout = setTimeout(() => {
      if (isStreamActive) {
        console.log(`[${clientId}] Scheduled stream restart`);
        restartStream();
      }
    }, 290000);
  };

  /**
   * Restarts the recognition stream
   */
  const restartStream = () => {
    if (recognizeStream) {
      recognizeStream.end();
    }
    startRecognitionStream();
  };

  /**
   * Sends a message to the WebSocket client
   */
  const sendToClient = (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  /**
   * Handles incoming messages from the client
   */
  ws.on('message', (message, isBinary) => {
    try {
      // Check if message is a control message (JSON)
      if (!isBinary) {
        const textMessage = message.toString();

        // Try parsing as JSON control message
        try {
          const controlMessage = JSON.parse(textMessage);
          handleControlMessage(controlMessage);
          return;
        } catch {
          // Not JSON, might be base64 audio
          if (isBase64(textMessage)) {
            const audioBuffer = Buffer.from(textMessage, 'base64');
            writeAudioToStream(audioBuffer);
            return;
          }
        }
      }

      // Binary audio data
      if (isBinary) {
        writeAudioToStream(message);
      }
    } catch (error) {
      console.error(`[${clientId}] Error processing message:`, error.message);
    }
  });

  /**
   * Handles control messages from the client
   */
  const handleControlMessage = (message) => {
    console.log(`[${clientId}] Control message:`, message.type);

    switch (message.type) {
      case 'start':
        startRecognitionStream();
        sendToClient({ type: 'status', status: 'streaming' });
        break;

      case 'stop':
        if (recognizeStream) {
          recognizeStream.end();
          isStreamActive = false;
        }
        if (streamRestartTimeout) {
          clearTimeout(streamRestartTimeout);
        }
        sendToClient({ type: 'status', status: 'stopped' });
        break;

      case 'ping':
        sendToClient({ type: 'pong', timestamp: Date.now() });
        break;

      default:
        console.log(`[${clientId}] Unknown control message:`, message.type);
    }
  };

  /**
   * Writes audio data to the recognition stream
   */
  const writeAudioToStream = (audioBuffer) => {
    if (recognizeStream && isStreamActive) {
      recognizeStream.write(audioBuffer);
    } else {
      console.log(`[${clientId}] Received audio but stream not active`);
    }
  };

  /**
   * Checks if a string is valid base64
   */
  const isBase64 = (str) => {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch {
      return false;
    }
  };

  /**
   * Handle WebSocket close
   */
  ws.on('close', (code, reason) => {
    console.log(`[${clientId}] Connection closed: ${code} - ${reason}`);

    if (recognizeStream) {
      recognizeStream.end();
    }
    if (streamRestartTimeout) {
      clearTimeout(streamRestartTimeout);
    }
    isStreamActive = false;
  });

  /**
   * Handle WebSocket errors
   */
  ws.on('error', (error) => {
    console.error(`[${clientId}] WebSocket error:`, error.message);
  });

  // Send initial connection confirmation
  sendToClient({
    type: 'connected',
    clientId,
    timestamp: Date.now(),
    config: {
      sampleRate: SPEECH_CONFIG.config.sampleRateHertz,
      encoding: SPEECH_CONFIG.config.encoding,
    },
  });
});

// Handle server errors
wss.on('error', (error) => {
  console.error('[Server] Error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  wss.clients.forEach((client) => {
    client.close(1001, 'Server shutting down');
  });
  wss.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});

console.log(`[Server] Ready and listening on ws://localhost:${PORT}`);
