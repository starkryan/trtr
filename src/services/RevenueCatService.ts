import Purchases, { CustomerInfo, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { getCurrentUser } from './FirebaseService';

// RevenueCat API keys for each platform
const API_KEYS = {
  android: 'goog_OrjHEGHAjHuMBeRMGiCkqeqBUYQ', // Replace with your actual RevenueCat API key
  ios: 'your_revenuecat_ios_api_key', // Replace with your actual RevenueCat API key
};

// Offering identifiers - must match what you set up in RevenueCat dashboard
export const OFFERING_IDENTIFIER = 'default';

// Entitlement identifiers - must match what you set up in RevenueCat dashboard
export const ENTITLEMENTS = {
  premium: 'legamera',
};

class RevenueCatService {
  private static instance: RevenueCatService;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): RevenueCatService {
    if (!RevenueCatService.instance) {
      RevenueCatService.instance = new RevenueCatService();
    }
    return RevenueCatService.instance;
  }

  /**
   * Initialize RevenueCat SDK
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const apiKey = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;

      if (!apiKey) {
        console.error('RevenueCat API key is not set for this platform');
        return;
      }

      // Set the debug log level for development
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Get Firebase user ID if available
      const userId = getCurrentUser();

      // Configure RevenueCat with the API key and user ID
      await Purchases.configure({
        apiKey,
        appUserID: userId, // Use Firebase user ID if available, otherwise null for anonymous ID
      });

      this.initialized = true;
      console.log('RevenueCat SDK initialized successfully', userId ? `for user ${userId}` : 'with anonymous ID');
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
    }
  }

  /**
   * Identify a user with RevenueCat
   * Call this when a user logs in to your app
   */
  public async identifyUser(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
      console.log('User identified with RevenueCat:', userId);
    } catch (error) {
      console.error('Error identifying user with RevenueCat:', error);
    }
  }

  /**
   * Get the current offering packages
   */
  public async getOfferings(): Promise<PurchasesPackage[] | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.availablePackages || null;
    } catch (error) {
      console.error('Error getting offerings:', error);
      return null;
    }
  }

  /**
   * Purchase a package
   */
  public async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('Error purchasing package:', error);
      }
      return null;
    }
  }

  /**
   * Check if user has premium access
   */
  public async checkPremiumAccess(): Promise<boolean> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return this.hasPremiumEntitlement(customerInfo);
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  }

  /**
   * Restore purchases
   */
  public async restorePurchases(): Promise<CustomerInfo | null> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return null;
    }
  }

  /**
   * Check if customer info contains the premium entitlement
   */
  private hasPremiumEntitlement(customerInfo: CustomerInfo): boolean {
    return customerInfo.entitlements.active[ENTITLEMENTS.premium] !== undefined;
  }
}

export default RevenueCatService; 