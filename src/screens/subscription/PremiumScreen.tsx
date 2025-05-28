import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import RevenueCatService from '../../services/RevenueCatService';
import Toast from 'toastify-react-native';
import { useAuth } from '../../hooks/authContext';

// Import background image
const bgImage = require('../../../assets/bg.jpeg');

// Define benefit items
const premiumBenefits = [
  { icon: 'crown', title: 'Full Access' },
  { icon: 'lightning-bolt', title: 'Unlimited Chats' },
  { icon: 'block-helper', title: 'Ad-Free' },
  { icon: 'star', title: 'Priority Support' },
  { icon: 'shield-lock', title: 'Exclusive' },
];

type PremiumScreenProps = NativeStackScreenProps<RootStackParamList, 'Premium'>;

const ACCENT = '#E11D48'; // pink-600

const PremiumScreen: React.FC<PremiumScreenProps> = ({ navigation, route }) => {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isFromOnboarding, setIsFromOnboarding] = useState(false);
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();

  // Check if this screen was opened from onboarding
  useEffect(() => {
    if (route.params?.fromOnboarding) {
      setIsFromOnboarding(true);
    }
  }, [route.params]);

  // Load packages from RevenueCat
  useEffect(() => {
    const loadOfferings = async () => {
      try {
        setLoading(true);
        
        // Get the RevenueCat service instance
        const revenueCatService = RevenueCatService.getInstance();
        
        // Make sure RevenueCat is initialized
        await revenueCatService.initialize();
        
        // If user is logged in, identify them with RevenueCat using Firebase auth
        const authUser = await Purchases.getAppUserID();
        if (authUser) {
          // We'll use the RevenueCat user ID that was already assigned
          console.log('Using existing RevenueCat user ID:', authUser);
        }
        
        // Get available packages
        const offerings = await revenueCatService.getOfferings();
        
        if (offerings && offerings.length > 0) {
          setPackages(offerings);
          setSelectedPackage(offerings[0]); // Select the first package by default
        } else {
          console.warn('No offerings available');
        }
      } catch (error) {
        console.error('Error loading offerings:', error);
        Toast.error('Failed to load subscription options');
      } finally {
        setLoading(false);
      }
    };

    loadOfferings();
  }, []);

  // Handle subscription purchase
  const handlePurchase = async () => {
    if (!selectedPackage || purchasing) return;

    try {
      setPurchasing(true);
      
      // Get the RevenueCat service instance
      const revenueCatService = RevenueCatService.getInstance();
      
      // Purchase the selected package
      const customerInfo = await revenueCatService.purchasePackage(selectedPackage);
      
      if (customerInfo) {
        Toast.success('Subscription activated!');
        
        // If this was during onboarding, continue to main app
        if (isFromOnboarding) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Tabs' }],
          });
        } else {
          // Otherwise just go back
          navigation.goBack();
        }
      } else {
        // User may have cancelled purchase
        Toast.info('Purchase was not completed');
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error('Purchase error:', error);
        Toast.error('Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  // Handle restore purchases
  const handleRestore = async () => {
    if (restoring) return;

    try {
      setRestoring(true);
      
      // Get the RevenueCat service instance
      const revenueCatService = RevenueCatService.getInstance();
      
      // Restore purchases
      const customerInfo = await revenueCatService.restorePurchases();
      
      // Check if user has premium access
      const hasPremium = await revenueCatService.checkPremiumAccess();
      
      if (hasPremium) {
        Toast.success('Subscription restored!');
        
        // If this was during onboarding, continue to main app
        if (isFromOnboarding) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Tabs' }],
          });
        } else {
          // Otherwise just go back
          navigation.goBack();
        }
      } else {
        Toast.info('No active subscription found');
      }
    } catch (error) {
      console.error('Restore error:', error);
      Toast.error('Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  // Handle skipping subscription during onboarding
  const handleSkip = () => {
    if (isFromOnboarding) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      });
    } else {
      navigation.goBack();
    }
  };

  // Render a package option
  const renderPackageOption = (pkg: PurchasesPackage) => {
    const isSelected = selectedPackage?.identifier === pkg.identifier;
    const packageInfo = pkg.product;
    return (
      <TouchableOpacity
        key={pkg.identifier}
        activeOpacity={0.85}
        onPress={() => setSelectedPackage(pkg)}
        className={`flex-row items-center rounded-xl border-2 mb-3 px-4 py-4 ${
          isSelected
            ? 'border-pink-600 bg-pink-50'
            : 'border-white/10 bg-white/5'
        }`}
      >
        <View className="flex-1">
          <Text className={`font-semibold text-base mb-0.5 ${isSelected ? 'text-pink-700' : 'text-white'}`}>{packageInfo.title.replace('(Luvsab)', '')}</Text>
          <Text className={`text-xs mb-0.5 ${isSelected ? 'text-pink-600' : 'text-white/60'}`}>{packageInfo.description}</Text>
        </View>
        <View className={`w-6 h-6 rounded-full border-2 ml-3 items-center justify-center ${isSelected ? 'border-pink-600 bg-pink-600' : 'border-white bg-transparent'}`}>{isSelected && <Icon name="check" size={16} color="#fff" />}</View>
        <Text className={`ml-3 font-bold text-base ${isSelected ? 'text-pink-700' : 'text-white'}`}>{packageInfo.priceString}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-900">
      <ImageBackground
        source={bgImage}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
        imageStyle={{ opacity: 0.25 }}
      >
        <View className="absolute inset-0 bg-gray-900/80" />
      </ImageBackground>
      <View className="flex-1" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-3 mb-2">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-9 h-9 items-center justify-center rounded-full bg-black/20"
            hitSlop={10}
          >
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg">Premium</Text>
          <TouchableOpacity
            onPress={handleSkip}
            className="px-4 py-2 rounded-full bg-black/20"
            hitSlop={10}
          >
            <Text className="text-white font-semibold text-sm">Skip</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Benefits */}
          <View className="flex-row justify-between mt-4 mb-2">
            {premiumBenefits.map((b, i) => (
              <View key={i} className="items-center flex-1">
                <View className="bg-white rounded-full p-2 mb-1">
                  <Icon name={b.icon} size={20} color={ACCENT} />
                </View>
                <Text className="text-white text-xs font-medium text-center">{b.title}</Text>
              </View>
            ))}
          </View>
          {/* Plans */}
          <View className="mt-8">
            <Text className="text-white font-semibold text-base mb-3">Choose your plan</Text>
            {loading ? (
              <View className="items-center my-8">
                <ActivityIndicator color={ACCENT} size="large" />
              </View>
            ) : packages.length > 0 ? (
              <View>
                {packages.map(renderPackageOption)}
              </View>
            ) : (
              <View className="items-center my-8">
                <Icon name="alert-circle-outline" size={32} color="#fff" />
                <Text className="text-white mt-2">No plans available</Text>
              </View>
            )}
          </View>
        </ScrollView>
        {/* Sticky bottom actions */}
        <View className="px-5 pb-6 pt-2 bg-gray-900/95 rounded-t-2xl items-center">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePurchase}
            disabled={!selectedPackage || purchasing || loading}
            className={`w-full rounded-xl py-4 items-center mb-2 ${
              !selectedPackage || purchasing || loading ? 'bg-pink-300' : 'bg-pink-600'
            }`}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white font-bold text-base tracking-wide">Subscribe</Text>
            )}
          </TouchableOpacity>
          <View className="flex-row items-center mb-1">
            <TouchableOpacity onPress={handleRestore} disabled={restoring}>
              <Text className="text-pink-600 font-semibold text-sm opacity-90">{restoring ? 'Restoring...' : 'Restore'}</Text>
            </TouchableOpacity>
            <Text className="text-white opacity-30 mx-2">|</Text>
            <TouchableOpacity onPress={handleSkip}>
              <Text className="text-pink-600 font-semibold text-sm opacity-90">{isFromOnboarding ? 'Skip' : 'Maybe later'}</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-white opacity-40 text-xs text-center mt-1 mb-1">
            Subscriptions auto-renew unless canceled 24h before period ends. Cancel anytime in your account settings.
          </Text>
        </View>
      </View>
      {loading && (
        <View className="absolute inset-0 bg-black/40 items-center justify-center z-10">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
};

export default PremiumScreen;
