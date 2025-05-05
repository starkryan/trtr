import React, { useEffect, useState } from 'react';
import "./global.css"
import { SafeAreaProvider } from "react-native-safe-area-context";
import ToastManager from 'toastify-react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import './src/locales/i18n';
import { StatusBar, StyleSheet, Platform, View, AppState, AppStateStatus, NativeModules } from 'react-native';
import { navigationRef } from './src/utils/navigationService';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { AuthProvider } from './src/hooks/authContext';
import messaging, { 
  FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import NotificationService from './src/services/NotificationService';

import SplashScreen from './src/components/SplashScreen';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useCoinStore } from './src/store/useCoinStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';
import { MobileAds } from 'react-native-google-mobile-ads';
import AdMobService from './src/services/AdMobService';



// Define global type for our app-specific globals
declare global {
  var isEmulator: boolean;
}

// For React Native Firebase, the default app is automatically initialized
const app = getApp();
const messagingInstance = messaging();

// Check if running in an emulator - this will help with debugging
if (Platform.OS === 'android') {
  // Get Android build properties to detect emulator
  const { isEmulator } = NativeModules.DeviceInfo || {};
  if (isEmulator) {
    console.log('Running in Android Emulator - using test ad IDs');
    // Set global flag to use in components
    global.isEmulator = true;
  } else {
    console.log('Running on physical Android device');
    global.isEmulator = false;
    
    // Log whether we're in development or production mode
    if (__DEV__) {
      console.log('Running in DEVELOPMENT mode - using test ad IDs');
    } else {
      console.log('Running in PRODUCTION mode - using REAL ad IDs');
    }
  }
}

// Register background handler correctly
messaging().setBackgroundMessageHandler(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
  // Use data payload for content
  const title = remoteMessage.data?.title;
  const body = remoteMessage.data?.body;

  // Ensure title and body are strings before displaying
  if (typeof title === 'string' && typeof body === 'string') {
    await notifee.displayNotification({
      title: title,
      body: body,
      android: {
        channelId: 'default',
        smallIcon: 'ic_notification', // make sure this drawable exists
        color: '#EC4899',
        sound: 'default',
        vibrationPattern: [300, 500, 300, 500], // ON, OFF, ON, OFF pattern (ms)
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
      data: remoteMessage.data, // Pass along any other data
    });
  } else {
     console.warn("Received background message without title/body in data payload:", remoteMessage.data);
  }
});

// Create a custom theme with dark colors for better contrast
const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#111827',
    card: '#1F2937',
    text: '#FFFFFF',
    border: 'transparent',
  },
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  const [adsInitialized, setAdsInitialized] = useState(false);
  const [appOpenAdReady, setAppOpenAdReady] = useState(false);
  const initializeCoins = useCoinStore((state) => state.initializeCoins);
  const addCoins = useCoinStore((state) => state.addCoins);

  useEffect(() => {
    // Initialize Firebase Auth
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseInitialized(!!user);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Initialize AdMob
    const initializeAdMob = async () => {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
      
      try {
        // Initialize MobileAds SDK first with the app ID
        await MobileAds().initialize();
        console.log('MobileAds SDK initialized successfully');
        
        // Initialize AdMob service (which handles the SDK initialization)
        const adMobService = AdMobService.getInstance();
        await adMobService.initialize();
        
        // Set initial volume settings - default is full volume unless app has custom audio settings
        // You can integrate this with your app's audio system
        // For example, if your app has a sound settings store:
        // const soundEnabled = await AsyncStorage.getItem('@sound_enabled');
        // adMobService.setAppMuted(soundEnabled === 'false');
        
        // Setup ad revenue callback for analytics
        adMobService.setAdRevenueCallback((event) => {
          // You can integrate with your analytics system here
          console.log(`Ad revenue: ${event.value} ${event.currency}`);
          
          // Example: if you use Firebase Analytics
          // analytics().logEvent('ad_impression_revenue', {
          //   value: event.value,
          //   currency: event.currency,
          //   precision: event.precision,
          //   ad_unit_id: event.adUnitId // if available
          // });
        });
        
        // Preload all ad types
        await adMobService.loadAppOpenAd(() => {
          console.log('App open ad closed');
          // Load the next one after this one closes
          adMobService.loadAppOpenAd();
        });
        
        // The AdMobService will automatically preload all ad types during initialization
        
        setAdsInitialized(true);
        setAppOpenAdReady(true);
        console.log('AdMob initialized successfully with all ad units');
      } catch (error) {
        console.error('Failed to initialize AdMob:', error);
      }
    };

    initializeAdMob();
  }, []);

  useEffect(() => {
    // Initialize FCM and notifications
    const initializeNotifications = async () => {
      try {
        // Initialize NotificationService singleton
        const notificationService = NotificationService.getInstance();

        // Request permission for notifications
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          // Get the FCM token
          const fcmToken = await messaging().getToken();
          console.log('FCM Token:', fcmToken);

          // Create default notification channel
          await notifee.createChannel({
            id: 'default',
            name: 'Default Channel',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibration: true,
            vibrationPattern: [300, 500, 300, 500], // ON, OFF, ON, OFF pattern (ms)
            badge: true
          });

          // Set up foreground message handler
          const unsubscribe = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
            // Use data payload for content
            const title = remoteMessage.data?.title;
            const body = remoteMessage.data?.body;

            // Ensure title and body are strings before displaying
            if (typeof title === 'string' && typeof body === 'string') {
              await notifee.displayNotification({
                title: title,
                body: body,
                android: {
                  channelId: 'default',
                  smallIcon: 'ic_notification', // make sure this drawable exists
                  color: '#EC4899',
                  sound: 'default',
                  vibrationPattern: [300, 500, 300, 500], // ON, OFF, ON, OFF pattern (ms)
                  importance: AndroidImportance.HIGH,
                  pressAction: {
                    id: 'default',
                  },
                },
                data: remoteMessage.data, // Pass along any other data
              });
            } else {
               console.warn("Received foreground message without title/body in data payload:", remoteMessage.data);
            }
          });

          return () => unsubscribe();
        }
      } catch (error) {
        console.error('Failed to initialize FCM:', error);
      }
    };

    if (Platform.OS === 'android') {
      initializeNotifications();
    }
  }, []);

  useEffect(() => {
    // Initialize app services
    const init = async () => {
      try {
        // Wait for Firebase to initialize
        if (!firebaseInitialized) return;

        // Initialize coins with better error handling
        try {
          const storedCoins = await AsyncStorage.getItem('@coins');
          if (!storedCoins) {
            // Give initial coins to new users
            await AsyncStorage.setItem('@coins', '10');
            addCoins(10);
          } else {
            await initializeCoins();
          }
        } catch (error) {
          console.error('Error initializing coins:', error);
          // Fallback: set default coins
          await AsyncStorage.setItem('@coins', '10');
          addCoins(10);
        }

        // Wait for any initialization tasks
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };

    init();
  }, [firebaseInitialized, initializeCoins, addCoins]);

  useEffect(() => {
    // NetInfo connectivity listener
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // Remove intrusive toast notifications
      // They're not necessary for normal app usage and can be annoying
      
      // if (state.isConnected) {
      //   Toast.success('You are connected to the internet');
      // } else {
      //   Toast.error('No internet connection');
      // }
      
      // Instead, just update internal state if needed
      // This is handled silently
      console.log('Network status changed:', state.isConnected ? 'connected' : 'disconnected');
    });

    return () => unsubscribe();
  }, []);

  // Handle splash screen animation finished
  const handleSplashFinish = () => {
    setShowSplash(false);
    
    // Show app open ad when splash screen finishes (if on Android)
    if (Platform.OS === 'android' && adsInitialized && appOpenAdReady) {
      // Add a slight delay to ensure the app is fully loaded before showing ad
      setTimeout(() => {
        console.log('Attempting to show app open ad after splash screen...');
        AdMobService.getInstance().showAppOpenAd().then(shown => {
          if (!shown) {
            console.log('App open ad not available to show after splash');
          } else {
            console.log('App open ad shown successfully after splash');
          }
        }).catch(err => {
          console.log('Failed to show app open ad after splash:', err);
        });
      }, 2000); // Longer delay to ensure everything is ready
    }
  };

  // Example of syncing app audio settings with ad volume
  const updateAdVolumeFromAppSettings = (volume: number, muted: boolean) => {
    const adMobService = AdMobService.getInstance();
    adMobService.setAppVolume(volume);
    adMobService.setAppMuted(muted);
  };

  // Clean up resources when app is closed or backgrounded
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is going to background, clean up resources
        console.log('App going to background, cleaning up ad resources');
        AdMobService.getInstance().cleanup();
      } else if (nextAppState === 'active') {
        // App is coming to foreground, reinitialize and potentially show ad
        console.log('App returning to foreground');
        if (adsInitialized) {
          console.log('Reinitializing ads after returning to foreground');
          // Just reinitialize when returning to the app - this handles cache refresh internally
          AdMobService.getInstance().initialize().then(() => {
            // Show app open ad when returning to the app (with probability to avoid annoying users)
            if (Math.random() < 0.3) { // 30% chance to show ad when returning to app
              console.log('Attempting to show app open ad after app return');
              AdMobService.getInstance().showAppOpenAd();
            }
          });
        }
      }
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      // Clean up on component unmount
      AdMobService.getInstance().cleanup();
    };
  }, [adsInitialized]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
      <View style={styles.container}>
        <AuthProvider>
          <NavigationContainer
            ref={navigationRef}
            theme={MyTheme}
            onStateChange={() => {
              // When navigation state changes, consider showing app open ads
              // but only when app is already initialized
              if (!showSplash && Platform.OS === 'android' && Math.random() < 0.2) { // 20% chance
                AdMobService.getInstance().showAppOpenAd().catch(err => {
                  console.log('Failed to show app open ad on navigation:', err);
                });
              }
            }}
          >
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
        <ToastManager
          height={60}
          width={300}
          duration={3000}
          animationStyle="slideInOut"
          position="top"
          style={{
            backgroundColor: '#1F2937',
            borderRadius: 12,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
          textStyle={{
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: '500',
          }}
        />
      </View>
      {showSplash && <SplashScreen onAnimationFinish={handleSplashFinish} />}
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
});

export default App;