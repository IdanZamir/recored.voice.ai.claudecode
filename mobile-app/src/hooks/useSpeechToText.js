/**
 * Speech-to-Text Hook
 *
 * Custom hook that combines audio recording with WebSocket streaming
 * to provide real-time speech-to-text functionality.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useAudioRecorder } from '@siteed/expo-audio-stream';
import { useWebSocket, ConnectionState } from './useWebSocket';

export const TranscriptionState = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  LISTENING: 'listening',
  STOPPING: 'stopping',
  ERROR: 'error',
};

/**
 * Default audio recording configuration
 * Optimized for speech recognition: 16kHz, mono, 16-bit PCM
 */
const DEFAULT_AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  encoding: 'pcm_16bit',
  interval: 250, // Stream every 250ms
};

/**
 * Custom hook for speech-to-text functionality
 * @param {string} serverUrl - WebSocket server URL
 * @param {Object} options - Configuration options
 * @returns {Object} Speech-to-text state and methods
 */
export function useSpeechToText(serverUrl, options = {}) {
  const {
    audioConfig = DEFAULT_AUDIO_CONFIG,
    onTranscript,
    onFinalTranscript,
    onError,
  } = options;

  // State
  const [state, setState] = useState(TranscriptionState.IDLE);
  const [transcripts, setTranscripts] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);

  // Refs
  const isStartingRef = useRef(false);

  // Audio recorder
  const {
    startRecording,
    stopRecording,
    isRecording,
    durationMs,
  } = useAudioRecorder({ debug: __DEV__ });

  // WebSocket handler for server messages
  const handleServerMessage = useCallback((data) => {
    if (data.type === 'transcript') {
      if (data.isFinal) {
        const transcript = {
          text: data.transcript,
          timestamp: data.timestamp,
          confidence: data.confidence,
        };
        setTranscripts((prev) => [...prev, transcript]);
        setInterimTranscript('');
        onFinalTranscript?.(transcript);
      } else {
        setInterimTranscript(data.transcript);
        onTranscript?.(data.transcript, false);
      }
    } else if (data.type === 'error') {
      setError(data.message);
      onError?.(new Error(data.message));
    }
  }, [onTranscript, onFinalTranscript, onError]);

  // WebSocket connection
  const {
    connectionState,
    connect: connectWs,
    disconnect: disconnectWs,
    send,
    sendBinary,
    isConnected,
  } = useWebSocket(serverUrl, {
    onMessage: handleServerMessage,
    onError: (err) => {
      setError('Connection failed');
      setState(TranscriptionState.ERROR);
      onError?.(err);
    },
  });

  /**
   * Starts the speech-to-text session
   */
  const start = useCallback(async () => {
    if (isStartingRef.current || state === TranscriptionState.LISTENING) {
      return;
    }

    isStartingRef.current = true;
    setError(null);

    try {
      setState(TranscriptionState.CONNECTING);

      // Connect to WebSocket server
      await connectWs();

      // Tell server to start recognition
      send({ type: 'start' });

      // Configure audio streaming
      const config = {
        ...audioConfig,
        onAudioStream: (audioData) => {
          // Stream audio to server
          sendBinary(audioData.data);
        },
      };

      // Start recording
      await startRecording(config);
      setState(TranscriptionState.LISTENING);
    } catch (err) {
      console.error('[useSpeechToText] Start error:', err);
      setState(TranscriptionState.ERROR);

      if (err.message?.includes('permission')) {
        setError('Microphone permission required');
        Alert.alert(
          'Permission Required',
          'This app needs microphone access to transcribe speech. Please enable it in Settings.',
          [{ text: 'OK' }]
        );
      } else {
        setError(err.message || 'Failed to start');
      }
      onError?.(err);
    } finally {
      isStartingRef.current = false;
    }
  }, [state, audioConfig, connectWs, send, sendBinary, startRecording, onError]);

  /**
   * Stops the speech-to-text session
   */
  const stop = useCallback(async () => {
    if (state !== TranscriptionState.LISTENING) {
      return;
    }

    try {
      setState(TranscriptionState.STOPPING);

      // Stop recording
      await stopRecording();

      // Tell server to stop
      send({ type: 'stop' });

      setInterimTranscript('');
      setState(TranscriptionState.IDLE);
    } catch (err) {
      console.error('[useSpeechToText] Stop error:', err);
      setState(TranscriptionState.IDLE);
    }
  }, [state, stopRecording, send]);

  /**
   * Toggles the speech-to-text session
   */
  const toggle = useCallback(() => {
    if (state === TranscriptionState.LISTENING) {
      stop();
    } else if (state === TranscriptionState.IDLE || state === TranscriptionState.ERROR) {
      start();
    }
  }, [state, start, stop]);

  /**
   * Clears all transcripts
   */
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setInterimTranscript('');
  }, []);

  /**
   * Gets full transcript as a single string
   */
  const getFullTranscript = useCallback(() => {
    return transcripts.map((t) => t.text).join(' ');
  }, [transcripts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
      disconnectWs();
    };
  }, [isRecording, stopRecording, disconnectWs]);

  return {
    // State
    state,
    connectionState,
    transcripts,
    interimTranscript,
    error,
    durationMs,

    // Computed
    isListening: state === TranscriptionState.LISTENING,
    isConnected,
    fullTranscript: getFullTranscript(),

    // Methods
    start,
    stop,
    toggle,
    clearTranscripts,
  };
}

export default useSpeechToText;
