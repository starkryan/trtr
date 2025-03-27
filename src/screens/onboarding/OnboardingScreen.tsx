import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Linking, StatusBar, ActivityIndicator, ImageBackground, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../../store/useLanguageStore';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/authContext';
import { MotiView } from 'moti';

import { BannerAdSize } from 'react-native-google-mobile-ads';
import Toast from "toastify-react-native"
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import messaging from '@react-native-firebase/messaging';

// Import background image
const bgImage = require('../../../assets/bg.jpeg');

// Onboarding steps
enum OnboardingStep {
  GET_STARTED = 0,
  LANGUAGE_SELECTION = 1,
  USER_ENTRY = 2
}

export const OnboardingScreen = () => {
  const { i18n } = useTranslation();
  const { setLanguage } = useLanguageStore();
  const { login } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.GET_STARTED);
  const insets = useSafeAreaInsets(); // Get safe area insets
  
  // Reference to track mounting state
  const isMountedRef = React.useRef(false);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(50)).current;

  const languages = [
    {
      code: 'en',
      name: 'English',
      flag: '🇺🇸',
      nativeName: 'English',
      accent: '#3B82F6', // Blue
      bgClass: 'bg-blue-500/20 border-blue-500/40',
      textClass: 'text-blue-400',
    },
    {
      code: 'hi',
      name: 'हिंदी',
      flag: '🇮🇳',
      nativeName: 'Hindi',
      accent: '#EC4899', // Pink
      bgClass: 'bg-pink-500/20 border-pink-500/40',
      textClass: 'text-pink-400',
    },
    {
      code: 'es',
      name: 'Español',
      flag: '🇪🇸',
      nativeName: 'Spanish',
      accent: '#10B981', // Emerald
      bgClass: 'bg-emerald-500/20 border-emerald-500/40',
      textClass: 'text-emerald-400',
    },
  ];

  // Run once on mount only
  React.useEffect(() => {
    isMountedRef.current = true;
    
    if (isMountedRef.current) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        })
      ]).start();
    }

    return () => {
      isMountedRef.current = false;
      // Explicitly stop animations on unmount
      fadeAnim.stopAnimation();
      translateY.stopAnimation();
    };
  }, []);

  // New animation effect for step changes only
  React.useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Only animate when changing steps
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, [currentStep]);

  const handleGetStarted = () => {
    setCurrentStep(OnboardingStep.LANGUAGE_SELECTION);
  };

  const handleLanguageSelect = async (langCode: string) => {
    try {
      setSelectedLanguage(langCode);

      // Change language immediately
      await i18n.changeLanguage(langCode);
      setLanguage(langCode);

      // Move to the next step
      setCurrentStep(OnboardingStep.USER_ENTRY);
    } catch (error) {
      console.error('Error setting language:', error);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (isLoading) return; // Prevent multiple attempts
    
    try {
      setIsLoading(true);
      
      // Login and mark onboarding as completed
      await login();
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      
      // For Android, check and request notification permissions
      if (Platform.OS === 'android') {
        try {
          let permissionStatus;
          
          if (Platform.Version >= 33) {
            // For Android 13+ (API level 33+), need to use POST_NOTIFICATIONS permission
            const postNotificationsPermission = 'android.permission.POST_NOTIFICATIONS';
            
            // First check if permission is already granted
            permissionStatus = await check(postNotificationsPermission as any);
            
            // Request if not granted
            if (permissionStatus !== RESULTS.GRANTED) {
              permissionStatus = await request(postNotificationsPermission as any);
            }
            
            // Show appropriate toast based on result
            if (permissionStatus === RESULTS.GRANTED) {
              Toast.success('Notifications enabled!');
            } else if (permissionStatus === RESULTS.DENIED) {
              Toast.warn('Notification permissions denied');
            } else if (permissionStatus === RESULTS.BLOCKED) {
              Toast.error('Notifications blocked. Please enable in settings.');
            }
          }
          
          // Get FCM token if permission was granted
          if (permissionStatus === RESULTS.GRANTED) {
            const fcmToken = await messaging().getToken();
            console.log('FCM Token:', fcmToken);
          }
        } catch (error) {
          console.error('Error handling notification permissions:', error);
        }
      } 
      
      // Navigate to main app regardless of permission result
      navigation.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      });
    } catch (error) {
      console.error('Error during login:', error);
      setIsLoading(false);
      Toast.error('Login failed. Please try again.');
    }
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://www.luvsab.com/privacy-policy');
  };

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Render the Get Started screen
  const renderGetStartedScreen = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 1000 }}
      className="flex-1 justify-center items-center"
    >
      <View className="items-center mb-10">
        <MotiView
          from={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'timing', duration: 800, delay: 300 }}
        >
          <View className="flex-row items-center justify-center mb-4">
            <Text className="text-6xl">❤️</Text>
            <Text className="text-8xl font-bold text-pink-500">sab</Text>
          </View>

          <View className="relative">
            <Text className="text-white/70 text-center text-lg mb-8 max-w-xs">
              <Text className="relative">
                Connect
                <Svg
                  width="100"
                  height="8"
                  className="absolute -bottom-1 left-0"
                  viewBox="0 0 100 8"
                >
                  <Path
                    d="M0,5 Q25,0 50,5 T100,5"
                    stroke="#FF69B4"
                    strokeWidth="2"
                    fill="none"
                  />
                </Svg>
              </Text>
              {" "}with characters that match your interests and preferences
            </Text>
          </View>
        </MotiView>
      </View>

      <MotiView
        from={{ translateY: 30, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'timing', duration: 800, delay: 600 }}
      >
        <TouchableOpacity
          onPress={handleGetStarted}
          className="bg-white/20 px-8 py-4 rounded-full border-2 border-white/60 shadow-lg"
          style={{
            elevation: 10, // For Android shadow
          }}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-lg">Get Started</Text>
        </TouchableOpacity>
      </MotiView>

      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 800, delay: 900 }}
        style={{
          position: 'absolute',
          bottom: 10 + insets.bottom, // Add insets to bottom
          width: '100%',
          alignItems: 'center',
          marginBottom: 10
        }}
      >
        <TouchableOpacity
          onPress={handlePrivacyPolicy}
          activeOpacity={0.7}
          className="py-2 px-4 bg-white/10 rounded-full mb-28"
        >
          <Text className="text-white/70 text-sm font-semibold">
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </MotiView>
    </MotiView>
  );

  // Render the Language Selection screen
  const renderLanguageSelectionScreen = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 800 }}
      className="flex-1 justify-center items-center px-6"
    >
      {/* Header */}
      <MotiView
        from={{ translateY: -20, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'timing', duration: 800, delay: 200 }}
        className="mb-8 items-center"
      >
        <Text className="text-3xl font-bold text-white mb-2">
          Choose Your Language
        </Text>
        <Text className="text-white/70 text-center text-base">
          Select the language you prefer to use
        </Text>
      </MotiView>

      {/* Language Selection */}
      <View className="w-full mb-10">
        <View className="flex flex-row flex-wrap justify-center gap-4">
          {languages.map((lang, index) => (
            <MotiView
              key={lang.code}
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{
                type: 'timing',
                duration: 700,
                delay: 300 + (index * 200)
              }}
              className="w-[46%]"
            >
              <TouchableOpacity
                onPress={() => handleLanguageSelect(lang.code)}
                activeOpacity={0.85}
                disabled={isLoading}
                className={`${lang.bgClass} backdrop-blur-md rounded-2xl border p-4 
                  ${selectedLanguage === lang.code ? 'border-opacity-100' : 'border-opacity-50'}`}
              >
                <View className="items-center">
                  <Text className="text-5xl mb-2">{lang.flag}</Text>

                  <Text className={`${lang.textClass} font-bold text-lg mb-1`}>
                    {lang.name}
                  </Text>

                  <Text className="text-white/70 text-sm">
                    {lang.nativeName}
                  </Text>

                  {selectedLanguage === lang.code && (
                    <View className="mt-2 bg-white/20 rounded-full p-1">
                      <Icon name="check-circle" size={18} color="white" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </MotiView>
          ))}
        </View>
      </View>

      {/* Back Button */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 800, delay: 800 }}
      >
        <TouchableOpacity
          onPress={() => setCurrentStep(OnboardingStep.GET_STARTED)}
          className="mt-4 flex-row items-center"
        >
          <Icon name="arrow-left" size={20} color="white" />
          <Text className="text-white ml-2">Back</Text>
        </TouchableOpacity>
      </MotiView>
    </MotiView>
  );

  // Render the User Entry screen
  const renderUserEntryScreen = () => (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 800 }}
      className="flex-1 justify-center items-center px-6"
    >
      <MotiView
        from={{ translateY: -20, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'timing', duration: 800 }}
        className="items-center mb-8"
      >
        <Text className="text-3xl font-bold text-white mb-2">
          Almost Done!
        </Text>
        <Text className="text-white/70 text-center text-base max-w-xs">
          Press continue to start exploring characters that match your interests
        </Text>
      </MotiView>

      <MotiView
        from={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, delay: 300 }}
        className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-lg border border-white/30 items-center justify-center mb-8"
      >
        <Text className="text-7xl">🚀</Text>
      </MotiView>

      <MotiView
        from={{ translateY: 30, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'timing', duration: 800, delay: 600 }}
        className="w-full items-center"
      >
        <TouchableOpacity
          onPress={handleCompleteOnboarding}
          className="bg-white/10 px-8 py-4 rounded-full w-60 items-center border-2 border-white/60"
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">
              Continue
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCurrentStep(OnboardingStep.LANGUAGE_SELECTION)}
          className=" mt-4 flex-row items-center"
        >
          <Icon name="arrow-left" size={20} color="white" />
          <Text className="text-white ml-2 font-semibold">Back to Language</Text>
        </TouchableOpacity>
      </MotiView>

      {/* Banner Ad */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 800, delay: 900 }}
        style={{
          position: 'absolute',
          bottom: 10 + insets.bottom,
        }}
      >
       
      </MotiView>
    </MotiView>
  );

  // Render the appropriate content based on the current step
  const renderContent = () => {
    switch (currentStep) {
      case OnboardingStep.GET_STARTED:
        return renderGetStartedScreen();
      case OnboardingStep.LANGUAGE_SELECTION:
        return renderLanguageSelectionScreen();
      case OnboardingStep.USER_ENTRY:
        return renderUserEntryScreen();
      default:
        return null;
    }
  };

  return (
    <View className="flex-1">
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent
      />
      <ImageBackground
        source={bgImage}
        className="flex-1"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Dark overlay with gradient for better text visibility */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)']}
          className="absolute inset-0"
        />

        <View style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right
        }}>
          <Animated.View
            style={{
              flex: 1,
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }}
          >
            {renderContent()}
          </Animated.View>
        </View>
      </ImageBackground>

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center z-50">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text className="text-white mt-3 text-base font-semibold">
            Setting up your experience...
          </Text>
        </View>
      )}
    </View>
  );
};

