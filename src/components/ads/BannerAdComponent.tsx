import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform, Text } from 'react-native';
import { 
  BannerAd, 
  BannerAdSize, 
  PaidEvent} from 'react-native-google-mobile-ads';
import { adUnitIds } from '../../services/AdMobService';
import AdMobService from '../../services/AdMobService';

interface BannerAdComponentProps {
  size?: BannerAdSize;
  containerStyle?: object;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: Error) => void;
  onAdRevenue?: (event: PaidEvent) => void; // Add callback for revenue events
}

/**
 * A reusable Banner Ad component that can be placed in various screens
 */
const BannerAdComponent: React.FC<BannerAdComponentProps> = ({ 
  size = BannerAdSize.BANNER,
  containerStyle = {},
  onAdLoaded,
  onAdFailedToLoad,
  onAdRevenue,
}) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hideAdSpace, setHideAdSpace] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [adKey, setAdKey] = useState(0); // Used to force re-render
  
  const MAX_RETRY_ATTEMPTS = 2;
  
  // Determine which ad unit ID to use
  const getBannerAdUnitId = () => {
    // For development environment - use test ads
    if (__DEV__) {
      if (Platform.OS === 'android') {
        // Use the specific Android test ID
        const androidTestId = 'ca-app-pub-3940256099942544/6300978111';
        return androidTestId;
      } else if (Platform.OS === 'ios') {
        // Use the specific iOS test ID
        const iOSTestId = 'ca-app-pub-3940256099942544/2934735716';
        return iOSTestId;
      } else {
        // Fallback for other platforms in DEV (shouldn't happen for mobile)
        return 'ca-app-pub-3940256099942544/6300978111'; 
      }
    } else {
      // For production, use the real ad unit ID from AdMobService
      return adUnitIds.banner;
    }
  };
  
  useEffect(() => {
    return () => {
      // Clean up on unmount
      setAdLoaded(false);
      setError(null);
    };
  }, []);

  // Reset ad when retry is needed
  const retryLoadingAd = () => {
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      // Increment retry counter
      setRetryAttempts(prev => prev + 1);
      // Change key to force re-render
      setAdKey(prev => prev + 1);
      // Reset error
      setError(null);
      
      if (__DEV__) {
        console.log(`Retrying banner ad load (attempt ${retryAttempts + 1}/${MAX_RETRY_ATTEMPTS})`);
      }
    } else {
      if (__DEV__) {
        console.log('Max retry attempts reached, hiding banner ad space');
      }
      setHideAdSpace(true);
    }
  };

  // Don't show ads on platforms other than Android in this app
  if (Platform.OS !== 'android') {
    return null;
  }
  
  // If we've decided to hide the ad space due to persistent errors
  if (hideAdSpace) {
    return null;
  }

  const handleAdFailedToLoad = (error: Error) => {
    if (__DEV__) {
      console.error('Banner ad failed to load:', error);
    }
    setError(error);
    
    // If it's a "no-fill" error, try again after a delay
    if (error.message && error.message.includes('no-fill')) {
      if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        const delay = Math.pow(2, retryAttempts) * 1000; // Exponential backoff
        setTimeout(() => retryLoadingAd(), delay);
      } else {
        setHideAdSpace(true);
      }
    } else {
      // For other errors, hide immediately if severe
      if (error.message && (
          error.message.includes('invalid') || 
          error.message.includes('network') ||
          error.message.includes('timeout')
        )) {
        setHideAdSpace(true);
      }
    }
    
    if (onAdFailedToLoad) {
      onAdFailedToLoad(error);
    }
  };

  // Handle ad revenue reporting
  const handleAdRevenue = (event: PaidEvent) => {
    // Forward to our AdMobService for centralized tracking
    AdMobService.getInstance().handleAdRevenue(event);
    
    // Also call component-specific callback if provided
    if (onAdRevenue) {
      onAdRevenue(event);
    }
  };

  return (
    <View 
      style={[
        styles.container, 
        containerStyle, 
        !adLoaded && styles.hidden
      ]}
    >
      <BannerAd
        key={`banner-ad-${adKey}`} // Force re-render on retry
        size={size}
        unitId={getBannerAdUnitId()}
        onAdLoaded={() => {
          if (__DEV__) {
            console.log(`Banner ad loaded successfully with size: ${size}`);
          }
          setAdLoaded(true);
          setRetryAttempts(0); // Reset retry counter on success
          if (onAdLoaded) onAdLoaded();
        }}
        onAdFailedToLoad={handleAdFailedToLoad}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
          keywords: ['game', 'chat', 'social', 'entertainment'],
        }}
        onPaid={handleAdRevenue}
      />
      {__DEV__ && error && (
        <Text style={styles.errorText}>{error.message}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 10,
  },
  hidden: {
    height: 0,
    opacity: 0,
  },
  debugContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  debugButton: {
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
  },
  errorText: {
    color: 'red',
    fontSize: 10,
    marginTop: 4,
  }
});

export default BannerAdComponent;
