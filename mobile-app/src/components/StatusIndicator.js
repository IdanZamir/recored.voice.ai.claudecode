/**
 * StatusIndicator Component
 *
 * Visual indicator for connection and recording status.
 */

import React from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import { ConnectionState } from '../hooks/useWebSocket';

/**
 * Status indicator with colored dot
 * @param {Object} props
 * @param {string} props.connectionState - Current connection state
 * @param {boolean} props.isRecording - Whether currently recording
 * @param {number} props.durationMs - Recording duration in milliseconds
 */
export function StatusIndicator({
  connectionState = ConnectionState.DISCONNECTED,
  isRecording = false,
  durationMs = 0,
}) {
  /**
   * Gets status color based on state
   */
  const getStatusColor = () => {
    if (isRecording) return '#ff5252';

    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return '#00c853';
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return '#ffc107';
      case ConnectionState.ERROR:
        return '#ff5252';
      default:
        return '#9e9e9e';
    }
  };

  /**
   * Gets status text based on state
   */
  const getStatusText = () => {
    if (isRecording) {
      return `Recording ${formatDuration(durationMs)}`;
    }

    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return 'Connected';
      case ConnectionState.CONNECTING:
        return 'Connecting...';
      case ConnectionState.RECONNECTING:
        return 'Reconnecting...';
      case ConnectionState.ERROR:
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };

  /**
   * Formats duration in MM:SS format
   */
  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const statusColor = getStatusColor();

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${getStatusText()}`}
    >
      <View style={[styles.dot, { backgroundColor: statusColor }]}>
        {isRecording && <View style={styles.pulseDot} />}
      </View>
      <Text style={[styles.text, { color: statusColor }]}>
        {getStatusText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    position: 'relative',
  },
  pulseDot: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 82, 82, 0.3)',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default StatusIndicator;
