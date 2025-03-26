import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StatusBar, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { TabScreenProps } from '../../navigation/types';
import type { Profile } from '../home/HomeScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/MaterialIcons';
import Toast from "toastify-react-native"

export const FavoriteScreen: React.FC<TabScreenProps<'Favorites'>> = ({ navigation }) => {
  const [favorites, setFavorites] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  // Load favorites when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFavorites();
    });

    return unsubscribe;
  }, [navigation]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const favoritesJSON = await AsyncStorage.getItem('favorite_characters');

      if (favoritesJSON) {
        const loadedFavorites = JSON.parse(favoritesJSON);
        setFavorites(loadedFavorites);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      // Keep critical error toast
      Toast.error("Load Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = (profile: Profile) => {
    navigation.navigate('Character', { profile });
  };

  const handleRemoveFavorite = async (profile: Profile) => {
    try {
      // Remove from state first for immediate UI update
      setFavorites(prev => prev.filter(fav => fav.id !== profile.id));

      // Update AsyncStorage
      const updatedFavorites = favorites.filter(fav => fav.id !== profile.id);
      await AsyncStorage.setItem('favorite_characters', JSON.stringify(updatedFavorites));

      // Remove unnecessary toast - item disappears from the list which is sufficient feedback
      // Toast.info("Removed from Favorites");
    } catch (error) {
      console.error('Error removing favorite:', error);
      // Reload favorites to restore correct state if operation failed
      loadFavorites();
      // Keep error toast for operation failures
      Toast.error("Action Failed");
    }
  };

  const renderFavorite = ({ item: profile, index }: { item: Profile; index: number }) => {
    const imageUri = typeof profile.image === 'string'
      ? profile.image
      : profile.image.uri;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100)}
        className="mb-4"
      >
        <TouchableOpacity
          className="flex-row items-center bg-white/5 rounded-2xl overflow-hidden"
          activeOpacity={0.7}
          onPress={() => handleProfilePress(profile)}
        >
          <Image
            source={{ uri: imageUri }}
            className="w-20 h-20 rounded-full"
            style={{ resizeMode: 'cover' }}
          />
          <View className="flex-1 p-4">
            <View className="flex-row items-center justify-between">
              <View>
                {/* Wrap Name and Verified Icon */}
                <View className="flex-row items-center">
                  <Text className="text-white font-semibold text-lg">{profile.name}</Text>
                  <Ionicons name="verified" size={18} color="#1DA1F2" className="ml-1" />
                </View>

                {/* Occupation Text */}
                <Text className="text-gray-400 mt-1">
                  {profile.occupation}
                </Text>
              </View>

              {/* Favorite Button */}
              <TouchableOpacity
                className="bg-pink-500 w-10 h-10 rounded-full items-center justify-center"
                activeOpacity={0.7}
                onPress={() => handleRemoveFavorite(profile)}
              >
                <Icon name="heart" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
{/* 
            <View className="flex-row mt-2">
              <View className="bg-white/10 rounded-full px-3 py-1">
                <Text className="text-white text-sm">{profile.style || 'Character'}</Text>
              </View>
            </View> */}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyList = () => (
    <View className="flex-1 items-center justify-center p-8">
      <Icon name="heart-outline" size={64} color="rgba(255,255,255,0.2)" />
      <Text className="text-white/50 text-center mt-4 text-lg">
        No favorites yet
      </Text>
      <Text className="text-white/40 text-center mt-2">
        Tap the heart icon on a character to add them to your favorites
      </Text>
      <TouchableOpacity
        className="bg-pink-500 rounded-full px-6 py-3 mt-6 flex-row items-center"
        onPress={() => navigation.navigate('HomeTab')}
      >
        <Icon name="compass" size={20} color="#fff" className="mr-2" />
        <Text className="text-white font-semibold ml-2">Explore characters</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-[#111827]">
      <StatusBar
        backgroundColor="#111827"
        barStyle="light-content"
        translucent
      />

      <SafeAreaView className="flex-1" edges={['top']}>
       {/* Header */}
       <View className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Favorites</Text>
            <TouchableOpacity 
              onPress={loadFavorites}
              className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-2xl"
            >
              <Icon name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#EC4899" />
            <Text className="text-white/70 mt-4">Loading favorites...</Text>
          </View>
        ) : (
          <FlatList
            data={favorites}
            renderItem={renderFavorite}
            keyExtractor={item => item.id}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Platform.OS === 'ios' ? 
                100 + Math.min(insets.bottom, 20) : 
                120 + Math.min(insets.bottom, 15)
            }}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            ListEmptyComponent={renderEmptyList}
          />
        )}
      </SafeAreaView>
    </View>
  );
};