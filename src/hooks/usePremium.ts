import { useState, useEffect, useCallback } from 'react';
import { ENTITLEMENTS } from '../services/RevenueCatService';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { CustomerInfoUpdateListener } from '@revenuecat/purchases-typescript-internal';

type PremiumStatus = {
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  loading: boolean;
  checkPremiumStatus: () => Promise<boolean>;
};

/**
 * Hook to check and manage premium status
 */
export const usePremium = (): PremiumStatus => {
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Check if customer has premium access
  const hasPremiumEntitlement = (info: CustomerInfo): boolean => {
    return info.entitlements.active[ENTITLEMENTS.premium] !== undefined;
  };

  // Function to check premium status
  const checkPremiumStatus = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const premium = hasPremiumEntitlement(info);
      setIsPremium(premium);
      return premium;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check premium status on component mount
  useEffect(() => {
    checkPremiumStatus();

    // Set up a listener for purchases updates
    const purchasesUpdatedListener: CustomerInfoUpdateListener = (info) => {
      setCustomerInfo(info);
      setIsPremium(hasPremiumEntitlement(info));
    };

    Purchases.addCustomerInfoUpdateListener(purchasesUpdatedListener);

    return () => {
      // Remove the listener when the component unmounts
      Purchases.removeCustomerInfoUpdateListener(purchasesUpdatedListener);
    };
  }, [checkPremiumStatus]);

  return {
    isPremium,
    customerInfo,
    loading,
    checkPremiumStatus
  };
}; 