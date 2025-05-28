import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import type { EmitterSubscription } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  AdEventType,
  NativeMediaView,
} from 'react-native-google-mobile-ads';
import { adUnitIds } from '../../services/AdMobService';

interface NativeAdComponentProps {
  containerStyle?: ViewStyle;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: Error) => void;
}

/**
 * A Native Advanced Ad Component that uses the actual NativeAd implementation
 * from react-native-google-mobile-ads for production use.
 */
const NativeAdComponent: React.FC<NativeAdComponentProps> = ({
  containerStyle,
  onAdLoaded,
  onAdFailedToLoad
}) => {
  const [ad, setAd] = useState<NativeAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [adKey, setAdKey] = useState(1); // Used to force refresh when needed
  const [retryAttempts, setRetryAttempts] = useState(0);
  
  const MAX_RETRY_ATTEMPTS = 2;
  const loadedListener = useRef<EmitterSubscription | null>(null);
  const errorListener = useRef<EmitterSubscription | null>(null);

  useEffect(() => {
    loadNativeAd();
    
    return () => {
      // Clean up listeners and resources
      if (ad) {
        loadedListener.current?.remove();
        errorListener.current?.remove();
        ad.destroy();
      }
    };
  }, [adKey]);

  const loadNativeAd = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Clean up previous ad if exists
      if (ad) {
        loadedListener.current?.remove();
        errorListener.current?.remove();
        ad.destroy();
      }
      
      // Create a native ad request
      const nativeAd = await NativeAd.createForAdRequest(adUnitIds.native, {
        requestNonPersonalizedAdsOnly: false,
        keywords: ['game', 'chat', 'social', 'entertainment'],
      });
      
      // Add event listeners - Note that for NativeAd, these listeners are already registered
      // internally during creation, and we just need to handle when the ad is ready
      setAd(nativeAd);
      
      // The NativeAd is already loaded at this point from createForAdRequest
      setTimeout(() => {
        if (nativeAd) {
          if (__DEV__) {
            console.log('Native ad loaded successfully');
          }
          setLoading(false);
          setRetryAttempts(0); // Reset retry counter on success
          if (onAdLoaded) onAdLoaded();
        }
      }, 100);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (__DEV__) {
        console.error('Error setting up native ad:', error);
      }
      setError(error);
      setLoading(false);
      
      // Handle retries for errors
      if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        const delay = Math.pow(2, retryAttempts) * 1000; // Exponential backoff
        if (__DEV__) {
          console.log(`Retrying native ad load in ${delay}ms (attempt ${retryAttempts + 1}/${MAX_RETRY_ATTEMPTS})`);
        }
        
        setTimeout(() => {
          setRetryAttempts(prev => prev + 1);
          setAdKey(prev => prev + 1); // Force reload
        }, delay);
      } else if (onAdFailedToLoad) {
        onAdFailedToLoad(error);
      }
    }
  };

  // Don't show ads on platforms other than Android in this app
  if (Platform.OS !== 'android') {
    return null;
  }

  // Show loading placeholder
  if (loading) {
    return (
      <View style={[styles.container, containerStyle, styles.placeholderContainer]}>
        <ActivityIndicator size="large" color="#EC4899" />
        <Text style={styles.placeholderText}>Loading ad...</Text>
      </View>
    );
  }

  // Show error placeholder in development only
  if (error || !ad) {
    if (__DEV__) {
      return (
        <View style={[styles.container, containerStyle, styles.placeholderContainer]}>
          <Text style={styles.errorText}>
            {error?.message || 'Failed to load ad'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => setAdKey(prev => prev + 1)} // Force reload
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null; // Hide ad space completely in production if there's an error
  }

  // Render the native ad
  return (
    <NativeAdView
      style={[styles.container, containerStyle]}
      nativeAd={ad}
    >
      {/* Ad Badge */}
      <View style={styles.adBadgeContainer}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>AD</Text>
        </View>
      </View>

      {/* Main Ad Content */}
      <View style={styles.adContent}>
        {/* Icon & Headline Row */}
        <View style={styles.headerRow}>
          {ad.icon && (
            <Image 
              source={{ uri: ad.icon.url }} 
              style={styles.icon} 
              resizeMode="cover"
            />
          )}
          <View style={styles.headerTextContainer}>
            {ad.headline && (
              <Text style={styles.headline} numberOfLines={2}>
                {ad.headline}
              </Text>
            )}
            {ad.advertiser && (
              <Text style={styles.advertiser}>{ad.advertiser}</Text>
            )}
          </View>
        </View>

        {/* Media View - Properly implemented */}
        {ad.mediaContent && (
          <NativeMediaView style={styles.mediaView} />
        )}

        {/* Body Text */}
        {ad.body && (
          <Text style={styles.description} numberOfLines={3}>
            {ad.body}
          </Text>
        )}

        {/* Store/Price/Rating Row */}
        {(ad.store || ad.price || ad.starRating) && (
          <View style={styles.infoRow}>
            {ad.store && (
              <Text style={styles.storeText}>{ad.store}</Text>
            )}
            {ad.price && (
              <Text style={styles.priceText}>{ad.price}</Text>
            )}
            {ad.starRating && (
              <View style={styles.starRating}>
                <Text style={styles.ratingText}>
                  {ad.starRating} ★
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Call To Action Button - Properly set up for ad clicking */}
        <View nativeID="callToActionView" style={styles.callToActionButton}>
          <Text style={styles.callToActionText}>
            {ad.callToAction || 'Get started'}
          </Text>
        </View>
      </View>
    </NativeAdView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  placeholderContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  adBadgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
  },
  adBadge: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  adContent: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  advertiser: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  description: {
    color: '#9CA3AF',
    fontSize: 14,
    marginVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    alignItems: 'center',
  },
  starRating: {
    marginRight: 8,
  },
  ratingText: {
    color: '#FACC15',
    fontSize: 14,
  },
  storeText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginRight: 8,
  },
  priceText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginRight: 8,
  },
  mediaView: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  callToActionButton: {
    backgroundColor: '#EC4899',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  callToActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default NativeAdComponent;
