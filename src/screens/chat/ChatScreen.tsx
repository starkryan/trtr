import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Alert, Image, ImageBackground, StatusBar, TouchableOpacity, Animated, Keyboard, EmitterSubscription, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { sendMessage } from '../../api/services/chat';
import { Message } from '../../api/services/character';
import { reportMessage as reportAPI } from '../../api/services/report';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Profile } from '../home/HomeScreen';
import { LinearGradient } from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRewardedAd } from '../../hooks/useAdMob';
import { useCoinStore } from '../../store/useCoinStore';
import Toast from 'toastify-react-native';
import BannerAdComponent from '../../components/ads/BannerAdComponent';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import MarkdownMessage from '../../components/MarkdownMessage';
import { useInterstitialAd } from '../../hooks/useAdMob';
import auth from '@react-native-firebase/auth';

// Maximum message count before showing ad prompt
const MAX_FREE_MESSAGES = 5;

export interface ConversationData {
  character: {
    id: string;
    name: string;
    image: string | { uri: string };
    backgroundImage?: string | { uri: string };
  };
  lastMessage: string;
  lastMessageTime: Date;
  unread: boolean;
}

type ChatScreenParams = {
  characterId: string;
  profile: Profile;
  uncensored: boolean;
  characterName: string;
  characterImage: string;
  characterBackground: string;
};

type Props = NativeStackScreenProps<any, 'Chat'>;

function ChatScreen({ route, navigation }: Props) {
  const { characterId, profile } = route.params as ChatScreenParams;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showRewardedAdPrompt, setShowRewardedAdPrompt] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isSendingMessage = useRef(false);
  const typingAnimation = useRef(new Animated.Value(0)).current;
  const [showCallModal, setShowCallModal] = useState(false);
  
  // Report feature state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  // Calculate Header Height for Keyboard Offset (Estimate)
  // Adjust this value based on your actual header's final height
  const HEADER_HEIGHT_ESTIMATE = 70; 
  const keyboardOffset = Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT_ESTIMATE : 0;
  
  // Initialize rewarded ad
  const { isLoaded: rewardedAdLoaded, load: loadRewardedAd, show: showRewardedAd, earned, reward } = useRewardedAd();
  const { addCoins, removeCoins, coins } = useCoinStore();

  // Add a reference to interstitial ad for call button
  const { isLoaded: interstitialAdLoaded, load: loadInterstitialAd, show: showInterstitialAd } = useInterstitialAd();

  // Initialize Firebase authentication
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if user is already signed in
        const currentUser = auth().currentUser;
        
        if (!currentUser) {
          // Sign in anonymously if no user exists
          await auth().signInAnonymously();
          console.log('User signed in anonymously');
        } else {
          console.log('User already signed in', currentUser.uid);
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Firebase authentication error:', error);
        // Continue even if auth fails - the backend will handle unauthenticated requests
        setIsAuthenticated(true);
      }
    };
    
    initializeAuth();
    
    // Listen for auth state changes
    const unsubscribe = auth().onAuthStateChanged(user => {
      setIsAuthenticated(!!user);
    });
    
    return () => unsubscribe();
  }, []);

  // Get the correct image URI
  const getImageUri = (image: string | { uri: string }) => {
    return typeof image === 'string' ? image : image.uri;
  };

  const profileImage = getImageUri(profile.image);
  const backgroundImage = getImageUri(profile.backgroundImage || profile.image);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      // Small delay to ensure the layout is complete
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 50);
    }
  }, [messages.length]);

  // Handle keyboard show/hide events
  useEffect(() => {
    let keyboardDidShowListener: EmitterSubscription;
    let keyboardDidHideListener: EmitterSubscription;
    
    if (Platform.OS === 'ios') {
      keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
        scrollToBottom();
      });
      
      keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        scrollToBottom();
      });
    }
    
    return () => {
      if (Platform.OS === 'ios') {
        keyboardDidShowListener?.remove();
        keyboardDidHideListener?.remove();
      }
    };
  }, [scrollToBottom]);

  // Scroll when messages change
  useEffect(() => {
    if (messages.length > 0 && !isSendingMessage.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Load existing messages on mount
  useEffect(() => {
    loadMessages();
    
    // Load rewarded ad
    if (Platform.OS === 'android') {
      loadRewardedAd().catch(err => {
        console.log('Failed to load rewarded ad:', err);
      });
      
      // Load interstitial ad for call button
      loadInterstitialAd().catch(err => {
        console.log('Failed to load interstitial ad:', err);
      });
    }
  }, [characterId, loadRewardedAd, loadInterstitialAd]);

  // Handle earned rewards
  useEffect(() => {
    if (earned && reward) {
      const rewardAmount = 10;
      addCoins(rewardAmount);
      Toast.success(`You earned ${rewardAmount} coins! Continue chatting.`);
      setShowRewardedAdPrompt(false);
      setMessageCount(0);
    }
  }, [earned, reward, addCoins]);

  // Load messages from storage
  const loadMessages = async () => {
    try {
      const storedMessages = await AsyncStorage.getItem(`chat_${characterId}`);
      if (storedMessages) {
        const { messages: savedMessages } = JSON.parse(storedMessages);
        if (Array.isArray(savedMessages) && savedMessages.length > 0) {
          setMessages(savedMessages);
          setMessageCount(savedMessages.length);
          // Scroll to bottom after loading messages
          scrollToBottom(false);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Save conversation to inbox
  const saveToInbox = async (lastMessage: string, allMessages: Message[]) => {
    try {
      // Get existing conversations
      const inboxData = await AsyncStorage.getItem('inbox_conversations');
      let conversations: ConversationData[] = inboxData ? JSON.parse(inboxData) : [];

      // Create or update conversation data
      const conversationData: ConversationData = {
        character: {
          id: characterId,
          name: profile.name,
          image: profile.image,
          backgroundImage: profile.backgroundImage
        },
        lastMessage,
        lastMessageTime: new Date(),
        unread: false
      };

      // Remove existing conversation if it exists
      conversations = conversations.filter(c => c.character.id !== characterId);
      // Add new conversation at the beginning
      conversations.unshift(conversationData);

      // Save updated conversations
      await AsyncStorage.setItem('inbox_conversations', JSON.stringify(conversations));

      // Save complete chat messages (both user messages and AI responses)
      await AsyncStorage.setItem(`chat_${characterId}`, JSON.stringify({
        messages: allMessages,
        unread: false
      }));
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  // Navigate to character profile
  const goToCharacterProfile = () => {
    navigation.navigate('Character', { profile, characterId });
  };

  // Validate characterId on mount
  React.useEffect(() => {
    if (!characterId) {
      Alert.alert(
        'Error',
        'No character selected',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [characterId, navigation]);

  const checkMessageLimit = useCallback(() => {
    const newCount = messageCount + 1;
    setMessageCount(newCount);
    
    // Check if we've reached the limit and should show the ad prompt
    if (newCount > 0 && newCount % MAX_FREE_MESSAGES === 0) {
      // If user has enough coins, just deduct and continue
      if (coins >= 2) {
        removeCoins(2);
        Toast.info('2 coins used for more messages');
        return true;
      } else {
        setShowRewardedAdPrompt(true);
        return false;
      }
    }
    return true;
  }, [messageCount, coins, removeCoins]);

  const handleWatchRewardedAd = useCallback(async () => {
    if (rewardedAdLoaded) {
      try {
        await showRewardedAd();
      } catch (error) {
        console.error('Error showing rewarded ad:', error);
        Toast.error('Failed to show ad. Please try again.');
      }
    } else {
      Toast.info('Ad not ready yet. Loading...');
      try {
        await loadRewardedAd();
        Toast.info('Please try again in a moment');
      } catch (err) {
        console.error('Failed to load rewarded ad:', err);
      }
    }
  }, [rewardedAdLoaded, showRewardedAd, loadRewardedAd]);

  // Handle reporting a message
  const handleReportMessage = (message: Message) => {
    if (!message.isUser) {
      setReportedMessage(message);
      setShowReportModal(true);
    }
  };

  // Submit report
  const handleSubmitReport = async () => {
    if (!reportedMessage || !reportReason) {
      Toast.error('Please select a reason for reporting');
      return;
    }
    
    if (!isAuthenticated) {
      Toast.error('Authentication required to submit report');
      return;
    }
    
    setIsSubmittingReport(true);
    
    try {
      // Submit report to API
      await reportAPI({
        characterId,
        messageContent: reportedMessage.text,
        reason: reportReason,
        metadata: {
          messageId: reportedMessage.id,
          messageTimestamp: reportedMessage.timestamp,
          conversationId: `chat_${characterId}`
        }
      });
      
      Toast.success('Thank you for your report');
      setShowReportModal(false);
      setReportedMessage(null);
      setReportReason('');
    } catch (error) {
      console.error('Error submitting report:', error);
      Toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Restore typing animation component
  const TypingIndicator = () => {
    useEffect(() => {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true
          }),
          Animated.timing(typingAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true
          })
        ])
      );
      
      animation.start();
      
      return () => animation.stop();
    }, []);

    return (
      <View className="flex-row mb-4 mx-4">
        <Image
          source={{ uri: profileImage }}
          className="w-8 h-8 rounded-full mr-2"
          style={{ alignSelf: 'flex-end' }}
        />
        <View className="rounded-2xl px-4 py-3 bg-gray-700/90 flex-row items-center space-x-1">
          <Animated.View 
            className="w-2 h-2 rounded-full bg-gray-400"
            style={{ opacity: typingAnimation }}
          />
          <Animated.View 
            className="w-2 h-2 rounded-full bg-gray-400"
            style={{ opacity: typingAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1]
            }) }}
          />
          <Animated.View 
            className="w-2 h-2 rounded-full bg-gray-400"
            style={{ opacity: typingAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 1]
            }) }}
          />
        </View>
      </View>
    );
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;
    if (!characterId) {
      Alert.alert('Error', 'No character selected');
      return;
    }
    
    // Check if user can send more messages
    if (showRewardedAdPrompt) {
      Toast.info('Please watch an ad or use coins to continue');
      return;
    }
    
    // Check message limit
    if (!checkMessageLimit()) {
      return;
    }

    isSendingMessage.current = true;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };

    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);
    setIsTyping(true);
    
    // Immediately scroll to bottom after sending
    scrollToBottom();

    try {
      const response = await sendMessage(
        characterId,
        userMessage.text,
        updatedMessages
      );
      
      // Update messages with the response
      const finalMessages = [...updatedMessages, response];
      setMessages(finalMessages);
      
      // Save conversation after successful message
      await saveToInbox(response.text, finalMessages);
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: "I'm having trouble connecting right now. Can you try again in a moment?",
        isUser: false,
        timestamp: new Date()
      };
      const messagesWithError = [...updatedMessages, errorMessage];
      setMessages(messagesWithError);
      
      await saveToInbox(errorMessage.text, messagesWithError);

      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Failed to send message'
      );
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      isSendingMessage.current = false;
      // Ensure we scroll again after the AI response is received
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [inputText, messages, characterId, showRewardedAdPrompt, checkMessageLimit, scrollToBottom]);

  // Format time to 12-hour format with AM/PM
  const formatTime = (timestamp: Date | string): string => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12; // Convert 0 to 12
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View 
      className={`flex-row ${item.isUser ? 'justify-end' : 'justify-start'} mb-4 mx-4`}
    >
      {!item.isUser && (
        <Image
          source={{ uri: profileImage }}
          className="w-8 h-8 rounded-full mr-2"
          style={{ alignSelf: 'flex-end' }}
        />
      )}
      <View 
        className={`rounded-2xl px-4 py-2 max-w-[75%] ${
          item.isUser ? 'bg-blue-500/90' : 'bg-gray-700/90'
        }`}
      >
        <MarkdownMessage text={item.text} isUser={item.isUser} />
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-xs text-gray-300">
            {formatTime(item.timestamp)}
          </Text>
          {!item.isUser && (
            <TouchableOpacity 
              onPress={() => handleReportMessage(item)}
              className="ml-2"
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Icon name="flag-outline" size={12} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  // Render the rewarded ad prompt
  const renderRewardedAdPrompt = () => {
    if (!showRewardedAdPrompt) return null;
    
    return (
      <View className="m-4 bg-gray-800/95 p-4 rounded-xl border border-pink-500/40">
        <Text className="text-white font-medium text-center mb-2">
          You've reached your free message limit
        </Text>
        <Text className="text-gray-300 text-center mb-4">
          Watch a short ad to get 10 coins or use 2 coins to continue chatting
        </Text>
        <View className="flex-row justify-center space-x-3">
          {coins >= 2 && (
            <TouchableOpacity
              className="bg-blue-500 px-4 py-2 rounded-lg flex-row items-center"
              onPress={() => {
                removeCoins(2);
                setShowRewardedAdPrompt(false);
                Toast.info('2 coins used for more messages');
              }}
            >
              <Icon name="coins" size={18} color="#FFF" />
              <Text className="text-white font-medium ml-2">Use 2 Coins</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="bg-pink-500 px-4 py-2 rounded-lg flex-row items-center"
            onPress={handleWatchRewardedAd}
          >
            <Icon name="video" size={18} color="#FFF" />
            <Text className="text-white font-medium ml-2">Watch Ad</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Handle call button press
  const handleCallPress = async () => {
    Toast.info("Connecting call...");
    
    try {
      if (interstitialAdLoaded) {
        await showInterstitialAd();
        // Add coins as a reward after watching the ad
        addCoins(1);
        // Show modal instead of simple toast
        setShowCallModal(true);
      } else {
        Toast.info("Loading call interface...");
        await loadInterstitialAd();
        Toast.info("Please try calling again.");
      }
    } catch (err: unknown) {
      console.error('Error showing call ad:', err);
      Toast.error("Couldn't connect the call. Try again later.");
    }
  };

  // Render call modal
  const renderCallModal = () => {
    return (
      <Modal
        visible={showCallModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCallModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/70">
          <View className="bg-gray-800 w-[85%] rounded-3xl p-6 border border-pink-500/30">
            <View className="items-center mb-4">
              <View className="w-20 h-20 rounded-full bg-gray-700 items-center justify-center mb-4">
                <Icon name="phone-check" size={40} color="#22C55E" />
              </View>
              <Text className="text-white text-xl font-bold mb-1">Call Feature Coming Soon!</Text>
              <Text className="text-gray-300 text-center mb-4">
                Video and audio calls will be available in the next update. Thanks for your patience!
              </Text>
              <Text className="text-pink-400 text-sm mb-6">You earned 1 coin for testing this feature</Text>
            </View>
            
            <TouchableOpacity
              onPress={() => setShowCallModal(false)}
              className="bg-pink-500 py-3.5 rounded-xl items-center"
            >
              <Text className="text-white font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Render report modal
  const renderReportModal = () => {
    return (
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/70">
          <View className="bg-gray-800 w-[85%] rounded-3xl p-6 border border-white/20">
            <Text className="text-white text-xl font-bold mb-2 text-center">Report Content</Text>
            
            <Text className="text-gray-300 text-center mb-4">
              Please select a reason for reporting this message
            </Text>
            
            {/* Report reasons */}
            <View className="mb-4">
              {[
                { id: 'offensive_language', label: 'Offensive language' },
                { id: 'inappropriate_content', label: 'Inappropriate content' },
                { id: 'harmful_information', label: 'Harmful information' },
                { id: 'other', label: 'Other' }
              ].map(option => (
                <TouchableOpacity
                  key={option.id}
                  className={`py-3 px-4 rounded-lg mb-2 flex-row items-center ${
                    reportReason === option.id 
                      ? 'bg-pink-500/20 border border-pink-500' 
                      : 'bg-gray-700 border border-gray-600'
                  }`}
                  onPress={() => setReportReason(option.id)}
                >
                  <View className={`w-5 h-5 rounded-full mr-3 items-center justify-center ${
                    reportReason === option.id ? 'bg-pink-500' : 'bg-gray-600'
                  }`}>
                    {reportReason === option.id && (
                      <Icon name="check" size={12} color="#FFF" />
                    )}
                  </View>
                  <Text className="text-white">{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Buttons */}
            <View className="flex-row space-x-3 gap-x-3">
              <TouchableOpacity
                className="flex-1 bg-gray-700 py-3 rounded-xl"
                onPress={() => setShowReportModal(false)}
              >
                <Text className="text-white font-medium text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl ${
                  reportReason ? 'bg-pink-500' : 'bg-pink-500/50'
                }`}
                onPress={handleSubmitReport}
                disabled={!reportReason || isSubmittingReport}
              >
                {isSubmittingReport ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-white font-medium text-center">Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      keyboardVerticalOffset={keyboardOffset}
    >
      {/* Call modal */}
      {renderCallModal()}
      
      {/* Report modal */}
      {renderReportModal()}
      
      <View className="flex-1 bg-[#111827]">
        <StatusBar
          backgroundColor="transparent"
          barStyle="light-content"
          translucent
        />
        <View 
          className="absolute top-0 left-0 right-0 z-30 bg-[#111827]"
          style={{ height: insets.top }}
        />
        <ImageBackground
          source={{ uri: backgroundImage }}
          className="flex-1"
        >
          <LinearGradient
            colors={['rgba(17, 24, 39, 0.95)', 'rgba(17, 24, 39, 0.9)']}
            className="flex-1"
          >
            {/* Header */}
            <View 
              className="px-4 pt-4 pb-2 bg-[#111827] border-b border-gray-800 z-20" 
              style={{ paddingTop: insets.top + 12 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-2.5 rounded-xl mr-3"
                  >
                    <Icon name="arrow-left" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={goToCharacterProfile}
                    className="flex-row items-center"
                  >
                    <Image 
                      source={{ uri: profileImage }}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                    <View>
                      <Text className="text-white text-lg font-bold">{profile.name}</Text>
                      <Text className="text-white/60 text-xs">Online now</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <View className="flex-row items-center space-x-3 gap-x-3">
                  <TouchableOpacity 
                    onPress={handleCallPress}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-2.5 rounded-xl"
                  >
                    <Icon name="phone" size={20} color="#22C55E" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className="bg-white/10 backdrop-blur-xl border border-white/20 px-3 py-2 rounded-xl flex-row items-center"
                    onPress={() => Toast.info("Current coin balance")}
                  >
                    <Image 
                      source={require('../../../assets/coin.png')} 
                      className="w-5 h-5 mr-1.5"
                    />
                    <Text className="text-white font-medium">{coins}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            {/* Banner Ad */}
            {Platform.OS === 'android' && (
              <BannerAdComponent
                size={BannerAdSize.BANNER}
                containerStyle={{ marginVertical: 4 }}
              />
            )}

            {/* Chat Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
              onContentSizeChange={() => {
                if (isSendingMessage.current || isTyping) {
                  scrollToBottom();
                }
              }}
              onLayout={() => {
                if (messages.length > 0) {
                  scrollToBottom(false);
                }
              }}
              ListEmptyComponent={
                <View className="flex-1 justify-center items-center py-20">
                  <Text className="text-gray-400 text-center">
                    No messages yet. Say hello to {profile.name}!
                  </Text>
                </View>
              }
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
            />

            {/* Input Area Container */}
            <View className="bg-gray-800/80 backdrop-blur-sm border-t border-gray-700/50">
              {/* Rewarded Ad Prompt - Moved above input */}
              {renderRewardedAdPrompt()}

              {/* Message Input */}
              <View className="p-2">
                <View className="flex-row items-center bg-gray-700/70 rounded-full px-3 py-1">
                  <TouchableOpacity className="mr-2" disabled={isLoading || showRewardedAdPrompt}>
                    <Icon name="emoticon-outline" size={24} color={isLoading || showRewardedAdPrompt ? "#6B7280" : "#fff"} />
                  </TouchableOpacity>
                  <TextInput
                    className="flex-1 text-white py-2 px-1"
                    placeholder={showRewardedAdPrompt ? "Please watch ad or use coins" : "Type a message..."}
                    placeholderTextColor="#9CA3AF"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    editable={!isLoading && !showRewardedAdPrompt}
                    style={{ color: isLoading || showRewardedAdPrompt ? '#6B7280' : '#FFFFFF' }}
                  />
                  <Pressable 
                    onPress={handleSendMessage} 
                    disabled={isLoading || inputText.trim() === '' || showRewardedAdPrompt}
                  >
                    <View 
                      className={`w-9 h-9 rounded-full items-center justify-center ${
                        inputText.trim() && !isLoading && !showRewardedAdPrompt ? 'bg-pink-600' : 'bg-gray-600'
                      }`}
                    >
                      <Icon name="send" size={18} color="#fff" />
                    </View>
                  </Pressable>
                </View>
                {!showRewardedAdPrompt && (
                  <Text className="text-gray-400 text-xs text-center mt-1">
                    {MAX_FREE_MESSAGES - (messageCount % MAX_FREE_MESSAGES)} messages left in cycle
                  </Text>
                )}
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    </KeyboardAvoidingView>
  );
}

export default ChatScreen;