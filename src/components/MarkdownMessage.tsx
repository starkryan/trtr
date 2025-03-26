import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface MarkdownMessageProps {
  text: string;
  isUser: boolean;
}

// Function to detect if text contains Hindi characters
const containsHindi = (text: string): boolean => {
  // Hindi Unicode range: \u0900-\u097F
  return /[\u0900-\u097F]/.test(text);
};

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ text, isUser }) => {
  // Check if the message contains Hindi
  const hasHindi = containsHindi(text);
  
  // Use custom rendering for Hindi content
  if (hasHindi) {
    return (
      <View style={styles.container}>
        <Text style={{
          color: '#fff',
          fontSize: 16,
          lineHeight: 22,
          fontWeight: '400',
          // Add better font support for Hindi on different platforms
          fontFamily: Platform.select({
            ios: 'System',
            android: 'Roboto',
            default: 'System'
          }),
        }}>
          {text}
        </Text>
      </View>
    );
  }
  
  // For non-Hindi, use Markdown
  const markdownStyles = {
    body: {
      color: '#fff',
      fontSize: 16,
    },
    paragraph: {
      marginVertical: 0,
      color: '#fff',
      fontSize: 16,
    },
    em: {
      color: isUser ? '#fff' : '#22C55E',
      fontStyle: 'italic',
    },
    strong: {
      color: isUser ? '#fff' : '#FF69B4',
      fontWeight: 'bold',
    },
    link: {
      color: '#60A5FA',
    },
    list: {
      color: '#fff',
    },
    listItem: {
      color: '#fff',
    },
    blockquote: {
      borderLeftColor: isUser ? '#fff' : '#22C55E',
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginVertical: 5,
    },
    code_inline: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      color: isUser ? '#fff' : '#22C55E',
      padding: 3,
      borderRadius: 3,
    },
    code_block: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: 10,
      borderRadius: 5,
      marginVertical: 5,
    },
    fence: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: 10,
      borderRadius: 5,
      marginVertical: 5,
    },
    hr: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      height: 1,
      marginVertical: 10,
    },
  };

  return (
    <View style={styles.container}>
      <Markdown style={markdownStyles as any}>{text}</Markdown>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MarkdownMessage; 