import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Dimensions, StatusBar, RefreshControl, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getCharacters } from '../../api/services';
import Ionicons from 'react-native-vector-icons/MaterialIcons';
import Toast from "toastify-react-native"
import { TabScreenProps } from '../../navigation/types';
import BannerAdComponent from '../../components/ads/BannerAdComponent';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import Svg, { Path, Line } from 'react-native-svg';



export interface Profile {
  id: string;
  name: string;
  age: number | string;
  occupation: string;
  image: { uri: string } | string;
  backgroundImage?: { uri: string } | string;
  isNew?: boolean;
  style?: StyleType;
  traits?: string[];
  interests?: string[];
  accentColor?: string;
  textColor?: string;
  description?: string;
  personality?: string;
  location?: string;
  responseTime?: string;
  email?: string;
  isPremium?: boolean;
}

// Replace country constants with a mapping object
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

export type StyleType = 'Academic' | 'Elegant' | 'Gothic' | 'Athletic' | 'Artistic';


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
  },
  {
    id: '2',
    name: 'Louna',
    age: 26,
    occupation: 'Professional model and fashion designer',
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
    isNew: true,
    style: 'Elegant',
  },
  {
    id: '3',
    name: 'Lila',
    age: 21,
    occupation: 'Gothic-punk College Student',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
    style: 'Gothic',
  },
  {
    id: '4',
    name: 'Savannah',
    age: 19,
    occupation: 'Freshman athlete, volleyball team captain',
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
    style: 'Athletic',
  },
  {
    id: '5',
    name: 'Victoria',
    age: 23,
    occupation: 'Art gallery curator and painter',
    image: 'https://images.unsplash.com/photo-1524638431109-93d95c968f03',
    style: 'Artistic',
  },
  {
    id: '6',
    name: 'Luna',
    age: 22,
    occupation: 'Alternative model and makeup artist',
    image: 'https://images.unsplash.com/photo-1526080652727-5b77f74eacd2',
    style: 'Gothic',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

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

const renderProfileCard = (profile: Profile, onPress: (profile: Profile) => void) => {
  let style = profile.style as StyleType;
  if (!style && profile.traits && profile.traits.length > 0) {
    const trait = profile.traits[0];
    if (trait.includes('academic') || trait.includes('smart')) style = 'Academic';
    else if (trait.includes('elegant') || trait.includes('fashion')) style = 'Elegant';
    else if (trait.includes('gothic') || trait.includes('dark')) style = 'Gothic';
    else if (trait.includes('athletic') || trait.includes('sports')) style = 'Athletic';
    else if (trait.includes('artistic') || trait.includes('creative')) style = 'Artistic';
    else style = 'Academic';
  }
  
  const [primaryColor, secondaryColor] = getStyleColors(style);
  const imageUri = typeof profile.backgroundImage === 'string' ? profile.backgroundImage : profile.backgroundImage?.uri;
  
  return (
    <TouchableOpacity
      key={profile.id}
      activeOpacity={0.7}
      className="mb-4"
      style={{ width: CARD_WIDTH }}
      onPress={() => onPress(profile)}
    >
      <View className="relative overflow-hidden rounded-2xl border border-white/10">
        {/* Main Image */}
        <Image
          source={{ uri: imageUri }}
          className="w-full"
          style={{ height: CARD_WIDTH * 1.4, resizeMode: 'cover' }}
        />
        
        {/* Gradient Overlays */}
        <View className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
        <View className="absolute inset-0 bg-black/10" />

        {/* New Badge */}
        {profile.isNew && (
          <View className="absolute top-3 left-3 flex-row items-center bg-pink-500/90 rounded-full px-2.5 py-1">
            <Icon name="sparkles" size={12} color="#fff" />
            <Text className="text-white text-xs font-medium ml-1">New</Text>
          </View>
        )}

        {/* Bottom Content */}
        <View className="absolute bottom-0 left-0 right-0 p-3">
          {/* Name and Age */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Text className="text-white text-base font-bold mr-1">
                {profile.name}
              </Text>
              <Ionicons name="verified" size={16} color="#60A5FA" />
            </View>
            <Text className="text-white/90 text-sm font-medium">
              {profile.age}
            </Text>
          </View>

          {/* Location and Style Tags */}
          <View className="flex-row items-center flex-wrap gap-2">
            {profile.location && (
              <View className="flex-row items-center bg-black/40 rounded-full px-2 py-1">
                <Icon name="location" size={12} color="#fff" />
                <Text className="text-white/90 text-xs ml-1">
                  {profile.location.split(' ')[0]} {countryFlags[profile.location]}
                </Text>
              </View>
            )}
            {profile.style && (
              <View 
                className="bg-black/40 rounded-full px-2 py-1"
                style={{ borderColor: primaryColor, borderWidth: 1 }}
              >
                <Text className="text-white/90 text-xs">{profile.style}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ProfileGrid = ({ profiles, onProfilePress, loading, onRefresh, selectedTab, setSelectedTab, tabs }: { 
  profiles: Profile[]; 
  onProfilePress: (profile: Profile) => void;
  loading: boolean;
  onRefresh: () => void;
  selectedTab: number;
  setSelectedTab: (index: number) => void;
  tabs: Array<{ key: string; title: string; data: Profile[] }>;
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const handleRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setRefreshing(false);
  };

  if (loading && profiles.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#EC4899" />
        <Text className="text-white/80 mt-4 font-medium">Loading amazing characters...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={profiles}
      renderItem={({ item: profile, index }) => (
        <Animated.View
          entering={FadeInDown.delay(index * 100)}
          className="mb-4"
        >
          {renderProfileCard(profile, onProfilePress)}
        </Animated.View>
      )}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ 
        justifyContent: 'space-between',
        paddingHorizontal: 4
      }}
      contentContainerStyle={{ 
        paddingHorizontal: 12,
        paddingBottom: Platform.OS === 'ios' ?
          insets.bottom + 120 :
          120 + Math.min(insets.bottom, 15)
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#EC4899"
        />
      }
      ListHeaderComponent={() => (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 16 }}
          >
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setSelectedTab(index)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  selectedTab === index
                    ? 'bg-pink-500'
                    : 'bg-white/10'
                }`}
              >
                <Text
                  className={`font-medium ${
                    selectedTab === index
                      ? 'text-white'
                      : 'text-white/70'
                  }`}
                >
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Add Banner ad below the tabs */}
          {Platform.OS === 'android' && (
            <BannerAdComponent
              size={BannerAdSize.BANNER}
              containerStyle={{ marginBottom: 10 }}
              onAdLoaded={() => console.log('Home banner ad loaded')}
              onAdFailedToLoad={(error) => console.log('Home banner ad failed to load:', error)}
            />
          )}
        </>
      )}
      ListEmptyComponent={() => (
        <View className="flex-1 justify-center items-center py-10">
          <Icon name="emoticon-sad-outline" size={48} color="#6B7280" />
          <Text className="text-gray-400 mt-4 text-lg">No characters found</Text>
        </View>
      )}
    />
  );
};

export const HomeScreen: React.FC<TabScreenProps<'HomeTab'>> = ({ navigation }) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState(0);
  const [characters, setCharacters] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigationStatus, setNavigationStatus] = useState<string | null>(null);


 

  const fetchCharacters = async (showLoadingToast = false) => {
    try {
      // Remove the refreshing toast - the pull-to-refresh indicator is enough
      // if (showLoadingToast) {
      //   Toast.info("Refreshing");
      // }
      
      setLoading(true);
      const data = await getCharacters();
      const withNewFlag = data.map((char: Profile, index: number) => ({
        ...char,
        isNew: index < 2
      }));
      setCharacters(withNewFlag);
      setLoading(false);
      
      // Remove the success toast - successful loading is already visually apparent
      // if (showLoadingToast) {
      //   Toast.success("Updated");
      // }
    } catch (error) {
      console.error('Failed to fetch characters:', error);
      setLoading(false);
      // Keep error toast for network errors as this is important for user to know
      Toast.error("Network Error");
      setCharacters(mockProfiles.map((profile, index) => ({
        ...profile,
        isNew: index < 2
      })));
    }
  };
  
  useEffect(() => {
    fetchCharacters();
  }, []);

  // Handle any navigation events to clear status messages
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      if (navigationStatus) {
        setNavigationStatus(null);
      }
    });
    return unsubscribe;
  }, [navigation, navigationStatus]);

  
  const tabs = [
    { key: 'all', title: 'All', data: characters },
    { key: 'new', title: 'New', data: characters.filter(p => p.isNew) },
    { key: 'trending', title: 'Trending', data: characters.slice(0, 3) },
    { key: 'popular', title: 'Popular', data: characters.slice(2) },
    { key: 'recommended', title: 'Recommended', data: characters.slice(1, 4) },
    { key: 'featured', title: 'Featured', data: characters.slice(3) },
  ];

  const handleProfilePress = (profile: Profile) => {
    navigation.navigate('Character', { profile });
  };


  return (
    <View className="flex-1 bg-[#111827]">
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent
      />
      
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Modern Header */}
        <View className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2">
              <Image 
                source={require('../../../assets/logo.png')} 
                style={{ width: 120, height: 40 }}
                resizeMode="contain"
              />
            </View>
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity 
                onPress={() => navigation.navigate('Search')} 
                className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-2xl"
              >
                <Icon name="search" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ProfileGrid 
          profiles={tabs[selectedTab].data} 
          onProfilePress={handleProfilePress}
          loading={loading}
          onRefresh={() => fetchCharacters(true)}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          tabs={tabs}
        />
        
       
      </SafeAreaView>
    </View>
  );
}; 