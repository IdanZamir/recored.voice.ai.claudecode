/**
 * RecordButton Component
 *
 * Animated record button with visual feedback for recording state.
 * Accessible and store-compliant.
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
  Text,
  Platform,
} from 'react-native';

/**
 * RecordButton component
 * @param {Object} props
 * @param {boolean} props.isRecording - Whether currently recording
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {Function} props.onPress - Press handler
 * @param {string} props.label - Button label text
 * @param {number} props.size - Button size (default 80)
 */
export function RecordButton({
  isRecording = false,
  disabled = false,
  onPress,
  label = 'Record',
  size = 80,
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  // Scale animation on press
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const innerSize = size * 0.4;
  const borderRadius = isRecording ? innerSize * 0.15 : innerSize / 2;

  return (
    <View style={styles.container}>
      {/* Pulse ring (visible when recording) */}
      {isRecording && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size + 20,
              height: size + 20,
              borderRadius: (size + 20) / 2,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}

      {/* Main button */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: isRecording ? '#ff5252' : '#4fc3f7',
            },
            disabled && styles.buttonDisabled,
          ]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          accessibilityState={{ disabled }}
          accessibilityHint={
            isRecording
              ? 'Double tap to stop recording'
              : 'Double tap to start recording your voice'
          }
        >
          <Animated.View
            style={[
              styles.inner,
              {
                width: innerSize,
                height: innerSize,
                borderRadius,
                backgroundColor: isRecording ? '#ff5252' : '#4fc3f7',
              },
            ]}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Label */}
      {label && (
        <Text
          style={styles.label}
          accessible={true}
          accessibilityRole="text"
        >
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
  },
  button: {
    backgroundColor: '#2a2a4e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  inner: {
    // Animated styles applied inline
  },
  label: {
    marginTop: 12,
    fontSize: 14,
    color: '#9e9e9e',
    fontWeight: '500',
  },
});

export default RecordButton;
