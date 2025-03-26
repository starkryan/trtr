import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { 
  BannerAd, 
  BannerAdSize, 
  AdEventType,
  PaidEvent
} from 'react-native-google-mobile-ads';
import { adUnitIds } from '../../services/AdMobService';
import AdMobService from '../../services/AdMobService';

interface BannerAdComponentProps {
  size?: BannerAdSize;
  containerStyle?: object;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: Error) => void;
  useSimulatorAdUnit?: boolean; // New prop to force simulator ad unit
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
  useSimulatorAdUnit = false,
  onAdRevenue
}) => {
  const [adLoaded, setAdLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hideAdSpace, setHideAdSpace] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [adKey, setAdKey] = useState(0); // Used to force re-render
  
  const MAX_RETRY_ATTEMPTS = 2;
  
  // Determine which ad unit ID to use
  const getBannerAdUnitId = () => {
    // In development, use simulator ad unit if requested (works in emulators)
    if (__DEV__ && useSimulatorAdUnit) {
      const id = adUnitIds.simulatorBanner;
      console.log(`Using simulator banner ad ID: ${id}`);
      return id;
    }
    const id = adUnitIds.banner;
    console.log(`Using banner ad ID: ${id}`);
    return id;
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
      
      console.log(`Retrying banner ad load (attempt ${retryAttempts + 1}/${MAX_RETRY_ATTEMPTS})`);
    } else {
      console.log('Max retry attempts reached, hiding banner ad space');
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
    console.error('Banner ad failed to load:', error);
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
          console.log(`Banner ad loaded successfully with size: ${size}`);
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
  }
});

export default BannerAdComponent; 