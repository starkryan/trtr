import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getCharacters } from '../../api/services';
import { Profile, StyleType } from '../home/HomeScreen';
import Ionicons from 'react-native-vector-icons/MaterialIcons';
import BannerAdComponent from '../../components/ads/BannerAdComponent';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import AdMobService from '../../services/AdMobService';
import { useCoinStore } from '../../store/useCoinStore';
import Toast from 'toastify-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

// Add this near the other constants
const countryFlags: Record<string, string> = {
  'India': '🇮🇳',
  'USA': '🇺🇸',
  'UK': '🇬🇧',
  'Canada': '🇨🇦',
  'Australia': '🇦🇺',
  'New Zealand': '🇳🇿',
  'South Africa': '🇿🇦',
  'Brazil': '🇧🇷',
  'Argentina': '🇦🇷',
  'Chile': '🇨🇱',
  'Mexico': '🇲🇽',
  'Colombia': '🇨🇴',
  'Peru': '🇵🇪'
};

// Fallback data in case API fails
const mockProfiles: Profile[] = [
  {
    id: '1',
    name: 'Eleanor',
    age: 24,
    occupation: 'Polish historian and lecturer at a prestigious university',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
    isNew: true,
    style: 'Academic',
    isPremium: false,
  },
  {
    id: '2',
    name: 'Louna',
    age: 26,
    occupation: 'Professional model and fashion designer',
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
    isNew: true,
    style: 'Elegant',
    isPremium: true,
  },
  {
    id: '3',
    name: 'Lila',
    age: 21,
    occupation: 'Gothic-punk College Student',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
    style: 'Gothic',
    isPremium: false,
  },
  {
    id: '4',
    name: 'Savannah',
    age: 19,
    occupation: 'Freshman athlete, volleyball team captain',
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
    style: 'Athletic',
    isPremium: true,
  },
  {
    id: '5',
    name: 'Victoria',
    age: 23,
    occupation: 'Art gallery curator and painter',
    image: 'https://images.unsplash.com/photo-1524638431109-93d95c968f03',
    style: 'Artistic',
    isPremium: false,
  },
  {
    id: '6',
    name: 'Luna',
    age: 22,
    occupation: 'Alternative model and makeup artist',
    image: 'https://images.unsplash.com/photo-1526080652727-5b77f74eacd2',
    style: 'Gothic',
    isPremium: true,
  },
];

const STYLE_COLORS: Record<StyleType, [string, string]> = {
  Academic: ['#6366F1', '#4F46E5'], // Indigo
  Elegant: ['#EC4899', '#DB2777'], // Pink
  Gothic: ['#6B7280', '#374151'], // Gray
  Athletic: ['#10B981', '#059669'], // Emerald
  Artistic: ['#F59E0B', '#B45309'], // Amber
};

const getStyleColors = (style: StyleType | undefined): [string, string] => {
  return style ? STYLE_COLORS[style] : STYLE_COLORS.Academic;
};

type SearchScreenProps = NativeStackScreenProps<any, 'Search'>;

const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Replace the hook with state to track ad loading
  const [isRewardedAdLoading, setIsRewardedAdLoading] = useState(false);
  const { addCoins, coins } = useCoinStore();

  useEffect(() => {
    fetchCharacters();
    
    // Preload a rewarded ad using AdMobService
    if (Platform.OS === 'android') {
      preloadRewardedAd();
    }
  }, []);
  
  // Preload rewarded ad function
  const preloadRewardedAd = async () => {
    try {
      setIsRewardedAdLoading(true);
      // AdMobService already handles preloading in the background
      // This is just to flag that we've initiated the process
      setIsRewardedAdLoading(false);
    } catch (error) {
      console.log('Failed to preload rewarded ad:', error);
      setIsRewardedAdLoading(false);
    }
  };

  // Show rewarded ad function
  const showRewardedAd = async () => {
    try {
      const adMobService = AdMobService.getInstance();
      const reward = await adMobService.showRewardedAd();
      
      if (reward) {
        const rewardAmount = 15;
        addCoins(rewardAmount);
        Toast.success(`You earned ${rewardAmount} coins and unlocked premium profiles!`);
        setShowPremiumOnly(true);
      } else {
        Toast.info('You closed the ad before earning a reward');
      }
    } catch (error) {
      console.log('Error showing rewarded ad:', error);
      Toast.error('Failed to show ad. Please try again.');
    }
  };

  useEffect(() => {
    filterProfiles();
  }, [searchQuery, allProfiles, showPremiumOnly]);

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      // Make half the profiles premium in development
      let data = await getCharacters();
      
      // Add premium property to profiles
      data = data.map((profile: Profile, index: number) => ({
        ...profile,
        isPremium: index % 3 === 0 // Every third profile is premium
      }));
      
      setProfiles(data);
      setAllProfiles(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching characters:', error);
      setLoading(false);
      setProfiles(mockProfiles);
      setAllProfiles(mockProfiles);
    }
  };

  const filterProfiles = () => {
    if (!allProfiles.length) return;
    
    let filtered = [...allProfiles];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(profile => {
        return (
          profile.name.toLowerCase().includes(query) ||
          (profile.occupation && profile.occupation.toLowerCase().includes(query)) ||
          (profile.traits && profile.traits.some(t => t.toLowerCase().includes(query))) ||
          (profile.interests && profile.interests.some(i => i.toLowerCase().includes(query)))
        );
      });
    }
    
    // Apply premium filter if enabled
    if (showPremiumOnly) {
      filtered = filtered.filter(profile => profile.isPremium);
    }
    
    setProfiles(filtered);
  };

  const handleProfilePress = (profile: Profile) => {
    // If premium profile and premium not unlocked, show ad or use coins
    if (profile.isPremium && !showPremiumOnly) {
      if (coins >= 5) {
        // Use coins to unlock premium
        Toast.info('Using 5 coins to access premium profile');
        navigation.navigate('Character', { profile });
      } else {
        // Show rewarded ad
        showPremiumAdPrompt();
      }
    } else {
      // Normal navigation for non-premium or when premium is already unlocked
      navigation.navigate('Character', { profile });
    }
  };
  
  const showPremiumAdPrompt = () => {
    Toast.info('Watch an ad to unlock premium profiles!');
    showRewardedAd();
  };

  const renderProfileCard = ({ item: profile, index }: { item: Profile; index: number }) => {
    // Determine style based on first trait or fallback to Academic
    let style = profile.style as StyleType;
    if (!style && profile.traits && profile.traits.length > 0) {
      const trait = profile.traits[0];
      if (trait.includes('academic') || trait.includes('smart')) style = 'Academic';
      else if (trait.includes('elegant') || trait.includes('fashion')) style = 'Elegant';
      else if (trait.includes('gothic') || trait.includes('dark')) style = 'Gothic';
      else if (trait.includes('athletic') || trait.includes('sports')) style = 'Athletic';
      else if (trait.includes('artistic') || trait.includes('creative')) style = 'Artistic';
      else style = 'Academic'; // Default
    }
    
    const borderColors = getStyleColors(style);
    const imageUri = typeof profile.image === 'string' ? profile.image : profile.image.uri;
    const backgroundImageUri = typeof profile.backgroundImage === 'string' ? profile.backgroundImage : profile.backgroundImage?.uri; 
    
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100)}
        className="mb-4"
        style={{ width: CARD_WIDTH }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          className="mb-4 rounded-2xl overflow-hidden"
          onPress={() => handleProfilePress(profile)}
        >
          <LinearGradient
            colors={borderColors}
            className="p-[1.5px] rounded-2xl"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View className="relative bg-black/50 rounded-2xl overflow-hidden backdrop-blur-sm">
              {backgroundImageUri && (
                <Image
                  source={{ uri: backgroundImageUri }}
                  className="w-full rounded-t-2xl"
                  style={{ height: CARD_WIDTH * 1.4, resizeMode: 'cover' }}
                />
              )}
            
              {/* Premium Badge */}
              {profile.isPremium && (
                <View className="absolute top-2 right-2 bg-yellow-500/90 rounded-full px-3 py-1 flex-row items-center">
                  <Icon name="star" size={14} color="#fff" />
                  <Text className="text-white text-xs ml-1 font-bold">Premium</Text>
                </View>
              )}
              
              {/* New Badge */}
              {profile.isNew && (
                <View className="absolute top-2 left-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 flex-row items-center">
                  <Icon name="lightning-bolt" size={14} color="#fff" />
                  <Text className="text-white text-xs ml-1 font-medium">New</Text>
                </View>
              )}

              {/* Content Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.95)']}
                className="absolute bottom-0 left-0 right-0 p-3"
              >
                <View>
                  <View className="flex-row items-center">
                    <Text className="text-white text-lg font-bold">
                      {profile.name}
                    </Text>
                    {/* Verified Badge */}
                    <Ionicons name="verified" size={18} color="#1DA1F2" className="ml-1" />
                  </View>
                  {/* Location with flag */}
                  {profile.location && (
                    <View className="flex-row items-center space-x-1 ml-2">
                      <Text 
                        className="text-gray-300 text-xs font-medium" 
                        numberOfLines={1} 
                        ellipsizeMode="tail"
                      >
                        {profile.location.split(' ')[0]}
                      </Text>
                      {countryFlags[profile.location] && (
                        <Text className="text-sm">
                          {countryFlags[profile.location]}
                        </Text>
                      )}
                    </View>
                  )}
                  <Text className="text-gray-300 text-sm mt-1" numberOfLines={2}>
                    {profile.occupation}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1 bg-[#111827]">
      <StatusBar
        backgroundColor="#111827"
        barStyle="light-content"
        translucent
      />
      
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header with back button and search input */}
        <View className="px-4 py-4 bg-[#111827]">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white">Search</Text>
          </View>
          
          {/* Search Input */}
          <View className="flex-row items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2">
            <Icon name="magnify" size={20} color="#fff" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, traits, interests..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-white ml-2"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#EC4899" />
            <Text className="text-white mt-4">Loading characters...</Text>
          </View>
        ) : searchQuery.trim() === '' ? (
          <View className="flex-1 justify-center items-center px-6">
            <Icon name="magnify" size={60} color="#4B5563" />
            <Text className="text-white text-lg font-semibold mt-4 text-center">
              Search for characters
            </Text>
            <Text className="text-gray-400 text-center mt-2">
              Find characters by their name, traits, interests, or description.
            </Text>
          </View>
        ) : profiles.length === 0 ? (
          <View className="flex-1 justify-center items-center px-6">
            <Icon name="emoticon-sad-outline" size={60} color="#4B5563" />
            <Text className="text-white text-lg font-semibold mt-4 text-center">
              No characters found
            </Text>
            <Text className="text-gray-400 text-center mt-2">
              Try searching with different keywords.
            </Text>
          </View>
        ) : (
          <FlatList
            data={profiles}
            renderItem={renderProfileCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={{ 
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Platform.OS === 'ios' ? 
                100 + Math.min(insets.bottom, 20) : 
                120 + Math.min(insets.bottom, 15)
            }}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default SearchScreen;