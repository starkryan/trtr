import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StatusBar, ActivityIndicator, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { TabScreenProps } from '../../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConversationData } from '../chat/ChatScreen';
import Toast from "toastify-react-native"
import { LinearGradient } from 'react-native-linear-gradient';
import type { Profile, StyleType } from '../home/HomeScreen';

// Helper function to format timestamps
const formatMessageTime = (date: Date | string): string => {
  if (!date) return '';
  
  // Ensure we have a Date object
  const messageDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  // Calculate time difference in milliseconds
  const diff = now.getTime() - messageDate.getTime();
  const diffMinutes = Math.floor(diff / 60000);
  const diffHours = Math.floor(diff / 3600000);
  const diffDays = Math.floor(diff / 86400000);
  
  // Return appropriate format based on time difference
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older messages, format date with 12-hour time
  const hours = messageDate.getHours();
  const minutes = messageDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12; // Convert 0 to 12
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  
  // Format: "MM/DD/YYYY, 12:30 PM"
  return `${messageDate.toLocaleDateString()}, ${formattedHours}:${formattedMinutes} ${ampm}`;
};

export const InboxScreen: React.FC<TabScreenProps<'Inbox'>> = ({ navigation }) => {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationData | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Load conversations when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      loadConversations();
    });
    
    return unsubscribe;
  }, [navigation]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const storedList = await AsyncStorage.getItem('inbox_conversations');
      
      if (storedList) {
        const parsedList = JSON.parse(storedList);
        setConversations(parsedList);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationPress = async (conversation: ConversationData) => {
    // Mark as read when opening
    markAsRead(conversation.character.id);
    
    // Navigate to chat screen with all required parameters
    navigation.navigate('Chat', { 
      characterId: conversation.character.id,
      profile: {
        id: conversation.character.id,
        name: conversation.character.name,
        image: conversation.character.image,
        backgroundImage: conversation.character.backgroundImage,
        style: "Elegant" as StyleType,
        traits: [],
        interests: [],
        age: "",
        occupation: ""
      },
      uncensored: false,
      characterName: conversation.character.name,
      characterImage: typeof conversation.character.image === 'string' 
        ? conversation.character.image 
        : conversation.character.image.uri,
      characterBackground: conversation.character.backgroundImage 
        ? (typeof conversation.character.backgroundImage === 'string'
          ? conversation.character.backgroundImage
          : conversation.character.backgroundImage.uri)
        : (typeof conversation.character.image === 'string'
          ? conversation.character.image
          : conversation.character.image.uri)
    });
  };

  const markAsRead = async (characterId: string) => {
    try {
      // Update the conversation's unread status
      const updatedConversations = conversations.map(conv => {
        if (conv.character.id === characterId) {
          return { ...conv, unread: false };
        }
        return conv;
      });
      
      setConversations(updatedConversations);
      await AsyncStorage.setItem('inbox_conversations', JSON.stringify(updatedConversations));
      
      // Also update the individual conversation data
      const convoData = await AsyncStorage.getItem(`chat_${characterId}`);
      if (convoData) {
        const parsedData = JSON.parse(convoData);
        parsedData.unread = false;
        await AsyncStorage.setItem(`chat_${characterId}`, JSON.stringify(parsedData));
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  // Show delete confirmation modal
  const handleShowDeleteModal = (conversation: ConversationData) => {
    setSelectedConversation(conversation);
    setShowDeleteModal(true);
  };

  const handleNewChat = () => {
    // Navigate to home screen to select a new character
    navigation.navigate('HomeTab');
  };

  const deleteConversation = async () => {
    if (!selectedConversation) return;
    
    try {
      // Remove from AsyncStorage
      await AsyncStorage.removeItem(`chat_${selectedConversation.character.id}`);
      
      // Update inbox list
      const updatedConversations = conversations.filter(
        conv => conv.character.id !== selectedConversation.character.id
      );
      setConversations(updatedConversations);
      
      // Update inbox_conversations in AsyncStorage
      await AsyncStorage.setItem('inbox_conversations', JSON.stringify(updatedConversations));
      
      // Remove unnecessary toast
      // Toast.success("Conversation Deleted");
      
      // Close modal
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      // Keep error toast for critical failures only
      Toast.error("Delete Failed");
    }
  };

  const renderConversation = ({ item, index }: { item: ConversationData; index: number }) => {
    const imageUri = typeof item.character.image === 'string' 
      ? item.character.image 
      : item.character.image.uri;
      
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100)}
        className="mb-4"
      >
        <TouchableOpacity
          className="flex-row items-center px-4 py-3 bg-white/5 rounded-2xl"
          activeOpacity={0.7}
          onPress={() => handleConversationPress(item)}
        >
          <Image
            source={{ uri: imageUri }}
            className="w-12 h-12 rounded-full"
          />
          <View className="flex-1 ml-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-white font-semibold text-base">
                {item.character.name}
              </Text>
              <Text className="text-gray-400 text-sm">
                {formatMessageTime(item.lastMessageTime)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center mt-1">
              <Text 
                className="text-gray-300 text-sm flex-1 mr-2"
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
              <View className="flex-row items-center">
                {item.unread && (
                  <View className="bg-pink-500 w-2 h-2 rounded-full mr-3" />
                )}
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleShowDeleteModal(item);
                  }}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Icon name="delete-outline" size={18} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyList = () => (
    <View className="flex-1 items-center justify-center p-8">
      <Icon name="message-text-outline" size={64} color="rgba(255,255,255,0.2)" />
      <Text className="text-white/50 text-center mt-4 text-lg">
        No conversations yet
      </Text>
      <Text className="text-white/40 text-center mt-2">
        Start a chat with a character to begin a conversation
      </Text>
      <TouchableOpacity
        className="bg-pink-500 rounded-full px-6 py-3 mt-6 flex-row items-center"
        onPress={handleNewChat}
      >
        <Icon name="message-plus-outline" size={20} color="#fff" className="mr-2" />
        <Text className="text-white font-semibold ml-2">Start new chat</Text>
      </TouchableOpacity>
    </View>
  );

  // Delete confirmation modal
  const renderDeleteModal = () => {
    if (!selectedConversation) return null;
    
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable 
          style={[
            StyleSheet.absoluteFill, 
            { backgroundColor: 'rgba(0,0,0,0.5)' }
          ]} 
          onPress={() => setShowDeleteModal(false)}
        />
        <Animated.View 
          entering={FadeIn}
          className="flex-1 justify-center items-center px-5"
        >
          <View className="bg-[#1F2937] rounded-2xl w-full max-w-xs overflow-hidden border border-gray-700">
            <LinearGradient
              colors={['rgba(31,41,55,0.8)', 'rgba(17,24,39,0.95)']}
              className="p-5"
            >
              <Text className="text-white text-xl font-bold text-center mb-1">Delete Conversation</Text>
              <Text className="text-gray-300 text-center mb-5">
                Are you sure you want to delete your conversation with {selectedConversation.character.name}? This action cannot be undone.
              </Text>
              
              <View className="flex-row justify-between space-x-3 gap-4">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-gray-700"
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text className="text-white font-semibold text-center">Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-red-500"
                  onPress={deleteConversation}
                >
                  <Text className="text-white font-semibold text-center">Delete</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </Modal>
    );
  };

  return (
    <View className="flex-1 bg-[#111827]">
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent
      />
      
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Messages</Text>
            <TouchableOpacity 
              onPress={handleNewChat}
              className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-2xl"
            >
              <Icon name="message-plus-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#EC4899" />
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={item => item.character.id}
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

        {renderDeleteModal()}
      </SafeAreaView>
    </View>
  );
};

export default InboxScreen;