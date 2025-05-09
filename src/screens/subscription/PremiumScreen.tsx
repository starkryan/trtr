import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { LinearGradient } from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { MotiView } from 'moti';
import RevenueCatService from '../../services/RevenueCatService';
import Toast from 'toastify-react-native';
import { useAuth } from '../../hooks/authContext';

// Import background image
const bgImage = require('../../../assets/bg.jpeg');

// Define benefit items
const premiumBenefits = [
  { icon: 'crown', title: 'Full Access', description: 'Unlock all premium characters' },
  { icon: 'lightning-bolt', title: 'Unlimited Chats', description: 'No daily message limits' },
  { icon: 'block-helper', title: 'Ad-Free Experience', description: 'No more advertisements' },
  { icon: 'star', title: 'Priority Support', description: 'Get help when you need it' },
  { icon: 'shield-lock', title: 'Exclusive Features', description: 'Early access to new features' },
];

type PremiumScreenProps = NativeStackScreenProps<RootStackParamList, 'Premium'>;

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
        Toast.success('Subscription activated successfully!');
        
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
        Toast.success('Your subscription has been restored!');
        
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
  const renderPackageOption = (pkg: PurchasesPackage, index: number) => {
    const isSelected = selectedPackage?.identifier === pkg.identifier;
    const packageInfo = pkg.product;
    
    // Determine if this is the most popular plan
    const isMostPopular = pkg.identifier.includes('monthly') || pkg.identifier.includes('month');
    
    return (
      <MotiView
        key={pkg.identifier}
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: 300 + (index * 100), type: 'timing', duration: 400 }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedPackage(pkg)}
          className={`mb-4 p-4 rounded-xl border-2 ${isSelected ? 'border-pink-500' : 'border-white/20'} 
            ${isSelected ? 'bg-pink-500/10' : 'bg-black/30'}`}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-white font-bold text-lg">
                {packageInfo.title.replace('(Luvsab)', '')}
              </Text>
              
              <Text className="text-white/70 text-sm mt-1">
                {packageInfo.description}
              </Text>
              
              {/* Show price details */}
              <View className="mt-2">
                <Text className="text-white font-semibold text-lg">
                  {packageInfo.priceString}
                </Text>
              </View>
            </View>
            
            {/* Show selection indicator */}
            <View className={`h-6 w-6 rounded-full border-2 ${isSelected ? 'border-pink-500 bg-pink-500' : 'border-white/50'} justify-center items-center`}>
              {isSelected && <Icon name="check" size={14} color="#FFFFFF" />}
            </View>
          </View>
          
          {/* Most popular badge */}
          {isMostPopular && (
            <View className="absolute -top-2 -right-2 bg-yellow-500 px-2 py-1 rounded-md">
              <Text className="text-white text-xs font-bold">POPULAR</Text>
            </View>
          )}
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <View className="flex-1">
      <ImageBackground
        source={bgImage}
        className="flex-1"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Dark overlay with gradient for better text visibility */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.7)']}
          className="absolute inset-0"
        />

        <View style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right
        }}>
          <ScrollView
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Header Section */}
            <MotiView
              from={{ opacity: 0, translateY: -20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500 }}
              className="items-center my-8"
            >
              <View className="bg-pink-500/40 p-4 rounded-full mb-4">
                <Icon name="crown" size={32} color="#FFFFFF" />
              </View>
              <Text className="text-white font-bold text-3xl mb-1">
                Luvsab Premium
              </Text>
              <Text className="text-white/70 text-center text-base max-w-xs">
                Unlock the full experience with our premium subscription
              </Text>
            </MotiView>

            {/* Benefits Section */}
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 600, delay: 200 }}
              className="mb-8"
            >
              <Text className="text-white font-semibold text-lg mb-4">
                Premium Benefits
              </Text>
              
              {premiumBenefits.map((benefit, index) => (
                <MotiView
                  key={index}
                  from={{ opacity: 0, translateX: -20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ delay: 300 + (index * 100), type: 'timing', duration: 400 }}
                  className="flex-row items-center mb-4 bg-white/10 p-3 rounded-lg"
                >
                  <View className="bg-pink-500/30 p-2 rounded-full mr-3">
                    <Icon name={benefit.icon} size={20} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{benefit.title}</Text>
                    <Text className="text-white/70 text-sm">{benefit.description}</Text>
                  </View>
                </MotiView>
              ))}
            </MotiView>

            {/* Subscription Options */}
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 600, delay: 400 }}
              className="mb-8"
            >
              <Text className="text-white font-semibold text-lg mb-4">
                Choose Your Plan
              </Text>
              
              {loading ? (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator color="#FFFFFF" size="large" />
                  <Text className="text-white/70 mt-4">
                    Loading subscription options...
                  </Text>
                </View>
              ) : packages.length > 0 ? (
                <View>
                  {packages.map((pkg, index) => renderPackageOption(pkg, index))}
                </View>
              ) : (
                <View className="items-center justify-center py-8 bg-white/10 rounded-lg">
                  <Icon name="alert-circle-outline" size={32} color="#FFFFFF" />
                  <Text className="text-white text-center mt-2">
                    No subscription plans available
                  </Text>
                  <Text className="text-white/70 text-center text-sm mt-1">
                    Please try again later
                  </Text>
                </View>
              )}
            </MotiView>

            {/* Action Buttons */}
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 600, delay: 600 }}
              className="items-center mb-6"
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePurchase}
                disabled={!selectedPackage || purchasing || loading}
                className={`w-full py-4 rounded-xl mb-4 items-center ${
                  !selectedPackage || purchasing || loading ? 'bg-pink-500/40' : 'bg-pink-500'
                }`}
              >
                {purchasing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-white font-bold text-lg">
                    {loading ? 'Loading...' : 'Subscribe Now'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleRestore}
                disabled={restoring}
                className="mb-4"
              >
                {restoring ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-white/80 font-semibold">
                    Restore Purchases
                  </Text>
                )}
              </TouchableOpacity>

              {/* Skip during onboarding or Back button */}
              <TouchableOpacity activeOpacity={0.7} onPress={handleSkip}>
                <Text className="text-white/60">
                  {isFromOnboarding ? "Skip for now" : "Maybe later"}
                </Text>
              </TouchableOpacity>
            </MotiView>

            {/* Terms Info */}
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 600, delay: 700 }}
              className="mb-8"
            >
              <Text className="text-white/50 text-xs text-center">
                Subscriptions will automatically renew unless canceled within 24-hours before the end of the current period. You can cancel anytime with your iTunes/Google Play account settings. Any unused portion of a free trial will be forfeited if you purchase a subscription.
              </Text>
            </MotiView>
          </ScrollView>

          {/* Back button - only show if not from onboarding */}
          {!isFromOnboarding && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
              className="absolute top-6 left-5 bg-black/30 p-2 rounded-full"
              style={{ marginTop: insets.top }}
            >
              <Icon name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading overlay */}
        {loading && (
          <View className="absolute inset-0 bg-black/50 justify-center items-center">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text className="text-white mt-3 text-base font-semibold">
              Loading subscription options...
            </Text>
          </View>
        )}
      </ImageBackground>
    </View>
  );
};

export default PremiumScreen; 