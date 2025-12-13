/**
 * WebSocket Hook
 *
 * Custom hook for managing WebSocket connections with automatic
 * reconnection and message handling.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
};

/**
 * Custom hook for WebSocket connection management
 * @param {string} url - WebSocket server URL
 * @param {Object} options - Configuration options
 * @returns {Object} WebSocket state and methods
 */
export function useWebSocket(url, options = {}) {
  const {
    autoConnect = false,
    reconnectAttempts = 3,
    reconnectInterval = 2000,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState(null);

  const wsRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  /**
   * Clears reconnection timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Establishes WebSocket connection
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      setConnectionState(ConnectionState.CONNECTING);
      clearReconnectTimeout();

      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('[useWebSocket] Connected');
          setConnectionState(ConnectionState.CONNECTED);
          reconnectCountRef.current = 0;
          wsRef.current = ws;
          onConnect?.();
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            onMessage?.(data);
          } catch (error) {
            // Handle non-JSON messages
            setLastMessage(event.data);
            onMessage?.(event.data);
          }
        };

        ws.onerror = (error) => {
          console.error('[useWebSocket] Error:', error);
          setConnectionState(ConnectionState.ERROR);
          onError?.(error);
          reject(error);
        };

        ws.onclose = (event) => {
          console.log('[useWebSocket] Closed:', event.code, event.reason);
          wsRef.current = null;
          onDisconnect?.(event);

          // Attempt reconnection if not intentionally closed
          if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
            setConnectionState(ConnectionState.RECONNECTING);
            reconnectCountRef.current++;

            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(
                `[useWebSocket] Reconnecting (${reconnectCountRef.current}/${reconnectAttempts})...`
              );
              connect();
            }, reconnectInterval);
          } else {
            setConnectionState(ConnectionState.DISCONNECTED);
          }
        };
      } catch (error) {
        console.error('[useWebSocket] Connection error:', error);
        setConnectionState(ConnectionState.ERROR);
        reject(error);
      }
    });
  }, [url, reconnectAttempts, reconnectInterval, onConnect, onMessage, onDisconnect, onError, clearReconnectTimeout]);

  /**
   * Closes WebSocket connection
   */
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectCountRef.current = reconnectAttempts; // Prevent auto-reconnect

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [reconnectAttempts, clearReconnectTimeout]);

  /**
   * Sends data through WebSocket
   * @param {*} data - Data to send (will be JSON stringified if object)
   */
  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'object' ? JSON.stringify(data) : data;
      wsRef.current.send(message);
      return true;
    }
    console.warn('[useWebSocket] Cannot send - not connected');
    return false;
  }, []);

  /**
   * Sends binary data through WebSocket
   * @param {ArrayBuffer|Uint8Array} data - Binary data to send
   */
  const sendBinary = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
      return true;
    }
    console.warn('[useWebSocket] Cannot send binary - not connected');
    return false;
  }, []);

  /**
   * Gets current WebSocket ready state
   */
  const getReadyState = useCallback(() => {
    return wsRef.current?.readyState ?? WebSocket.CLOSED;
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoConnect, connect, clearReconnectTimeout]);

  return {
    connectionState,
    lastMessage,
    connect,
    disconnect,
    send,
    sendBinary,
    getReadyState,
    isConnected: connectionState === ConnectionState.CONNECTED,
  };
}

export default useWebSocket;
