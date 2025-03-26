import { useEffect, useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { 
  InterstitialAd, 
  RewardedAd, 
  RewardedInterstitialAd, 
  AdEventType,
  RewardedAdEventType,
  RewardedAdReward,
  PaidEvent
} from 'react-native-google-mobile-ads';
import AdMobService from '../services/AdMobService';

// Maximum number of retry attempts for ad loading
const MAX_RETRY_ATTEMPTS = 2;

/**
 * Hook for using interstitial ads in components with the optimized AdMobService
 * This is a wrapper around the AdMobService cached interstitial system
 */
export const useInterstitialAd = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [revenue, setRevenue] = useState<PaidEvent | null>(null);

  // Skip for non-Android platforms
  if (Platform.OS !== 'android') {
    return {
      isLoaded: false,
      error: null,
      revenue: null,
      load: () => Promise.reject('Not supported on this platform'),
      show: () => Promise.reject('Not supported on this platform'),
    };
  }

  /**
   * Show interstitial ad using AdMobService
   */
  const show = useCallback(async () => {
    try {
      setLoading(true);
      const result = await AdMobService.getInstance().showInterstitialAd();
      setLoading(false);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      console.error('Error showing interstitial ad:', error);
      return false;
    }
  }, []);

  /**
   * Load method is now a no-op since AdMobService handles preloading
   * Kept for API compatibility
   */
  const load = useCallback(async () => {
    // AdMobService now handles this automatically
    return true;
  }, []);

  // AdMobService handles preloading on init, nothing needed here
  
  return {
    isLoaded: !loading, // Approximation - actual loading is handled by AdMobService
    error,
    revenue,
    load,
    show,
  };
};

/**
 * Hook for using rewarded ads in components with the optimized AdMobService
 * This is a wrapper around the AdMobService cached rewarded ad system
 */
export const useRewardedAd = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [earned, setEarned] = useState(false);
  const [reward, setReward] = useState<RewardedAdReward | null>(null);
  const [revenue, setRevenue] = useState<PaidEvent | null>(null);

  // Skip for non-Android platforms
  if (Platform.OS !== 'android') {
    return {
      isLoaded: false,
      error: null,
      earned: false,
      reward: null,
      revenue: null,
      load: () => Promise.reject('Not supported on this platform'),
      show: () => Promise.reject('Not supported on this platform'),
    };
  }

  /**
   * Show rewarded ad using AdMobService
   */
  const show = useCallback(async () => {
    try {
      setLoading(true);
      setEarned(false);
      setReward(null);
      
      const earnedReward = await AdMobService.getInstance().showRewardedAd();
      
      if (earnedReward) {
        setEarned(true);
        setReward(earnedReward);
      }
      
      setLoading(false);
      return !!earnedReward;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      console.error('Error showing rewarded ad:', error);
      return false;
    }
  }, []);

  /**
   * Load method is now a no-op since AdMobService handles preloading
   * Kept for API compatibility
   */
  const load = useCallback(async () => {
    // AdMobService now handles this automatically
    return true;
  }, []);
  
  return {
    isLoaded: !loading, // Approximation - actual loading is handled by AdMobService
    error,
    earned,
    reward,
    revenue,
    load,
    show,
  };
};

/**
 * For rewarded interstitial, refer directly to AdMobService
 * This hook is kept for backward compatibility
 */
export const useRewardedInterstitialAd = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [earned, setEarned] = useState(false);
  const [reward, setReward] = useState<RewardedAdReward | null>(null);

  // Skip for non-Android platforms
  if (Platform.OS !== 'android') {
    return {
      isLoaded: false,
      error: null,
      earned: false,
      reward: null,
      load: () => Promise.reject('Not supported on this platform'),
      show: () => Promise.reject('Not supported on this platform'),
    };
  }

  // This is deprecated in favor of direct AdMobService usage
  // Kept for API compatibility
  
  const load = async () => {
    console.warn('useRewardedInterstitialAd is deprecated. Use AdMobService.getInstance() directly.');
    return true;
  };
  
  const show = async () => {
    console.warn('useRewardedInterstitialAd is deprecated. Use AdMobService.getInstance() directly.');
    return false;
  };

  return {
    isLoaded: !loading,
    error,
    earned,
    reward,
    load,
    show,
  };
}; 