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
 * Ad unit IDs and names for the application
 * Using the proper ad unit ID and name mapping from Google AdMob
 */
export const adUnitNames = {
  appOpen: 'Luvsab_AppOpen_Launch',
  banner: 'Luvsab_Banner_HomeScreen',
  interstitial: 'Luvsab_Interstitial_BetweenLevels',
  native: 'Luvsab_Native_HomeFeed',
  rewarded: 'Luvsab_Rewarded_BonusLife',
  rewardedInterstitial: 'Luvsab_RewardedInterstitial_BonusCoins',
};

export const adUnitIds = {
  // Production ad units with proper IDs from AdMob console
  appOpen: __DEV__ ? TestIds.APP_OPEN : 'ca-app-pub-2212478344110330/1668860760',
  banner: __DEV__ ? TestIds.BANNER : 'ca-app-pub-2212478344110330/8614618460',
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-2212478344110330/8031923280',
  rewarded: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-2212478344110330/2981942436',
  rewardedInterstitial: __DEV__ ? TestIds.REWARDED_INTERSTITIAL : 'ca-app-pub-2212478344110330/2284179689',
  native: __DEV__ ? TestIds.NATIVE : 'ca-app-pub-2212478344110330/9544556752',
  
  // Test IDs that always fill on emulators/simulators (only used in __DEV__ mode)
  simulatorBanner: TestIds.BANNER,
  simulatorInterstitial: TestIds.INTERSTITIAL,
  simulatorRewarded: TestIds.REWARDED,
};

// Default request configuration
export const defaultRequestOptions: RequestOptions = {
  keywords: ['game', 'social', 'entertainment', 'chat'],
  requestNonPersonalizedAdsOnly: false,
};

// Use the real app ID in production, test app ID in development
export const defaultAppId = __DEV__
  ? 'ca-app-pub-3940256099942544~3347511713'  // Test app ID
  : 'ca-app-pub-2212478344110330~3789657454'; // Production App ID

// Time to keep ads in cache before refreshing (in ms)
const AD_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Maximum number of ads to preload per type
const MAX_INTERSTITIAL_CACHE = 2;
const MAX_REWARDED_CACHE = 2;

// Configuration
const ENABLE_TEST_MODE = __DEV__ || global.isEmulator; // Test mode in development or emulator

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

  /**
   * Get the timestamp of the oldest ad in the cache
   */
  getOldestTimestamp(): number {
    if (this.ads.length === 0) return 0;
    return this.ads[0].timestamp;
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
      
      // Register test device before initialization
      if (ENABLE_TEST_MODE) {
        await MobileAds().setRequestConfiguration({
          // Use specific settings for emulators and test devices
          testDeviceIdentifiers: [
            // Standard emulator IDs
            Platform.OS === 'android' ? 'EMULATOR' : 'Simulator',
            // Alternative form that sometimes works better on Android emulators
            'emulator',
            // Legacy Android emulator ID used in some Google examples
            '01234567890123456789',
            // Custom device ID if registered in AdMob console
            'bfb5eed9-87c7-4fd0-be9e-117bd7629a35',
          ],
        });
        console.log('AdMob test devices registered');
      }
      
      // Initialize MobileAds SDK
      await MobileAds().initialize();
      console.log('MobileAds SDK initialized with app ID:', defaultAppId);
      
      // Log configured ad units
      console.log('Configured ad units:');
      console.log(`- App Open (${adUnitNames.appOpen}): ${adUnitIds.appOpen}`);
      console.log(`- Banner (${adUnitNames.banner}): ${adUnitIds.banner}`);
      console.log(`- Interstitial (${adUnitNames.interstitial}): ${adUnitIds.interstitial}`);
      console.log(`- Native (${adUnitNames.native}): ${adUnitIds.native}`);
      console.log(`- Rewarded (${adUnitNames.rewarded}): ${adUnitIds.rewarded}`);
      console.log(`- Rewarded Interstitial (${adUnitNames.rewardedInterstitial}): ${adUnitIds.rewardedInterstitial}`);
      
      // Initialize or preload ads in parallel
      await this.preloadAdsInParallel();
      
      // Start background preloading
      this.setupBackgroundPreloading();
      
      this.adsInitialized = true;
      console.log('AdMob service initialized successfully');
      
    } catch (err) {
      console.error('Error initializing AdMob:', err);
      // Continue without ads
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
      this.preloadRewardedInterstitialAd(), // New rewarded interstitial
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
      console.log('Clearing expired interstitial ads and removing listeners...');
      // @ts-ignore - Accessing private member for cleanup
      this.interstitialCache.ads.forEach(({ ad }) => ad.removeAllListeners());
      this.interstitialCache.clear();
      tasks.push(this.preloadInterstitialAd());
    }
    
    // Top up rewarded ad cache if needed
    if (this.rewardedCache.size() < MAX_REWARDED_CACHE && !this.rewardedCache.isLoading()) {
      tasks.push(this.preloadRewardedAd());
    } else if (this.rewardedCache.hasExpiredAds()) {
      // If we have expired ads, refresh one
      console.log('Clearing expired rewarded ads and removing listeners...');
      // @ts-ignore - Accessing private member for cleanup
      this.rewardedCache.ads.forEach(({ ad }) => ad.removeAllListeners());
      this.rewardedCache.clear();
      tasks.push(this.preloadRewardedAd());
    }
    
    // Top up rewarded interstitial ad cache if needed
    if (this.rewardedInterstitialCache.size() < 1 && !this.rewardedInterstitialCache.isLoading()) {
      tasks.push(this.preloadRewardedInterstitialAd());
    } else if (this.rewardedInterstitialCache.hasExpiredAds()) {
      // If we have expired ads, refresh one
      console.log('Clearing expired rewarded interstitial ads and removing listeners...');
      // @ts-ignore - Accessing private member for cleanup
      this.rewardedInterstitialCache.ads.forEach(({ ad }) => ad.removeAllListeners());
      this.rewardedInterstitialCache.clear();
      tasks.push(this.preloadRewardedInterstitialAd());
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
    
    // If we've exceeded retry attempts, don't try to load another one
    if (this.appOpenAdErrorCount >= this.maxRetryAttempts) {
      console.log('Exceeded maximum retry attempts for app open ad, not loading');
      // Reset error count after some time to allow retries later
      setTimeout(() => this.appOpenAdErrorCount = 0, 30 * 60 * 1000); // Reset after 30 minutes
      return;
    }
    
    // If an ad is already loading, don't start another load
    if (this.isAppOpenAdLoading) {
      console.log('App open ad is already loading, skipping this request');
      return;
    }
    
    // If an ad is already available and not expired, don't load another one
    if (this.isAppOpenAdAvailable()) {
      console.log('App open ad is already available, no need to load');
      return;
    }
    
    this.isAppOpenAdLoading = true;
    
    try {
      console.log('Loading app open ad...');
      // Clean up any existing ad
      if (this.appOpenAd) {
        this.appOpenAd.removeAllListeners();
        this.appOpenAd = null;
      }
      
      // Use adUnitIds.appOpen instead of always using test IDs
      const adUnitId = adUnitIds.appOpen;
      console.log(`Using app open ad unit ID: ${adUnitId}`);
      
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
        console.log('App open ad closed');
        if (onAdDismissed) onAdDismissed();
        // Clean up listeners
        loadedListener();
        closedListener();
        errorListener();
        // Remove this ad instance since it's been used
        this.appOpenAd = null;
        // Preload the next ad after this one is closed - with a slight delay
        setTimeout(() => this.loadAppOpenAd(), 1000);
      });

      const errorListener = this.appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('App open ad failed to load:', error);
        this.isAppOpenAdLoading = false;
        this.appOpenAdErrorCount++;
        
        // Clean up listeners
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
      
      // Start the load
      await this.appOpenAd.load();
      console.log('App open ad load request sent');
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
      console.log('No app open ad available to show');
      // If no ad is available, try loading one for next time
      this.loadAppOpenAd();
      return false;
    }
    
    try {
      console.log('Showing app open ad...');
      if (!this.appOpenAd) {
        console.log('App open ad instance is null despite availability check');
        return false;
      }
      
      if (!this.appOpenAd.loaded) {
        console.log('App open ad is not loaded despite availability check');
        return false;
      }
      
      await this.appOpenAd.show();
      console.log('App open ad show() called successfully');
      return true;
    } catch (error) {
      console.error('Failed to show app open ad:', error);
      // Clean up this failed ad instance
      if (this.appOpenAd) {
        this.appOpenAd.removeAllListeners();
        this.appOpenAd = null;
      }
      // Try to load a new one for next time
      setTimeout(() => this.loadAppOpenAd(), 5000);
      return false;
    }
  }

  /**
   * Get an interstitial ad (from cache or load a new one)
   */
  public async getInterstitialAd(): Promise<InterstitialAd> {
    // Always force fresh ad after certain conditions
    const now = Date.now();
    const forceRefresh = 
      // Force refresh after 5 minutes of caching to ensure variety
      (this.interstitialCache.hasAds() && now - this.interstitialCache.getOldestTimestamp() > 5 * 60 * 1000) ||
      // Every third request, force a fresh ad (33% refresh rate)
      (Math.random() < 0.33);
      
    if (forceRefresh && this.interstitialCache.hasAds()) {
      console.log('Forcing fresh interstitial ad, removing listeners and clearing cache...');
      // @ts-ignore - Accessing private member for cleanup
      this.interstitialCache.ads.forEach(({ ad }) => ad.removeAllListeners());
      this.interstitialCache.clear();
    }
    
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
      // Add a random component to help with ad rotation
      const requestOptions = {
        ...defaultRequestOptions,
        requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        // Add randomization to encourage ad rotation
        keywords: [
          ...defaultRequestOptions.keywords || [],
          // Add a random value to encourage ad rotation
          `refresh_${Math.floor(Math.random() * 1000000)}`
        ]
      };
      
      const interstitial = InterstitialAd.createForAdRequest(
        adUnitIds.interstitial,
        requestOptions
      );
      
      const loadedListener = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log('New interstitial ad loaded on demand');
        loadedListener();
        resolve(interstitial);
      });
      
      const errorListener = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('Failed to load interstitial ad on demand:', error);
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
   * Preload an interstitial ad into the cache
   */
  private async preloadInterstitialAd(): Promise<void> {
    if (!this.adsInitialized || this.interstitialCache.isLoading()) return;
    
    this.interstitialCache.setLoading(true);
    
    try {
      console.log('Preloading interstitial ad...');
      
      // Add a random component to help with ad rotation
      const requestOptions = {
        ...defaultRequestOptions,
        requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        // Add randomization to encourage ad rotation
        keywords: [
          ...defaultRequestOptions.keywords || [],
          // Add a timestamp and random value to encourage ad rotation
          `refresh_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
        ]
      };
      
      const interstitial = InterstitialAd.createForAdRequest(
        adUnitIds.interstitial,
        requestOptions
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
   * Show an interstitial ad (either cached or newly loaded)
   */
  public async showInterstitialAd(): Promise<boolean> {
    try {
      const interstitial = await this.getInterstitialAd();
      
      // Set up closed listener to preload the next ad
      const closedListener = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('Interstitial ad closed');
        closedListener();
        
        // Queue up next preload after ad is closed
        setTimeout(() => {
          // Clear cache after showing to get fresh ads next time - REMOVED
          // this.interstitialCache.clear(); 
          this.preloadInterstitialAd();
        }, 1000);
      });
      
      // Show the ad
      console.log('Showing interstitial ad...');
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
   * Get a rewarded ad (from cache or load a new one)
   */
  public async getRewardedAd(): Promise<RewardedAd> {
    // Always force fresh ad after certain conditions
    const now = Date.now();
    const forceRefresh = 
      // Force refresh after 5 minutes of caching to ensure variety
      (this.rewardedCache.hasAds() && now - this.rewardedCache.getOldestTimestamp() > 5 * 60 * 1000) ||
      // Every third request, force a fresh ad (33% refresh rate)
      (Math.random() < 0.33);
      
    if (forceRefresh && this.rewardedCache.hasAds()) {
      console.log('Forcing fresh rewarded ad, removing listeners and clearing cache...');
      // @ts-ignore - Accessing private member for cleanup
      this.rewardedCache.ads.forEach(({ ad }) => ad.removeAllListeners());
      this.rewardedCache.clear();
    }
      
    // First try to get from cache if not forcing refresh
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
      // Add a random query parameter to help with ad rotation
      const requestOptions = {
        ...defaultRequestOptions,
        requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        // Add randomization to encourage ad rotation
        keywords: [
          ...defaultRequestOptions.keywords || [],
          // Add a random value to encourage ad rotation
          `refresh_${Math.floor(Math.random() * 1000000)}`
        ]
      };
      
      const rewarded = RewardedAd.createForAdRequest(
        adUnitIds.rewarded,
        requestOptions
      );
      
      const loadedListener = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('New rewarded ad loaded on demand');
        loadedListener();
        resolve(rewarded);
      });
      
      const errorListener = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('Failed to load rewarded ad on demand:', error);
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
   * Preload a rewarded ad into the cache
   */
  private async preloadRewardedAd(): Promise<void> {
    if (!this.adsInitialized || this.rewardedCache.isLoading()) return;
    
    this.rewardedCache.setLoading(true);
    
    try {
      console.log('Preloading rewarded ad...');
      
      // Add a random component to help with ad rotation
      const requestOptions = {
        ...defaultRequestOptions,
        requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        // Add randomization to encourage ad rotation
        keywords: [
          ...defaultRequestOptions.keywords || [],
          // Add a timestamp and random value to encourage ad rotation
          `refresh_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
        ]
      };
      
      const rewarded = RewardedAd.createForAdRequest(
        adUnitIds.rewarded,
        requestOptions
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
   * Show a rewarded ad and get the reward
   */
  public async showRewardedAd(): Promise<any> {
    try {
      const rewarded = await this.getRewardedAd();
      
      // Add a marker to know when this ad was last shown
      this.markRewardedAdShown();

      return new Promise((resolve, reject) => {
        let earned = false; // Flag to track if reward was earned
        let adClosed = false; // Flag to track if ad was closed
        let rewardItem: any = null; // Store the reward item when earned

        // Function to remove all listeners
        const cleanupListeners = () => {
          earnedRewardListener();
          closedListener();
          errorListener();
          // Reset the flags after cleanup
          earned = false;
          adClosed = false;
        };

        // Set up reward listener
        const earnedRewardListener = rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          (reward) => {
            console.log('User earned reward:', reward);
            earned = true;
            rewardItem = reward; // Store the reward to use when ad closes
            // Don't resolve here, wait for the ad to close
            // Only mark that reward was earned
          }
        );

        // Set up closed listener to preload the next ad
        const closedListener = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
          console.log('Rewarded ad closed, reward earned:', earned);
          adClosed = true;
          
          // Only resolve after the ad closes
          if (earned && rewardItem) {
            cleanupListeners();
            resolve(rewardItem);
          } else {
            cleanupListeners();
            resolve(null); // No reward earned
          }
          
          // Queue up next preload after ad is closed
          setTimeout(() => {
            // Clear cache after showing to get fresh ads next time - REMOVED
            // this.rewardedCache.clear();
            this.preloadRewardedAd();
          }, 1000);
        });

        // Set up error listener
        const errorListener = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
          console.error('Error showing or during rewarded ad:', error);
          if (!adClosed) { // Only reject if not already closed
            cleanupListeners();
            reject(error); // Reject the promise on error
          }
        });

        // Add loading listener to track when ad actually starts
        const loadingListener = rewarded.addAdEventListener(AdEventType.LOADED, () => {
          console.log('Rewarded ad loaded and ready to show');
          loadingListener(); // Remove this listener right away
        });

        // Show the ad
        console.log('Attempting to show rewarded ad...');
        rewarded.show().catch((showError) => {
          console.error('Error calling rewarded.show():', showError);
          cleanupListeners();
          reject(showError);
        });
      });
    } catch (error) {
      console.error('Failed to get or show rewarded ad:', error);

      // Try to preload for next time if getting/showing failed
      setTimeout(() => this.preloadRewardedAd(), 5000);

      throw error; // Re-throw the error to be caught by the calling hook/component
    }
  }

  /**
   * Get a rewarded interstitial ad (from cache or load a new one)
   */
  public async getRewardedInterstitialAd(): Promise<RewardedInterstitialAd> {
    // First try to get from cache
    const cachedAd = this.rewardedInterstitialCache.get();
    if (cachedAd) {
      console.log('Using cached rewarded interstitial ad');
      
      // Start preloading a replacement in the background
      setTimeout(() => this.preloadRewardedInterstitialAd(), 0);
      
      return cachedAd;
    }
    
    // If not in cache, load a new one
    console.log('No cached rewarded interstitial ad, loading on demand');
    return new Promise((resolve, reject) => {
      const rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(
        adUnitIds.rewardedInterstitial,
        {
          ...defaultRequestOptions,
          requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        }
      );
      
      const loadedListener = rewardedInterstitial.addAdEventListener(RewardedAdEventType.LOADED, () => {
        loadedListener();
        resolve(rewardedInterstitial);
      });
      
      const errorListener = rewardedInterstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        errorListener();
        reject(error);
      });
      
      // Add revenue event listener (this stays attached)
      rewardedInterstitial.addAdEventListener(AdEventType.PAID, (event) => {
        if (event) this.handleAdRevenue(event);
      });
      
      rewardedInterstitial.load();
    });
  }

  /**
   * Preload a rewarded interstitial ad into the cache
   */
  private async preloadRewardedInterstitialAd(): Promise<void> {
    if (!this.adsInitialized || this.rewardedInterstitialCache.isLoading()) return;
    
    this.rewardedInterstitialCache.setLoading(true);
    
    try {
      console.log('Preloading rewarded interstitial ad...');
      const rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(
        adUnitIds.rewardedInterstitial,
        {
          ...defaultRequestOptions,
          requestNonPersonalizedAdsOnly: this.consentStatus === AdsConsentStatus.OBTAINED,
        }
      );
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        const loadedListener = rewardedInterstitial.addAdEventListener(RewardedAdEventType.LOADED, () => {
          console.log('Rewarded interstitial ad preloaded successfully');
          loadedListener();
          errorListener();
          this.rewardedInterstitialCache.add(rewardedInterstitial);
          this.rewardedInterstitialCache.setLoading(false);
          resolve();
        });
        
        const errorListener = rewardedInterstitial.addAdEventListener(AdEventType.ERROR, (error) => {
          console.warn('Failed to preload rewarded interstitial ad:', error);
          loadedListener();
          errorListener();
          this.rewardedInterstitialCache.setLoading(false);
          reject(error);
        });
        
        // Add revenue event listener (this stays attached)
        rewardedInterstitial.addAdEventListener(AdEventType.PAID, (event) => {
          if (event) this.handleAdRevenue(event);
        });
      });
      
      // Start loading
      rewardedInterstitial.load();
      await loadPromise;
    } catch (error) {
      this.rewardedInterstitialCache.setLoading(false);
      console.error('Error in rewarded interstitial preloading:', error);
    }
  }

  /**
   * Show a rewarded interstitial ad and get the reward
   */
  public async showRewardedInterstitialAd(): Promise<any> {
    try {
      const rewardedInterstitial = await this.getRewardedInterstitialAd();
      
      return new Promise((resolve, reject) => {
        // Set up reward listener
        const earnedRewardListener = rewardedInterstitial.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD, 
          (reward) => {
            earnedRewardListener();
            resolve(reward);
          }
        );
        
        // Set up closed listener to preload the next ad
        const closedListener = rewardedInterstitial.addAdEventListener(AdEventType.CLOSED, () => {
          closedListener();
          // If we reach here without earning a reward, resolve with null
          resolve(null);
          
          // Queue up next preload after ad is closed
          setTimeout(() => this.preloadRewardedInterstitialAd(), 1000);
        });
        
        // Set up error listener
        const errorListener = rewardedInterstitial.addAdEventListener(AdEventType.ERROR, (error) => {
          errorListener();
          closedListener();
          earnedRewardListener();
          reject(error);
        });
        
        // Show the ad
        rewardedInterstitial.show().catch((error) => {
          errorListener();
          closedListener();
          earnedRewardListener();
          reject(error);
        });
      });
    } catch (error) {
      console.error('Failed to show rewarded interstitial ad:', error);
      
      // Try to preload for next time
      setTimeout(() => this.preloadRewardedInterstitialAd(), 5000);
      
      throw error;
    }
  }

  /**
   * Open the Google Mobile Ads debug menu for a specific ad unit
   */
  public async openDebugMenu(adUnitId: string): Promise<void> {
    try {
      if (!this.adsInitialized) {
        console.warn('AdMob is not initialized, initializing now...');
        await this.initialize();
      }
      
      if (__DEV__) {
        console.log(`Opening debug menu for ad unit: ${adUnitId}`);
        // @ts-ignore - Method exists in latest version but might not be typed
        await MobileAds().openDebugMenu(adUnitId);
      } else {
        console.warn('Debug menu can only be opened in development builds');
      }
    } catch (error) {
      console.error('Error opening debug menu:', error);
      throw error;
    }
  }

  /**
   * Open the Google Mobile Ads Inspector for debugging
   */
  public async openAdInspector(): Promise<void> {
    try {
      if (!this.adsInitialized) {
        console.warn('AdMob is not initialized, initializing now...');
        await this.initialize();
      }
      
      console.log('Opening Ad Inspector...');
      await MobileAds().openAdInspector();
      console.log('Ad Inspector closed');
    } catch (error) {
      console.error('Error opening Ad Inspector:', error);
      throw error;
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

  /**
   * Show test ads of each type to verify they are working
   * This method is useful for debugging ad issues
   */
  public async testAdDisplay(): Promise<void> {
    try {
      console.log('===== AD TEST MODE =====');
      console.log('Attempting to test all ad types...');
      
      console.log('\nTEST #1: App Open Ad');
      await this.loadAppOpenAd();
      await new Promise(resolve => setTimeout(resolve, 2000));
      const appOpenShown = await this.showAppOpenAd();
      console.log(`App Open Ad test result: ${appOpenShown ? 'SHOWN' : 'FAILED'}`);
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('\nTEST #2: Rewarded Ad');
      try {
        const reward = await this.showRewardedAd();
        console.log(`Rewarded Ad test result: ${reward ? 'REWARD EARNED' : 'NO REWARD'}`);
      } catch (error) {
        console.log('Rewarded Ad test result: FAILED');
      }
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('\nTEST #3: Interstitial Ad');
      try {
        const interstitialShown = await this.showInterstitialAd();
        console.log(`Interstitial Ad test result: ${interstitialShown ? 'SHOWN' : 'FAILED'}`);
      } catch (error) {
        console.log('Interstitial Ad test result: FAILED');
      }
      
      console.log('\nAd testing complete. Check logs for any errors.');
      console.log('======================');
    } catch (error) {
      console.error('Error during ad testing:', error);
    }
  }

  /**
   * Register the current device as a test device
   * Call this method to ensure you're seeing test ads on your device
   * @param deviceId Optional device ID string (if you already know it)
   */
  public async registerAsTestDevice(deviceId?: string): Promise<void> {
    try {
      if (!deviceId) {
        console.log('Registering current device as a test device');
        console.log('Check logcat/console for your test device ID');
      } else {
        console.log(`Registering device ID: ${deviceId} as a test device`);
      }
      
      const testIds = deviceId 
        ? [deviceId, 'EMULATOR'] 
        : ['EMULATOR'];
        
      // Add common emulator IDs
      if (Platform.OS === 'android') {
        testIds.push('emulator');
      } else if (Platform.OS === 'ios') {
        testIds.push('Simulator');
      }
      
      await MobileAds().setRequestConfiguration({
        testDeviceIdentifiers: testIds,
      });
      
      console.log('Test device registration completed');
      console.log('You should now see test ads on this device/emulator');
      console.log('Important: For iOS, check console for device ID');
      console.log('For Android, check logcat for a message like:');
      console.log('Use RequestConfiguration.Builder.setTestDeviceIds(Arrays.asList("33BE2250B43518CCDA7DE426D04EE231"))');
    } catch (error) {
      console.error('Failed to register test device:', error);
    }
  }

  // Last time the rewarded ad was shown
  private lastRewardedAdShownTime = 0;
  
  /**
   * Mark when a rewarded ad was shown to manage frequency
   */
  private markRewardedAdShown(): void {
    this.lastRewardedAdShownTime = Date.now();
  }
}

export default AdMobService; 