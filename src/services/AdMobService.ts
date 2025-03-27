import { Platform } from 'react-native';
import { 
  TestIds, 
  RequestOptions, 
  AdsConsent, 
  AdsConsentStatus,
  AppOpenAd,
  InterstitialAd,
  RewardedAd,
  RewardedInterstitialAd,
  AdEventType,
  BannerAdSize,
  RewardedAdEventType,
  MobileAds,
  PaidEvent,
  RevenuePrecisions
} from 'react-native-google-mobile-ads';

/**
 * Ad unit IDs for the application
 * Use test IDs for development and real IDs for production
 */
export const adUnitIds = {
  // Use test IDs for all environments for safety
  appOpen: TestIds.APP_OPEN,
  banner: TestIds.BANNER,
  // Test IDs that always fill on emulators/simulators
  simulatorBanner: 'ca-app-pub-3940256099942544/6300978111',
  simulatorInterstitial: 'ca-app-pub-3940256099942544/1033173712',
  simulatorRewarded: 'ca-app-pub-3940256099942544/5224354917',
  // Regular ad units with test IDs
  interstitial: TestIds.INTERSTITIAL,
  rewarded: TestIds.REWARDED,
  rewardedInterstitial: TestIds.REWARDED_INTERSTITIAL,
  native: TestIds.NATIVE,
};

// Default request configuration
export const defaultRequestOptions: RequestOptions = {
  keywords: ['game', 'social', 'entertainment', 'chat'],
  requestNonPersonalizedAdsOnly: false,
};

// Use test app ID
export const defaultAppId = 'ca-app-pub-3940256099942544~3347511713';

// Time to keep ads in cache before refreshing (in ms)
const AD_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Maximum number of ads to preload per type
const MAX_INTERSTITIAL_CACHE = 2;
const MAX_REWARDED_CACHE = 2;

// Configuration
const ENABLE_TEST_MODE = false; // Changed to false to see real ads instead of test ads

/**
 * AdCache class to manage a pool of preloaded ads
 */
class AdCache<T> {
  private ads: {ad: T, timestamp: number}[] = [];
  private maxSize: number;
  private loading = false;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Add an ad to the cache
   */
  add(ad: T): void {
    // Add with current timestamp
    this.ads.push({ad, timestamp: Date.now()});
    
    // Trim if we exceed max size
    if (this.ads.length > this.maxSize) {
      this.ads.shift(); // Remove oldest
    }
  }

  /**
   * Get an ad from the cache (and remove it)
   */
  get(): T | null {
    if (this.ads.length === 0) return null;
    
    // Get the newest ad (to avoid expiry issues)
    const {ad} = this.ads.pop()!;
    return ad;
  }

  /**
   * Check if any ads are available
   */
  hasAds(): boolean {
    return this.ads.length > 0;
  }

  /**
   * Check if any ads are expired and should be refreshed
   */
  hasExpiredAds(): boolean {
    if (this.ads.length === 0) return false;
    
    const now = Date.now();
    return this.ads.some(({timestamp}) => now - timestamp > AD_CACHE_EXPIRY);
  }

  /**
   * Remove all ads from the cache
   */
  clear(): void {
    this.ads = [];
  }

  /**
   * Get the number of ads in the cache
   */
  size(): number {
    return this.ads.length;
  }

  /**
   * Check if we're currently loading an ad
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Set the loading state
   */
  setLoading(loading: boolean): void {
    this.loading = loading;
  }
}

class AdMobService {
  private static instance: AdMobService;
  private consentStatus: AdsConsentStatus = AdsConsentStatus.UNKNOWN;
  private appOpenAd: AppOpenAd | null = null;
  private isAppOpenAdLoading = false;
  private appOpenAdLoadTime = 0;
  private appOpenAdErrorCount = 0;
  private maxRetryAttempts = 3;
  private adsInitialized = false;
  private appVolume = 1.0;
  private appMuted = false;
  private onAdRevenue: ((event: PaidEvent) => void) | null = null;
  
  // Ad caches for different ad types
  private interstitialCache = new AdCache<InterstitialAd>(MAX_INTERSTITIAL_CACHE);
  private rewardedCache = new AdCache<RewardedAd>(MAX_REWARDED_CACHE);
  private rewardedInterstitialCache = new AdCache<RewardedInterstitialAd>(1);
  
  // Background preloading timers
  private preloadTimer: NodeJS.Timeout | null = null;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): AdMobService {
    if (!AdMobService.instance) {
      AdMobService.instance = new AdMobService();
    }
    return AdMobService.instance;
  }

  /**
   * Initialize MobileAds SDK and start preloading ads
   */
  public async initialize(): Promise<void> {
    try {
      if (this.adsInitialized) return;
      
      console.log('Initializing AdMob SDK...');
      
      // Register test device before initialization (only if test mode is enabled)
      if (ENABLE_TEST_MODE) {
        await MobileAds().setRequestConfiguration({
          // Add the test device ID you registered in AdMob console
          testDeviceIdentifiers: ['bfb5eed9-87c7-4fd0-be9e-117bd7629a35'],
        });
        console.log('Test mode ENABLED - showing test ads only');
      } else {
        console.log('Test mode DISABLED - showing real ads');
      }
      
      // Initialize the Google Mobile Ads SDK
      await MobileAds().initialize();
      this.adsInitialized = true;
      console.log('AdMob SDK initialized successfully');
      
      // Set a safe default consent status in case consent fails
      this.consentStatus = AdsConsentStatus.NOT_REQUIRED;
      
      // Try to initialize consent, but don't let failures block ads
      try {
        await this.initializeConsent();
      } catch (consentError) {
        // Make consent errors non-blocking
        console.warn('Consent initialization failed, continuing with default consent settings:', consentError);
      }
      
      // Start preloading ads in parallel
      this.preloadAdsInParallel();
      
      // Set up periodic background preloading
      this.setupBackgroundPreloading();
    } catch (error) {
      console.error('Error initializing AdMob SDK:', error);
    }
  }

  /**
   * Preload all ad types in parallel to speed up initial loading
   */
  private async preloadAdsInParallel(): Promise<void> {
    console.log('Starting parallel ad preloading...');
    
    // Create an array of preload promises to run in parallel
    const preloadPromises = [
      this.loadAppOpenAd(), // Critical - often shown first
      this.preloadInterstitialAd(), // Medium priority
      this.preloadRewardedAd(), // Lower priority
    ];
    
    // Wait for all to complete, but don't let errors stop others
    try {
      await Promise.allSettled(preloadPromises);
      console.log('Initial parallel ad preloading complete');
    } catch (error) {
      console.warn('Some ads failed to preload:', error);
    }
  }

  /**
   * Set up background preloading to keep ad cache fresh
   */
  private setupBackgroundPreloading(): void {
    // Clear any existing timer
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
    }
    
    // Check every 5 minutes if we need to preload more ads
    this.preloadTimer = setInterval(() => {
      this.checkAndRefreshAdCache();
    }, 5 * 60 * 1000);
  }

  /**
   * Check ad cache status and refresh ads as needed
   */
  private async checkAndRefreshAdCache(): Promise<void> {
    console.log('Checking ad cache status...');
    
    const tasks = [];
    
    // Check if app open ad is stale or missing
    if (!this.isAppOpenAdAvailable() && !this.isAppOpenAdLoading) {
      tasks.push(this.loadAppOpenAd());
    }
    
    // Top up interstitial cache if needed
    if (this.interstitialCache.size() < MAX_INTERSTITIAL_CACHE && !this.interstitialCache.isLoading()) {
      tasks.push(this.preloadInterstitialAd());
    } else if (this.interstitialCache.hasExpiredAds()) {
      // If we have expired ads, refresh one
      this.interstitialCache.clear();
      tasks.push(this.preloadInterstitialAd());
    }
    
    // Top up rewarded ad cache if needed
    if (this.rewardedCache.size() < MAX_REWARDED_CACHE && !this.rewardedCache.isLoading()) {
      tasks.push(this.preloadRewardedAd());
    } else if (this.rewardedCache.hasExpiredAds()) {
      // If we have expired ads, refresh one
      this.rewardedCache.clear();
      tasks.push(this.preloadRewardedAd());
    }
    
    // Run refresh tasks in parallel
    if (tasks.length > 0) {
      console.log(`Refreshing ${tasks.length} ad types...`);
      await Promise.allSettled(tasks);
    } else {
      console.log('Ad cache is healthy, no refresh needed');
    }
  }

  /**
   * Initialize consent collection and request if needed
   * @returns Promise resolving to consent status
   */
  public async initializeConsent(): Promise<AdsConsentStatus> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return AdsConsentStatus.NOT_REQUIRED;
    
    try {
      // Use a more robust error handling approach
      const consentInfo = await AdsConsent.requestInfoUpdate({
        debugGeography: __DEV__ ? 1 : 0, // EEA for testing in debug mode
        testDeviceIdentifiers: __DEV__ ? ['bfb5eed9-87c7-4fd0-be9e-117bd7629a35'] : [],
      }).catch(error => {
        console.warn('Consent info update failed, using default consent settings:', error);
        return { status: AdsConsentStatus.NOT_REQUIRED, isConsentFormAvailable: false };
      });
      
      if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
        try {
          const formResult = await AdsConsent.showForm();
          this.consentStatus = formResult.status;
          return formResult.status;
        } catch (formError) {
          console.warn('Failed to show consent form:', formError);
          this.consentStatus = AdsConsentStatus.NOT_REQUIRED;
          return AdsConsentStatus.NOT_REQUIRED;
        }
      }
      
      this.consentStatus = consentInfo.status;
      return consentInfo.status;
    } catch (error) {
      console.error('Error initializing consent:', error);
      this.consentStatus = AdsConsentStatus.NOT_REQUIRED;
      return AdsConsentStatus.NOT_REQUIRED;
    }
  }

  /**
   * Check if an app open ad is available to show
   * @returns boolean indicating if ad is available
   */
  private isAppOpenAdAvailable(): boolean {
    return !!this.appOpenAd?.loaded && (Date.now() - this.appOpenAdLoadTime < 3600000); // 1 hour validity
  }

  /**
   * Load an app open ad
   * @param onAdDismissed Callback when ad is dismissed
   */
  public async loadAppOpenAd(onAdDismissed?: () => void): Promise<void> {
    if (Platform.OS !== 'android') return;
    
    // If we've exceeded retry attempts, don't try to load again
    if (this.appOpenAdErrorCount >= this.maxRetryAttempts) {
      console.log('Exceeded maximum retry attempts for app open ad, not loading');
      return;
    }
    
    // If an ad is already loading or available, don't load another one
    if (this.isAppOpenAdLoading || this.isAppOpenAdAvailable()) return;
    
    this.isAppOpenAdLoading = true;
    
    try {
      console.log('Loading app open ad...');
      // Use simulator ad ID in dev mode, otherwise use updated app open ad ID
      const adUnitId = __DEV__ ? TestIds.APP_OPEN : adUnitIds.appOpen;
      
      this.appOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
        ...defaultRequestOptions,
        requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
      });
      
      const loadedListener = this.appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
        this.isAppOpenAdLoading = false;
        this.appOpenAdLoadTime = Date.now();
        this.appOpenAdErrorCount = 0; // Reset error count on successful load
        console.log('App open ad loaded successfully');
      });
      
      const closedListener = this.appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        if (onAdDismissed) onAdDismissed();
        loadedListener();
        closedListener();
        this.appOpenAd = null;
        // Preload the next ad after this one is closed
        setTimeout(() => this.loadAppOpenAd(), 1000);
      });

      const errorListener = this.appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('App open ad failed to load:', error);
        this.isAppOpenAdLoading = false;
        this.appOpenAdErrorCount++;
        
        loadedListener();
        errorListener();
        closedListener();
        
        // If it's a no-fill error, we might want to try again after a delay
        if (error.message && error.message.includes('no-fill') && this.appOpenAdErrorCount < this.maxRetryAttempts) {
          // Exponential backoff for retries (2^n * 1000ms)
          const retryDelay = Math.pow(2, this.appOpenAdErrorCount) * 1000;
          console.log(`Will retry loading app open ad after ${retryDelay}ms (attempt ${this.appOpenAdErrorCount}/${this.maxRetryAttempts})`);
          
          setTimeout(() => {
            this.loadAppOpenAd(onAdDismissed);
          }, retryDelay);
        }
      });
      
      // Add revenue event listener
      const paidListener = this.appOpenAd.addAdEventListener(AdEventType.PAID, (event) => {
        if (event) this.handleAdRevenue(event);
        paidListener(); // Remove listener after first event
      });
      
      await this.appOpenAd.load();
    } catch (error) {
      this.isAppOpenAdLoading = false;
      this.appOpenAdErrorCount++;
      console.error('Failed to load app open ad:', error);
    }
  }

  /**
   * Show the loaded app open ad
   * @returns Promise resolving to boolean indicating success
   */
  public async showAppOpenAd(): Promise<boolean> {
    if (!this.isAppOpenAdAvailable()) {
      // If no ad is available, try loading one for next time
      this.loadAppOpenAd();
      return false;
    }
    
    try {
      await this.appOpenAd?.show();
      return true;
    } catch (error) {
      console.error('Failed to show app open ad:', error);
      return false;
    }
  }

  /**
   * Preload an interstitial ad into the cache
   */
  private async preloadInterstitialAd(): Promise<void> {
    if (!this.adsInitialized || this.interstitialCache.isLoading()) return;
    
    this.interstitialCache.setLoading(true);
    
    try {
      console.log('Preloading interstitial ad...');
      const interstitial = InterstitialAd.createForAdRequest(
        __DEV__ ? adUnitIds.simulatorInterstitial : adUnitIds.interstitial,
        {
          ...defaultRequestOptions,
          requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        }
      );
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        const loadedListener = interstitial.addAdEventListener(AdEventType.LOADED, () => {
          console.log('Interstitial ad preloaded successfully');
          loadedListener();
          errorListener();
          this.interstitialCache.add(interstitial);
          this.interstitialCache.setLoading(false);
          resolve();
        });
        
        const errorListener = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
          console.warn('Failed to preload interstitial ad:', error);
          loadedListener();
          errorListener();
          this.interstitialCache.setLoading(false);
          reject(error);
        });
        
        // Add revenue event listener (this stays attached)
        interstitial.addAdEventListener(AdEventType.PAID, (event) => {
          if (event) this.handleAdRevenue(event);
        });
      });
      
      // Start loading
      interstitial.load();
      await loadPromise;
      
      // If we've successfully loaded one ad and cache isn't full, 
      // opportunistically load another in the background
      if (this.interstitialCache.size() < MAX_INTERSTITIAL_CACHE) {
        setTimeout(() => this.preloadInterstitialAd(), 1000);
      }
    } catch (error) {
      this.interstitialCache.setLoading(false);
      console.error('Error in interstitial preloading:', error);
    }
  }

  /**
   * Get an interstitial ad (from cache or load a new one)
   */
  public async getInterstitialAd(): Promise<InterstitialAd> {
    // First try to get from cache
    const cachedAd = this.interstitialCache.get();
    if (cachedAd) {
      console.log('Using cached interstitial ad');
      
      // Start preloading a replacement in the background
      setTimeout(() => this.preloadInterstitialAd(), 0);
      
      return cachedAd;
    }
    
    // If not in cache, load a new one
    console.log('No cached interstitial ad, loading on demand');
    return new Promise((resolve, reject) => {
      const interstitial = InterstitialAd.createForAdRequest(
        __DEV__ ? adUnitIds.simulatorInterstitial : adUnitIds.interstitial,
        {
          ...defaultRequestOptions,
          requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        }
      );
      
      const loadedListener = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        loadedListener();
        resolve(interstitial);
      });
      
      const errorListener = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        errorListener();
        reject(error);
      });
      
      // Add revenue event listener (this stays attached)
      interstitial.addAdEventListener(AdEventType.PAID, (event) => {
        if (event) this.handleAdRevenue(event);
      });
      
      interstitial.load();
    });
  }

  /**
   * Show an interstitial ad (either cached or newly loaded)
   */
  public async showInterstitialAd(): Promise<boolean> {
    try {
      const interstitial = await this.getInterstitialAd();
      
      // Set up closed listener to preload the next ad
      const closedListener = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        closedListener();
        // Queue up next preload after ad is closed
        setTimeout(() => this.preloadInterstitialAd(), 1000);
      });
      
      // Show the ad
      await interstitial.show();
      return true;
    } catch (error) {
      console.error('Failed to show interstitial ad:', error);
      
      // Try to preload for next time
      setTimeout(() => this.preloadInterstitialAd(), 5000);
      
      return false;
    }
  }

  /**
   * Preload a rewarded ad into the cache
   */
  private async preloadRewardedAd(): Promise<void> {
    if (!this.adsInitialized || this.rewardedCache.isLoading()) return;
    
    this.rewardedCache.setLoading(true);
    
    try {
      console.log('Preloading rewarded ad...');
      const rewarded = RewardedAd.createForAdRequest(
        __DEV__ ? adUnitIds.simulatorRewarded : adUnitIds.rewarded,
        {
          ...defaultRequestOptions,
          requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        }
      );
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        const loadedListener = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
          console.log('Rewarded ad preloaded successfully');
          loadedListener();
          errorListener();
          this.rewardedCache.add(rewarded);
          this.rewardedCache.setLoading(false);
          resolve();
        });
        
        const errorListener = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
          console.warn('Failed to preload rewarded ad:', error);
          loadedListener();
          errorListener();
          this.rewardedCache.setLoading(false);
          reject(error);
        });
        
        // Add revenue event listener (this stays attached)
        rewarded.addAdEventListener(AdEventType.PAID, (event) => {
          if (event) this.handleAdRevenue(event);
        });
      });
      
      // Start loading
      rewarded.load();
      await loadPromise;
      
      // If we've successfully loaded one ad and cache isn't full, 
      // opportunistically load another in the background
      if (this.rewardedCache.size() < MAX_REWARDED_CACHE) {
        setTimeout(() => this.preloadRewardedAd(), 1000);
      }
    } catch (error) {
      this.rewardedCache.setLoading(false);
      console.error('Error in rewarded preloading:', error);
    }
  }

  /**
   * Get a rewarded ad (from cache or load a new one)
   */
  public async getRewardedAd(): Promise<RewardedAd> {
    // First try to get from cache
    const cachedAd = this.rewardedCache.get();
    if (cachedAd) {
      console.log('Using cached rewarded ad');
      
      // Start preloading a replacement in the background
      setTimeout(() => this.preloadRewardedAd(), 0);
      
      return cachedAd;
    }
    
    // If not in cache, load a new one
    console.log('No cached rewarded ad, loading on demand');
    return new Promise((resolve, reject) => {
      const rewarded = RewardedAd.createForAdRequest(
        __DEV__ ? adUnitIds.simulatorRewarded : adUnitIds.rewarded,
        {
          ...defaultRequestOptions,
          requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        }
      );
      
      const loadedListener = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        loadedListener();
        resolve(rewarded);
      });
      
      const errorListener = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        errorListener();
        reject(error);
      });
      
      // Add revenue event listener (this stays attached)
      rewarded.addAdEventListener(AdEventType.PAID, (event) => {
        if (event) this.handleAdRevenue(event);
      });
      
      rewarded.load();
    });
  }

  /**
   * Show a rewarded ad and get the reward
   */
  public async showRewardedAd(): Promise<any> {
    try {
      const rewarded = await this.getRewardedAd();
      
      return new Promise((resolve, reject) => {
        // Set up reward listener
        const earnedRewardListener = rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD, 
          (reward) => {
            earnedRewardListener();
            resolve(reward);
          }
        );
        
        // Set up closed listener to preload the next ad
        const closedListener = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
          closedListener();
          // If we reach here without earning a reward, resolve with null
          resolve(null);
          
          // Queue up next preload after ad is closed
          setTimeout(() => this.preloadRewardedAd(), 1000);
        });
        
        // Set up error listener
        const errorListener = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
          errorListener();
          closedListener();
          earnedRewardListener();
          reject(error);
        });
        
        // Show the ad
        rewarded.show().catch((error) => {
          errorListener();
          closedListener();
          earnedRewardListener();
          reject(error);
        });
      });
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      
      // Try to preload for next time
      setTimeout(() => this.preloadRewardedAd(), 5000);
      
      throw error;
    }
  }

  /**
   * Open the AdMob Inspector to debug ad issues
   * This is helpful when facing issues like no-fill errors
   */
  public async openAdInspector(): Promise<void> {
    try {
      if (!this.adsInitialized) {
        await this.initialize();
      }
      
      console.log('Opening AdMob Inspector...');
      await MobileAds().openAdInspector();
      console.log('AdMob Inspector closed');
    } catch (error) {
      console.error('Failed to open AdMob Inspector:', error);
    }
  }

  /**
   * Open the debug menu for a specific ad unit
   * @param adUnitId The ad unit ID to debug
   */
  public async openDebugMenu(adUnitId: string): Promise<void> {
    try {
      if (!this.adsInitialized) {
        await this.initialize();
      }
      
      console.log(`Opening debug menu for ad unit: ${adUnitId}`);
      await MobileAds().openDebugMenu(adUnitId);
    } catch (error) {
      console.error('Failed to open debug menu:', error);
    }
  }

  /**
   * Set the app's audio volume for video ads
   * @param volume Volume level from 0.0 (silent) to 1.0 (full volume)
   */
  public setAppVolume(volume: number): void {
    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    if (this.appVolume !== clampedVolume) {
      this.appVolume = clampedVolume;
      MobileAds().setAppVolume(clampedVolume);
      console.log(`Ad volume set to ${clampedVolume}`);
    }
  }

  /**
   * Get the current app volume setting
   * @returns Current app volume (0.0 to 1.0)
   */
  public getAppVolume(): number {
    return this.appVolume;
  }

  /**
   * Set whether the app is muted
   * @param muted Whether the app is muted
   */
  public setAppMuted(muted: boolean): void {
    if (this.appMuted !== muted) {
      this.appMuted = muted;
      MobileAds().setAppMuted(muted);
      console.log(`App ${muted ? 'muted' : 'unmuted'} for ads`);
    }
  }

  /**
   * Get whether the app is currently muted
   * @returns Whether the app is muted
   */
  public isAppMuted(): boolean {
    return this.appMuted;
  }

  /**
   * Set a global callback for ad revenue events
   * @param callback The callback to call when ad revenue is reported
   */
  public setAdRevenueCallback(callback: (event: PaidEvent) => void): void {
    this.onAdRevenue = callback;
  }

  /**
   * Handle ad revenue event internally and forward to callback if set
   * @param event The ad revenue event
   */
  public handleAdRevenue(event: PaidEvent): void {
    console.log(`Ad revenue reported: ${event.value} ${event.currency} (${RevenuePrecisions[event.precision]})`);
    
    // Forward to callback if set
    if (this.onAdRevenue) {
      this.onAdRevenue(event);
    }
  }
  
  /**
   * Clean up resources when the app is being closed
   */
  public cleanup(): void {
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
      this.preloadTimer = null;
    }
    
    // Clean up app open ad
    if (this.appOpenAd) {
      this.appOpenAd.removeAllListeners();
      this.appOpenAd = null;
    }
    
    // Clear all ad caches
    this.interstitialCache.clear();
    this.rewardedCache.clear();
    this.rewardedInterstitialCache.clear();
    
    console.log('AdMobService cleaned up');
  }
}

export default AdMobService; 