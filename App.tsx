import React, { useEffect, useState, useCallback } from 'react';
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
  FirebaseMessagingTypes
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import NotificationService from './src/services/NotificationService';


import SplashScreen from './src/components/SplashScreen';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useCoinStore } from './src/store/useCoinStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebase, getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';
import { MobileAds } from 'react-native-google-mobile-ads';
import AdMobService from './src/services/AdMobService';
import RevenueCatService from './src/services/RevenueCatService';
import Purchases from 'react-native-purchases';
import IncomingCall from './src/components/IncomingCall'; // Import the new component
import { getFeaturedCharacters } from './src/api/services/character'; // Import character service
import { getMediaVideoUrls } from './src/api/services/media'; // Import new media service
import Sound from 'react-native-sound'; // Import react-native-sound
// import axios from 'axios'; // Remove axios import

// Define global type for our app-specific globals
declare global {
  var isEmulator: boolean;
}

// For React Native Firebase, the default app is automatically initialized
const app = getApp();
const messagingInstance = firebase.messaging();

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
firebase.messaging().setBackgroundMessageHandler(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
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
  const [purchasesInitialized, setPurchasesInitialized] = useState(false);
  const initializeCoins = useCoinStore((state) => state.initializeCoins);
  const addCoins = useCoinStore((state) => state.addCoins);
  const [isNetworkConnected, setIsNetworkConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const appState = React.useRef(AppState.currentState);
  const isForeground = React.useRef(true);

  // State for incoming call feature
  const [incomingCharacter, setIncomingCharacter] = useState<any>(null); // State to store the fetched character
  const ringtoneSound = React.useRef<Sound | null>(null); // Ref to hold the Sound instance
  const [fetchedVideoUrls, setFetchedVideoUrls] = useState<string[]>([]); // State to store fetched video URLs
  const [showIncomingCall, setShowIncomingCall] = useState(false); // New state to control incoming call display
  const [loadingVideoUrls, setLoadingVideoUrls] = useState(true); // State for loading video URLs

  // Function to trigger the incoming call
  const triggerIncomingCall = useCallback(async () => {
    if (incomingCharacter || loadingVideoUrls) {
      // Already showing a call or videos are still loading
      return;
    }

    try {
      const characters = await getFeaturedCharacters();
      if (characters && characters.length > 0) {
        const randomCharacter = characters[Math.floor(Math.random() * characters.length)];
        setIncomingCharacter(randomCharacter);

        // Load the ringtone sound
        Sound.setCategory('Playback');
        const sound = new Sound('incoming_call.mp3', Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.log('Failed to load the sound', error);
            return;
          }
          console.log('Ringtone loaded successfully');
          ringtoneSound.current = sound;
          ringtoneSound.current.setNumberOfLoops(-1);
          ringtoneSound.current.play((success) => {
            if (success) {
              console.log('Ringtone playing');
            } else {
              console.log('Ringtone playback failed due to audio decoding errors');
            }
          });
        });

        setShowIncomingCall(true); // Show the IncomingCall component
      } else {
        console.warn('No featured characters found to display for incoming call.');
      }
    } catch (error) {
      console.error('Error fetching featured characters for incoming call:', error);
    }
  }, [incomingCharacter, loadingVideoUrls]);

  // Function to dismiss the incoming call UI (without navigation)
  const dismissIncomingCallUI = useCallback(() => {
    setShowIncomingCall(false);
    setIncomingCharacter(null);
    if (ringtoneSound.current) {
      ringtoneSound.current.stop();
      ringtoneSound.current.release();
      ringtoneSound.current = null;
    }
  }, []);

  // Function to handle accepting the incoming call and navigating
  const handleAcceptIncomingCall = useCallback(() => {
    dismissIncomingCallUI(); // Dismiss the incoming call UI
    if (navigationRef.current && incomingCharacter && fetchedVideoUrls.length > 0) {
      navigationRef.current.navigate('VideoCallScreen', {
        videoUrls: fetchedVideoUrls,
        callerName: incomingCharacter.name,
        callerImage: incomingCharacter.avatar,
      });
    } else {
      console.warn('Navigation failed: Missing navigationRef, incomingCharacter, or videoUrls.');
    }
  }, [dismissIncomingCallUI, incomingCharacter, fetchedVideoUrls]);

  useEffect(() => {
    // Initialize Firebase Auth
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseInitialized(!!user);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Fetch video URLs from backend
    const fetchVideos = async () => {
      try {
        const response = await getMediaVideoUrls();
        setFetchedVideoUrls(response);
        console.log('Fetched video URLs:', response);
      } catch (error) {
        console.error('Error fetching video URLs:', error);
        setFetchedVideoUrls([
          'https://leome.b-cdn.net/videos/video1.mp4',
          'https://leome.b-cdn.net/videos/video10.mp4',
          'https://leome.b-cdn.net/videos/video11.mp4',
          'https://leome.b-cdn.net/videos/video12.mp4',
          'https://leome.b-cdn.net/videos/video13.mp4',
          'https://leome.b-cdn.net/videos/video14.mp4',
          'https://leome.b-cdn.net/videos/video15.mp4',
          'https://leome.b-cdn.net/videos/video16.mp4',
          'https://leome.b-cdn.net/videos/video2.mp4',
          'https://leome.b-cdn.net/videos/video3.mp4',
          'https://leome.b-cdn.net/videos/video4.mp4',
          'https://leome.b-cdn.net/videos/video5.mp4',
          'https://leome.b-cdn.net/videos/video6.mp4',
          'https://leome.b-cdn.net/videos/video7.mp4',
          'https://leome.b-cdn.net/videos/video8.mp4',
          'https://leome.b-cdn.net/videos/video9.mp4',
        ]);
      } finally {
        setLoadingVideoUrls(false);
      }
    };

    fetchVideos();
  }, []);

  useEffect(() => {
    // Initialize AdMob
    const initializeAdMob = async () => {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

      try {
        await MobileAds().initialize();
        console.log('MobileAds SDK initialized successfully');

        const adMobService = AdMobService.getInstance();
        await adMobService.initialize();

        adMobService.setAdRevenueCallback((event) => {
          console.log(`Ad revenue: ${event.value} ${event.currency}`);
        });

        await adMobService.loadAppOpenAd(() => {
          console.log('App open ad closed');
          adMobService.loadAppOpenAd();
        });

        setAdsInitialized(true);
        setAppOpenAdReady(true);
        console.log('AdMob initialized successfully with all ad units');
      } catch (error) {
        console.error('Error initializing AdMob:', error);
      }
    };

    initializeAdMob();
  }, []);

  useEffect(() => {
    // Initialize RevenueCat
    const initializeRevenueCat = async () => {
      try {
        const revenueCatService = RevenueCatService.getInstance();
        await revenueCatService.initialize();

        Purchases.addCustomerInfoUpdateListener((info) => {
          console.log('RevenueCat customer info updated:',
            info.activeSubscriptions.length > 0 ? 'Has active subscriptions' : 'No active subscriptions');
        });

        console.log('RevenueCat initialized successfully');
      } catch (error) {
        console.error('Error initializing RevenueCat:', error);
      }
    };

    initializeRevenueCat();
  }, []);

  useEffect(() => {
    // Initialize FCM and notifications
    const initializeNotifications = async () => {
      try {
        const notificationService = NotificationService.getInstance();

        const authStatus = await firebase.messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          const fcmToken = await firebase.messaging().getToken();
          console.log('FCM Token:', fcmToken);

          await notifee.createChannel({
            id: 'default',
            name: 'Default Channel',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibration: true,
            vibrationPattern: [300, 500, 300, 500],
            badge: true
          });

          const unsubscribe = firebase.messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
            const title = remoteMessage.data?.title;
            const body = remoteMessage.data?.body;

            if (typeof title === 'string' && typeof body === 'string') {
              await notifee.displayNotification({
                title: title,
                body: body,
                android: {
                  channelId: 'default',
                  smallIcon: 'ic_notification',
                  color: '#EC4899',
                  sound: 'default',
                  vibrationPattern: [300, 500, 300, 500],
                  importance: AndroidImportance.HIGH,
                  pressAction: {
                    id: 'default',
                  },
                },
                data: remoteMessage.data,
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
        if (!firebaseInitialized) return;

        try {
          const storedCoins = await AsyncStorage.getItem('@coins');
          if (!storedCoins) {
            await AsyncStorage.setItem('@coins', '10');
            addCoins(10);
          } else {
            await initializeCoins();
          }
        } catch (error) {
          console.error('Error initializing coins:', error);
          await AsyncStorage.setItem('@coins', '10');
          addCoins(10);
        }

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
      console.log('Network status changed:', state.isConnected ? 'connected' : 'disconnected');
    });

    return () => unsubscribe();
  }, []);

  // Handle splash screen animation finished
  const handleSplashFinish = () => {
    setShowSplash(false);

    // Show app open ad when app finishes splash screen if available
    if (appOpenAdReady && Platform.OS === 'android') {
      AdMobService.getInstance().showAppOpenAd().catch(err => {
        console.log('Failed to show app open ad after splash:', err);
      });
    }
  };

  // Clean up ringtone on component unmount
  useEffect(() => {
    return () => {
      if (ringtoneSound.current) {
        ringtoneSound.current.release();
        ringtoneSound.current = null;
      }
    };
  }, []);

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
        console.log('App going to background, cleaning up ad resources');
        AdMobService.getInstance().cleanup();
        if (ringtoneSound.current) {
          ringtoneSound.current.stop();
        }
      } else if (nextAppState === 'active') {
        console.log('App returning to foreground');
        if (adsInitialized) {
          console.log('Reinitializing ads after returning to foreground');
          AdMobService.getInstance().initialize().then(() => {
            if (Math.random() < 0.3) {
              console.log('Attempting to show app open ad after app return');
              AdMobService.getInstance().showAppOpenAd();
            }
          });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
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
              if (!showSplash && Platform.OS === 'android' && Math.random() < 0.2) {
                AdMobService.getInstance().showAppOpenAd().catch(err => {
                  console.log('Failed to show app open ad on navigation:', err);
                });
              }
            }}
          >
            <AppNavigator triggerIncomingCall={triggerIncomingCall} />
          </NavigationContainer>
        </AuthProvider>
        <ToastManager
          height={60}
          width={300}
          duration={3000}
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
      {showIncomingCall && incomingCharacter && fetchedVideoUrls.length > 0 && (
        <IncomingCall
          videoUrls={fetchedVideoUrls} // These are passed but not used by IncomingCall itself now
          callerName={incomingCharacter.name}
          callerImage={incomingCharacter.avatar}
          onAccept={handleAcceptIncomingCall} // Call the new handler for navigation
          onDecline={dismissIncomingCallUI} // Still dismisses the UI
        />
      )}
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
