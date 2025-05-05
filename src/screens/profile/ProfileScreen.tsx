import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, StatusBar, TextInput, Switch, Alert, Platform, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../hooks/authContext';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getCurrentUser } from '../../services/FirebaseService';
import Toast from 'toastify-react-native';
import NotificationService from '../../services/NotificationService';
import { check, request, RESULTS, openSettings, Permission } from 'react-native-permissions';
import messaging, {
  FirebaseMessagingTypes,
  getToken
} from '@react-native-firebase/messaging';
import { TabScreenProps } from '../../navigation/types';
import { resetRoot } from '../../utils/navigationService';
import { useCoinStore } from '../../store/useCoinStore';
import { useInterstitialAd } from '../../hooks/useAdMob';
import BannerAdComponent from '../../components/ads/BannerAdComponent';
import { BannerAdSize } from 'react-native-google-mobile-ads';

const DEFAULT_AVATAR = require('../../../assets/avatar.png');
const coinImage = require('../../../assets/coin.png');

// Hardcoded constants for app information
const APP_NAME = 'Luvsab';
const APP_VERSION = '1.0.4';

const NOTIFICATION_PERMISSION = 'android.permission.POST_NOTIFICATIONS' as Permission;

const PRIVACY_POLICY_URL = 'https://www.luvsab.com/privacy-policy';
const HELP_SUPPORT_URL = 'https://www.luvsab.com/support';

const SettingItem = ({
  icon,
  title,
  onPress,
  rightElement,
  description
}: {
  icon: string;
  title: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  description?: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center bg-white/5 rounded-2xl p-4 mb-3 border border-white/10 active:opacity-80"
    activeOpacity={0.7}
  >
    <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center">
      <Icon name={icon} size={20} color="#fff" />
    </View>
    <View className="ml-3 flex-1">
      <Text className="text-white/90 font-medium">{title}</Text>
      {description && (
        <Text className="text-white/50 text-sm mt-1">{description}</Text>
      )}
    </View>
    {rightElement || <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />}
  </TouchableOpacity>
);

export const ProfileScreen: React.FC<TabScreenProps<'Profile'>> = ({ navigation }) => {
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string>('');
  const { logout, userProfile, updateProfile } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const notificationService = NotificationService.getInstance();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const insets = useSafeAreaInsets();
  const messagingInstance = messaging();
  const coins = useCoinStore(state => state.coins);

  // Initialize interstitial ad
  const { isLoaded, load, show } = useInterstitialAd();

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const userInfo = await getCurrentUser();
        if (userInfo) {
          setUserId(userInfo);
        }
      } catch (error) {
        console.error('Error loading user info:', error);
        Toast.error("Error loading user info");
      }
    };
    loadUserInfo();

    // Load interstitial ad when profile screen opens
    if (Platform.OS === 'android') {
      load().catch(err => {
        console.log('Failed to load interstitial ad:', err);
      });
    }
  }, [load]);

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    try {
      const result = await check(NOTIFICATION_PERMISSION);
      setNotificationsEnabled(result === RESULTS.GRANTED);
    } catch (error) {
      console.error('Error checking notification permission:', error);
    }
  };

  const handleLogout = async () => {
    try {
      setShowLogoutModal(false); // Close modal first if open

      // Show interstitial ad before logging out if available
      if (Platform.OS === 'android' && isLoaded) {
        try {
          await show();
          // Slight delay to allow ad to finish
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.log('Error showing interstitial ad:', err);
        }
      }

      // Call logout
      await logout();

      // After successful logout, navigate to Onboarding
      resetRoot('Onboarding');

      // Show toast after a delay to not interfere with navigation
      setTimeout(() => {
        Toast.success("User logged out successfully");
      }, 500);
    } catch (error) {
      console.error('Error during logout:', error);
      Toast.error("Error during logout");
    }
  };

  const handleEditProfile = () => {
    setEditName(userProfile?.name || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        name: editName,
        avatar: userProfile?.avatar || DEFAULT_AVATAR
      });
      setShowEditModal(false);
      Toast.success("Profile updated successfully");
    } catch (error) {
      console.error('Error updating profile:', error);
      Toast.error("Error updating profile");
    }
  };

  const testNotifications = async () => {
    try {
      // First check if we have permission
      const permissionStatus = await notificationService.getPermissionStatus();
      if (!permissionStatus.granted) {
        Toast.error('Please enable notifications first');
        return;
      }

      // Test basic notification
      const success = await notificationService.displayNotification(
        'Test Notification',
        'This is a test notification from profile settings!',
        {
          android: {
            channelId: 'default',
            smallIcon: 'ic_notification',
            color: '#EC4899',
            importance: 4,
            priority: 'high',
            vibrate: true,
            pressAction: {
              id: 'default'
            }
          }
        }
      );

      if (success) {
        Toast.success('Test notification sent!');
      } else {
        Toast.error('Failed to send notification');
        return;
      }

      // Test notification with data after 2 seconds
      setTimeout(async () => {
        const dataSuccess = await notificationService.displayNotificationWithData(
          'Test Notification with Data',
          'This notification contains custom data!',
          {
            screen: 'Profile',
            id: '123',
            type: 'message',
            android: {
              channelId: 'default',
              smallIcon: 'ic_notification',
              color: '#EC4899',
              importance: 4,
              priority: 'high',
              vibrate: true,
              pressAction: {
                id: 'default'
              }
            }
          }
        );

        if (dataSuccess) {
          Toast.success('Data notification sent!');
        } else {
          Toast.error('Failed to send data notification');
        }
      }, 2000);

    } catch (error) {
      console.error('Error sending test notifications:', error);
      Toast.error('Failed to send test notifications');
    }
  };

  const handleNotificationToggle = async () => {
    try {
      const result = await check(NOTIFICATION_PERMISSION);

      if (result === RESULTS.BLOCKED) {
        // If notifications are blocked, prompt to open settings
        Alert.alert(
          'Permission Required',
          'Please enable notifications in settings to receive updates.',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings()
            }
          ]
        );
        return;
      }

      if (!notificationsEnabled) {
        // Request permission if not enabled
        const permissionResult = await request(NOTIFICATION_PERMISSION);
        if (permissionResult === RESULTS.GRANTED) {
          setNotificationsEnabled(true);
          // Use modular API for Firebase Cloud Messaging
          const fcmToken = await getToken(messagingInstance);
          console.log('FCM Token:', fcmToken);
          Toast.success('Notifications enabled');
        } else {
          setNotificationsEnabled(false);
          Toast.error('Permission denied');
        }
      } else {
        // If trying to disable, direct to settings since we can't programmatically disable
        Alert.alert(
          'Disable Notifications',
          'To disable notifications, please use your device settings.',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Toast.error('Failed to toggle notifications');
    }
  };

  const handlePrivacyPress = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch((err) => {
      console.error('Error opening privacy policy:', err);
      Toast.error('Could not open privacy policy');
    });
  };

  const handleHelpSupport = () => {
    Linking.openURL(HELP_SUPPORT_URL).catch((err) => {
      console.error('Error opening help & support:', err);
      Toast.error('Could not open help & support');
    });
  };

  return (
    <View className="flex-1 bg-[#111827]">
      <StatusBar
        backgroundColor="#111827"
        barStyle="light-content"
        translucent
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-4 py-4 border-b border-white/10">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-2xl font-bold text-white">Profile</Text>
          </View>
        </View>

        {/* Banner Ad at the top */}
        {Platform.OS === 'android' && (
          <BannerAdComponent
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            containerStyle={{ marginVertical: 8 }}
          />
        )}

        {/* Content */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ?
              100 + Math.min(insets.bottom, 20) :
              120 + Math.min(insets.bottom, 15)
          }}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
        >
          {/* Profile Header */}
          <View className="items-center mb-8">
            <View className="relative">
              <Image
                source={typeof userProfile?.avatar === 'string' ? { uri: userProfile.avatar } : (userProfile?.avatar || DEFAULT_AVATAR)}
                className="w-24 h-24 rounded-2xl mb-4 border-2 border-white/10"
                resizeMode="cover"
              />
            </View>
            <Text className="text-white text-xl font-bold mb-2">
              {userProfile?.name || 'Guest User'}
            </Text>
          </View>

          {/* Coin Display */}
          <View className="bg-[#1F2937] rounded-2xl p-5 mb-8 border border-white/10">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="bg-yellow-500/20 p-2 rounded-xl">
                  <Image
                    source={coinImage}
                    className="w-6 h-6"
                    resizeMode="contain"
                  />
                </View>
                <Text className="text-white font-semibold ml-3 text-lg">Your Coins</Text>
              </View>
              <Text className="text-yellow-400 font-bold text-xl">{coins}</Text>
            </View>
          </View>

          {/* Settings */}
          <View className="mb-8">
            <Text className="text-white/90 text-lg font-semibold mb-4 px-1">
              Settings
            </Text>
            <SettingItem 
              icon="account-edit" 
              title="Edit Profile" 
              onPress={handleEditProfile}
              description="Update your name and profile picture" 
            />

            <SettingItem
              icon="bell-outline"
              title="Notifications"
              onPress={handleNotificationToggle}
              description="Manage app notifications and preferences"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{ false: '#374151', true: '#EC4899' }}
                  thumbColor={notificationsEnabled ? '#EC4899' : '#9CA3AF'}
                />
              }
            />
            <SettingItem 
              icon="shield-check" 
              title="Privacy" 
              onPress={handlePrivacyPress}
              description="Review our data practices and policies" 
            />
            <SettingItem 
              icon="help-circle" 
              title="Help & Support" 
              onPress={handleHelpSupport}
              description="Get assistance and contact support" 
            />
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={() => setShowLogoutModal(true)}
            className="bg-red-500/10 rounded-2xl p-4 mb-8 border border-red-500/20"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-center space-x-2">
              <Icon name="logout-variant" size={22} color="#EF4444" />
              <Text className="text-red-500 font-semibold text-base ml-2">
                Log Out
              </Text>
            </View>
          </TouchableOpacity>

          {/* App Info */}
          <View className="mb-6">
            <View className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <View className="items-center space-y-2">
                <Text className="text-white/90 font-medium text-center text-lg">
                  {APP_NAME}
                </Text>
                <Text className="text-white/60 font-medium">Version {APP_VERSION}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
      >
        <Animated.View
          entering={FadeInDown}
          className="flex-1 justify-center items-center bg-black/50"
        >
          <View className="bg-[#1F2937] m-8 p-6 rounded-3xl border border-white/10 w-[85%]">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center space-x-3">
                <View className="bg-indigo-500/20 p-2 rounded-xl">
                  <Icon name="account-edit" size={22} color="#6366F1" />
                </View>
                <Text className="text-xl font-semibold text-white">
                  Edit Profile
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 items-center justify-center"
              >
                <Icon name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Edit Form */}
            <View className="mb-6">
              <Text className="text-white/60 mb-2 font-medium">Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white mb-4"
                placeholderTextColor="rgba(156, 163, 175, 0.5)"
                placeholder="Enter your name"
              />
            </View>

            {/* Modal Actions */}
            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="px-6 py-3 rounded-xl bg-white/10 flex-row items-center gap-2"
              >
                <Icon name="close" size={20} color="#fff" />
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveProfile}
                className="px-6 py-3 rounded-xl bg-indigo-500 flex-row items-center gap-2"
              >
                <Icon name="content-save" size={20} color="#fff" />
                <Text className="text-white font-medium">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Animated.View
          entering={FadeInDown}
          className="flex-1 justify-center items-center bg-black/50"
        >
          <View className="bg-[#1F2937] m-8 p-6 rounded-3xl border border-white/10 w-[85%]">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center space-x-3">
                <View className="bg-red-500/20 p-2 rounded-xl">
                  <Icon name="logout-variant" size={22} color="#EF4444" />
                </View>
                <Text className="text-xl font-semibold text-white">
                  Confirm Logout
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 items-center justify-center"
              >
                <Icon name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <Text className="text-gray-300 text-base mb-4 leading-6">
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </Text>

            {/* Added separator line */}
            <View className="border-b border-white/10 mb-4" />

            {/* Modal Actions */}
            <View className="flex-row justify-end space-x-3 gap-x-3">
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                className="px-6 py-3 rounded-xl bg-white/10 flex-row items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogout}
                className="px-6 py-3 rounded-xl bg-red-500/90 flex-row items-center"
              >
                <Text className="text-white font-medium">Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}; 