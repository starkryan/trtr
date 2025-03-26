import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { adUnitIds } from '../../services/AdMobService';

interface NativeAdComponentProps {
  containerStyle?: object;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: Error) => void;
}

/**
 * A reusable Native Ad component 
 * Note: The implementation is simplified due to compatibility issues with the current library version
 */
const NativeAdComponent: React.FC<NativeAdComponentProps> = ({ 
  containerStyle = {},
  onAdLoaded,
  onAdFailedToLoad
}) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hideAdSpace, setHideAdSpace] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  
  const MAX_RETRY_ATTEMPTS = 2;

  useEffect(() => {
    // Simulate ad loading with potential errors
    const loadAd = () => {
      const timer = setTimeout(() => {
        // In a real implementation, we'd handle actual ad loading here
        // This is placeholder logic to simulate the behavior
        if (Math.random() > 0.3) {
          console.log('Native ad loaded successfully');
          setAdLoaded(true);
          if (onAdLoaded) onAdLoaded();
        } else {
          const mockError = new Error('Error loading ad: no-fill');
          console.error('Native ad failed to load:', mockError);
          
          if (retryAttempts < MAX_RETRY_ATTEMPTS) {
            setRetryAttempts(prev => prev + 1);
            // Retry with exponential backoff
            const retryDelay = Math.pow(2, retryAttempts) * 1000;
            console.log(`Will retry native ad in ${retryDelay}ms (attempt ${retryAttempts + 1}/${MAX_RETRY_ATTEMPTS})`);
            loadAd(); // Recursive call to retry
          } else {
            setHideAdSpace(true);
            setError(mockError);
            if (onAdFailedToLoad) onAdFailedToLoad(mockError);
          }
        }
      }, 1000); // Simulate network delay
      
      return () => clearTimeout(timer);
    };
    
    if (!adLoaded && !hideAdSpace) {
      return loadAd();
    }
  }, [retryAttempts]);

  // Don't show ads on platforms other than Android in this app
  if (Platform.OS !== 'android' || hideAdSpace) {
    return null;
  }

  if (!adLoaded) {
    // Return a placeholder while loading
    return (
      <View style={[styles.container, containerStyle, styles.placeholder]}>
        <Text style={styles.placeholderText}>Loading ad...</Text>
      </View>
    );
  }

  // Render a simplified native ad 
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.adContent}>
        <View style={styles.adHeader}>
          <View style={styles.adIconPlaceholder} />
          <View style={styles.adHeaderText}>
            <Text style={styles.adTitle}>Ad Title</Text>
            <Text style={styles.adAdvertiser}>Advertiser</Text>
          </View>
        </View>
        <Text style={styles.adBody}>
          This is a placeholder for a native ad. In a real implementation, this would show actual ad content from Google AdMob.
        </Text>
        <View style={styles.ctaButton}>
          <Text style={styles.ctaText}>Learn More</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    overflow: 'hidden',
  },
  placeholder: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  adContent: {
    padding: 16,
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 12,
  },
  adHeaderText: {
    flex: 1,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  adAdvertiser: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  adBody: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default NativeAdComponent; 