/**
 * Speech-to-Text Mobile Application
 *
 * Real-time audio streaming and transcription app for iOS and Android.
 * Store-compliant with proper permission handling and safe area support.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useAudioRecorder,
  AudioRecording,
  RecordingConfig,
} from '@siteed/expo-audio-stream';

// Configuration
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8080';

// Connection states
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
};

// Recording states
const RecordingState = {
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  RECORDING: 'recording',
  STOPPING: 'stopping',
};

export default function App() {
  // State management
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [recordingState, setRecordingState] = useState(RecordingState.IDLE);
  const [transcripts, setTranscripts] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  // Refs
  const wsRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Audio recorder hook from @siteed/expo-audio-stream
  const {
    startRecording,
    stopRecording,
    isRecording,
    durationMs,
  } = useAudioRecorder({
    debug: __DEV__,
  });

  /**
   * Establishes WebSocket connection to the server
   */
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      setConnectionState(ConnectionState.CONNECTING);
      setErrorMessage(null);

      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnectionState(ConnectionState.CONNECTED);
        wsRef.current = ws;
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setConnectionState(ConnectionState.ERROR);
        setErrorMessage('Connection failed. Check server status.');
        reject(error);
      };

      ws.onclose = (event) => {
        console.log('[WS] Closed:', event.code);
        setConnectionState(ConnectionState.DISCONNECTED);
        wsRef.current = null;

        // If recording was in progress, stop it
        if (isRecording) {
          handleStopRecording();
        }
      };
    });
  }, [isRecording]);

  /**
   * Handles messages from the server
   */
  const handleServerMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected':
        console.log('[Server] Connected as:', data.clientId);
        break;

      case 'status':
        console.log('[Server] Status:', data.status);
        break;

      case 'transcript':
        if (data.isFinal) {
          // Add to permanent transcripts
          setTranscripts((prev) => [
            ...prev,
            {
              text: data.transcript,
              timestamp: data.timestamp,
              confidence: data.confidence,
            },
          ]);
          setInterimTranscript('');
        } else {
          // Show interim result
          setInterimTranscript(data.transcript);
        }
        break;

      case 'error':
        console.error('[Server] Error:', data.message);
        setErrorMessage(data.message);
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('[Server] Unknown message:', data.type);
    }
  }, []);

  /**
   * Sends a control message to the server
   */
  const sendControlMessage = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  /**
   * Sends audio data to the server
   */
  const sendAudioData = useCallback((audioData) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send as binary or base64 depending on data format
      if (audioData instanceof ArrayBuffer || audioData instanceof Uint8Array) {
        wsRef.current.send(audioData);
      } else if (typeof audioData === 'string') {
        // Assume base64
        wsRef.current.send(audioData);
      }
    }
  }, []);

  /**
   * Handles the start recording action
   */
  const handleStartRecording = async () => {
    try {
      setRecordingState(RecordingState.REQUESTING_PERMISSION);
      setErrorMessage(null);

      // Connect to WebSocket first
      await connectWebSocket();

      // Tell server we're starting
      sendControlMessage('start');

      // Recording configuration - 16kHz, mono, 16-bit PCM
      const config = {
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 250, // Send chunks every 250ms for real-time streaming
        onAudioStream: (audioData) => {
          // Stream audio data to server
          sendAudioData(audioData.data);
        },
      };

      await startRecording(config);
      setRecordingState(RecordingState.RECORDING);
    } catch (error) {
      console.error('[Recording] Start error:', error);
      setRecordingState(RecordingState.IDLE);

      if (error.message?.includes('permission')) {
        setErrorMessage('Microphone permission denied. Please enable it in Settings.');
        Alert.alert(
          'Permission Required',
          'This app needs microphone access to transcribe speech. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
      } else {
        setErrorMessage(error.message || 'Failed to start recording');
      }
    }
  };

  /**
   * Handles the stop recording action
   */
  const handleStopRecording = async () => {
    try {
      setRecordingState(RecordingState.STOPPING);

      await stopRecording();

      // Tell server we're stopping
      sendControlMessage('stop');

      setRecordingState(RecordingState.IDLE);
      setInterimTranscript('');
    } catch (error) {
      console.error('[Recording] Stop error:', error);
      setRecordingState(RecordingState.IDLE);
    }
  };

  /**
   * Toggles recording state
   */
  const handleToggleRecording = () => {
    if (recordingState === RecordingState.RECORDING) {
      handleStopRecording();
    } else if (recordingState === RecordingState.IDLE) {
      handleStartRecording();
    }
  };

  /**
   * Clears all transcripts
   */
  const handleClearTranscripts = () => {
    setTranscripts([]);
    setInterimTranscript('');
  };

  /**
   * Auto-scroll to bottom when new transcripts arrive
   */
  useEffect(() => {
    if (scrollViewRef.current && (transcripts.length > 0 || interimTranscript)) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [transcripts, interimTranscript]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  /**
   * Formats duration in MM:SS
   */
  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Gets the status indicator color
   */
  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return '#00c853';
      case ConnectionState.CONNECTING:
        return '#ffc107';
      case ConnectionState.ERROR:
        return '#ff5252';
      default:
        return '#9e9e9e';
    }
  };

  /**
   * Gets button text based on current state
   */
  const getButtonText = () => {
    switch (recordingState) {
      case RecordingState.REQUESTING_PERMISSION:
        return 'Requesting Permission...';
      case RecordingState.RECORDING:
        return 'Stop Recording';
      case RecordingState.STOPPING:
        return 'Stopping...';
      default:
        return 'Start Recording';
    }
  };

  const isButtonDisabled =
    recordingState === RecordingState.REQUESTING_PERMISSION ||
    recordingState === RecordingState.STOPPING;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Speech to Text</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>
              {connectionState === ConnectionState.CONNECTED
                ? 'Connected'
                : connectionState === ConnectionState.CONNECTING
                ? 'Connecting...'
                : connectionState === ConnectionState.ERROR
                ? 'Error'
                : 'Disconnected'}
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Transcript Display */}
        <View style={styles.transcriptContainer}>
          <View style={styles.transcriptHeader}>
            <Text style={styles.transcriptTitle}>Transcription</Text>
            {transcripts.length > 0 && (
              <TouchableOpacity onPress={handleClearTranscripts}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptContent}
          >
            {transcripts.length === 0 && !interimTranscript ? (
              <Text style={styles.placeholderText}>
                Tap the record button and start speaking...
              </Text>
            ) : (
              <>
                {transcripts.map((item, index) => (
                  <Text key={index} style={styles.finalTranscript}>
                    {item.text}
                  </Text>
                ))}
                {interimTranscript && (
                  <Text style={styles.interimTranscript}>{interimTranscript}</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {/* Recording Duration */}
        {recordingState === RecordingState.RECORDING && (
          <View style={styles.durationContainer}>
            <View style={styles.recordingIndicator} />
            <Text style={styles.durationText}>{formatDuration(durationMs)}</Text>
          </View>
        )}

        {/* Record Button */}
        <SafeAreaView edges={['bottom']} style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              recordingState === RecordingState.RECORDING && styles.recordButtonActive,
              isButtonDisabled && styles.recordButtonDisabled,
            ]}
            onPress={handleToggleRecording}
            disabled={isButtonDisabled}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.recordButtonInner,
                recordingState === RecordingState.RECORDING && styles.recordButtonInnerActive,
              ]}
            />
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>{getButtonText()}</Text>
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#9e9e9e',
  },
  errorContainer: {
    backgroundColor: '#ff525220',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ff5252',
  },
  errorText: {
    color: '#ff5252',
    fontSize: 14,
    textAlign: 'center',
  },
  transcriptContainer: {
    flex: 1,
    margin: 20,
    backgroundColor: '#16213e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  transcriptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  clearButton: {
    fontSize: 14,
    color: '#4fc3f7',
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: 16,
    flexGrow: 1,
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  finalTranscript: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 8,
  },
  interimTranscript: {
    color: '#9e9e9e',
    fontSize: 18,
    lineHeight: 28,
    fontStyle: 'italic',
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff5252',
    marginRight: 8,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  buttonContainer: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 24 : 0,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a4e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#4fc3f7',
  },
  recordButtonActive: {
    borderColor: '#ff5252',
  },
  recordButtonDisabled: {
    opacity: 0.5,
  },
  recordButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4fc3f7',
  },
  recordButtonInnerActive: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#ff5252',
  },
  buttonLabel: {
    color: '#9e9e9e',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 8,
  },
});
