import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, { SlideInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Profile } from '../home/HomeScreen';
import { getCharacterById } from '../../api/services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/MaterialIcons';
import Toast from "toastify-react-native"
import { useInterstitialAd } from '../../hooks/useAdMob';
import { useCoinStore } from '../../store/useCoinStore';
import BannerAdComponent from '../../components/ads/BannerAdComponent';
import { BannerAdSize } from 'react-native-google-mobile-ads';

Dimensions.get('window');

type CharacterScreenProps = NativeStackScreenProps<any, 'Character'>;

const CharacterScreen: React.FC<CharacterScreenProps> = ({ route, navigation }) => {
  const { profile: initialProfile, characterId } = route.params as { profile?: Profile; characterId?: string };
  const [profile, setProfile] = useState<Profile | null>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile && !!characterId);
  const [activeTab, setActiveTab] = useState<'about' | 'gallery' | 'chat'>('about');
  const [isLiked, setIsLiked] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Initialize interstitial ad
  const { isLoaded, load, show, error } = useInterstitialAd();
  const addCoins = useCoinStore(state => state.addCoins);
  
  useEffect(() => {
    // If we have a characterId but no profile, fetch the character
    if (characterId && !initialProfile) {
      fetchCharacter(characterId);
    }

    // Check if character is already favorited
    if (profile) {
      checkFavoriteStatus();
    }
    
    // Load interstitial ad
    if (Platform.OS === 'android') {
      load().catch(err => {
        console.log('Failed to load interstitial ad:', err);
      });
    }
  }, [characterId, initialProfile, profile?.id, load]);

  const fetchCharacter = async (id: string) => {
    try {
      setLoading(true);
      const data = await getCharacterById(id);
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch character:', error);
      // Keep error toast for critical failures
      Toast.error("Load Failed");
      // Go back if we can't load the character
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const checkFavoriteStatus = async () => {
    if (!profile) return;
    
    try {
      const favoritesJSON = await AsyncStorage.getItem('favorite_characters');
      if (favoritesJSON) {
        const favorites = JSON.parse(favoritesJSON);
        // Check if current character is in favorites
        const isFavorite = favorites.some((fav: Profile) => fav.id === profile.id);
        setIsLiked(isFavorite);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const handleStartChat = async () => {
    if (!profile) return;
    
    // If ad is loaded, show it before navigating
    if (Platform.OS === 'android' && isLoaded) {
      try {
        await show();
        // Add coins as a reward for watching the ad
        addCoins(2);
        Toast.success('You earned 2 coins for chatting!');
      } catch (err) {
        console.log('Error showing interstitial ad:', err);
      }
    }
    
    // Navigate to Chat screen
    navigation.navigate('Chat', { 
      profile,
      characterId: profile.id
    });
  };

  const handleLike = async () => {
    if (!profile) return;

    const newStatus = !isLiked;
    setIsLiked(newStatus);
    
    try {
      // Get current favorites
      const favoritesJSON = await AsyncStorage.getItem('favorite_characters');
      let favorites: Profile[] = favoritesJSON ? JSON.parse(favoritesJSON) : [];
      
      if (newStatus) {
        // Add to favorites if not already there
        if (!favorites.some(fav => fav.id === profile.id)) {
          favorites.push(profile);
          // Remove unnecessary toast - the heart icon change is sufficient visual feedback
          // Toast.success("Added to Favorites");
        }
      } else {
        // Remove from favorites
        favorites = favorites.filter(fav => fav.id !== profile.id);
        // Remove unnecessary toast - the heart icon change is sufficient visual feedback
        // Toast.info("Removed from Favorites");
      }
      
      // Save updated favorites
      await AsyncStorage.setItem('favorite_characters', JSON.stringify(favorites));
    } catch (error) {
      console.error('Error updating favorites:', error);
      // Revert UI state if operation failed
      setIsLiked(!newStatus);
      // Keep this toast for error feedback
      Toast.error("Action Failed");
    }
  };

  if (loading || !profile) {
    return (
      <View className="flex-1 bg-[#111827] justify-center items-center">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color="#EC4899" />
        <Text className="text-white mt-4">Loading character...</Text>
      </View>
    );
  }

  const renderFullScreenImage = () => {
    const imageUri = typeof profile.backgroundImage === 'string' ? profile.backgroundImage : profile.backgroundImage?.uri;
    
    return (
    <View className="w-full h-full">
      <Image
        source={{ uri: imageUri }}
        className="absolute w-full h-full"
        style={{ resizeMode: 'cover' }}
      />
      
      {/* Top Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        className="absolute top-0 left-0 right-0 h-40"
      />
      
      {/* Bottom Gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        className="absolute bottom-0 left-0 right-0 h-[70%]"
      />

      {/* Back Button */}
      <SafeAreaView>
        <View className="flex-row justify-between items-center px-4 pt-2 gap-2">
          <TouchableOpacity
            className="bg-black/20 backdrop-blur-md rounded-full p-2"
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          <View className="flex-row space-x-3 gap-2">
            <TouchableOpacity
              className="bg-black/20 backdrop-blur-md rounded-full p-2"
              onPress={handleStartChat}
            >
              <Icon name="chat-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-black/20 backdrop-blur-md rounded-full p-2"
              onPress={handleLike}
            >
              <Icon 
                name={isLiked ? "heart" : "heart-outline"} 
                size={24} 
                color={isLiked ? "#EC4899" : "#fff"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom Content */}
      <View className="absolute bottom-0 left-0 right-0">
        <Animated.View 
          entering={SlideInDown.delay(200)}
          className="px-4 pb-4"
        >
          {/* Name and Age */}
          <View className="mb-4">
            <Text className="text-white text-4xl font-bold">
              {profile.name}
              <Ionicons name="verified" size={18} color="#1DA1F2" className="ml-1" />
            </Text>
          </View>

          {/* Quick Stats */}
          <View className="flex-row space-x-4 mb-6 gap-2">
            <View className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2">
              <Text className="text-white font-semibold">{profile.style || (profile.traits && profile.traits[0]) || 'Character'}</Text>
            </View>
            <View className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2">
              <Text className="text-white font-semibold">{profile.responseTime || 'Online'}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row space-x-3 gap-2">
            <TouchableOpacity
              className="flex-1 bg-pink-500 rounded-2xl py-4 flex-row items-center justify-center"
              activeOpacity={0.8}
              onPress={handleStartChat}
            >
              <Icon name="chat" size={20} color="#fff" className="mr-2" />
              <Text className="text-white font-semibold text-lg">Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`w-14 rounded-2xl items-center justify-center ${
                isLiked ? 'bg-pink-500' : 'bg-white/10 backdrop-blur-md'
              }`}
              activeOpacity={0.8}
              onPress={handleLike}
            >
              <Icon 
                name={isLiked ? "heart" : "heart-outline"} 
                size={28} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* About Section */}
        <Animated.View 
          entering={SlideInDown.delay(300)}
          className="bg-[#111827]/95 backdrop-blur-md rounded-t-3xl mt-4 p-6"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {/* Banner Ad */}
          {Platform.OS === 'android' && (
            <BannerAdComponent
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
              containerStyle={{ marginBottom: 16 }}
            />
          )}
          
          <Text className="text-white text-xl font-semibold mb-4">About</Text>
          <Text className="text-gray-300 text-base leading-6 mb-6">
            {profile.description || `Passionate and dedicated ${profile.occupation.toLowerCase()}. Always eager to learn and share knowledge with others.`}
          </Text>

          <Text className="text-white text-xl font-semibold mb-4">Interests</Text>
          <View className="flex-row flex-wrap">
            {(profile.interests && profile.interests.length > 0 ? profile.interests : ['Reading', 'Travel', 'Art', 'Music', 'Photography']).map((interest) => (
              <View
                key={interest}
                className="bg-white/10 rounded-full px-4 py-2 mr-2 mb-2"
              >
                <Text className="text-white">{interest}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  )};

  return (
    <View className="flex-1 bg-[#111827]">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {renderFullScreenImage()}
      
      <ScrollView 
        className="flex-1 pt-2"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Character details */}
        {activeTab === 'about' && (
          <View className="px-4 mt-4">
            <Text className="text-white/90 text-base mb-4">
              {profile.description || "No description available for this character."}
            </Text>
            
            {/* Additional character info */}
            <View className="mt-4">
              <Text className="text-white text-lg font-semibold mb-2">
                Interests
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {profile.interests?.map((interest, index) => (
                  <View key={index} className="bg-white/10 backdrop-blur-xl rounded-full px-3 py-1">
                    <Text className="text-white">{interest}</Text>
                  </View>
                ))}
              </View>
              
              <Text className="text-white text-lg font-semibold mb-2">
                Traits
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {profile.traits?.map((trait, index) => (
                  <View key={index} className="bg-white/10 backdrop-blur-xl rounded-full px-3 py-1">
                    <Text className="text-white">{trait}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default CharacterScreen;