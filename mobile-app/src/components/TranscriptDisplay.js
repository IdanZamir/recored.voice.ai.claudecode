/**
 * TranscriptDisplay Component
 *
 * Displays real-time transcription results with interim and final text.
 * Auto-scrolls to show latest content.
 */

import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

/**
 * TranscriptDisplay component
 * @param {Object} props
 * @param {Array} props.transcripts - Array of final transcripts
 * @param {string} props.interimTranscript - Current interim transcript
 * @param {Function} props.onClear - Clear button handler
 * @param {string} props.placeholder - Placeholder text when empty
 */
export function TranscriptDisplay({
  transcripts = [],
  interimTranscript = '',
  onClear,
  placeholder = 'Start speaking to see transcription...',
}) {
  const scrollViewRef = useRef(null);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollViewRef.current && (transcripts.length > 0 || interimTranscript)) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [transcripts, interimTranscript]);

  const isEmpty = transcripts.length === 0 && !interimTranscript;
  const showClear = transcripts.length > 0 && onClear;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transcription</Text>
        {showClear && (
          <TouchableOpacity
            onPress={onClear}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Clear transcription"
          >
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isEmpty && styles.contentEmpty,
        ]}
        showsVerticalScrollIndicator={true}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="Transcription text"
      >
        {isEmpty ? (
          <Text style={styles.placeholder}>{placeholder}</Text>
        ) : (
          <>
            {/* Final transcripts */}
            {transcripts.map((item, index) => (
              <TranscriptItem
                key={`${item.timestamp}-${index}`}
                text={item.text}
                confidence={item.confidence}
                isFinal={true}
              />
            ))}

            {/* Interim transcript */}
            {interimTranscript && (
              <TranscriptItem
                text={interimTranscript}
                isFinal={false}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Individual transcript item
 */
function TranscriptItem({ text, confidence, isFinal }) {
  return (
    <Text
      style={[
        styles.transcriptText,
        isFinal ? styles.finalText : styles.interimText,
      ]}
    >
      {text}
      {isFinal && confidence !== undefined && confidence > 0 && (
        <Text style={styles.confidenceText}>
          {' '}({Math.round(confidence * 100)}%)
        </Text>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  clearButton: {
    fontSize: 14,
    color: '#4fc3f7',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  contentEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 8,
  },
  finalText: {
    color: '#ffffff',
  },
  interimText: {
    color: '#9e9e9e',
    fontStyle: 'italic',
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
  },
});

export default TranscriptDisplay;
