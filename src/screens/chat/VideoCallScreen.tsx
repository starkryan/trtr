import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, Image, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native'; // Import useNavigation

const { width, height } = Dimensions.get('window');

interface VideoCallScreenParams {
  videoUrls: string[];
  callerName: string;
  callerImage?: string;
}

const VideoCallScreen: React.FC = () => {
  const route = useRoute();
  const { videoUrls, callerName, callerImage } = route.params as VideoCallScreenParams;

  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false); // State for user's camera
  const [isSpeakerOn, setIsSpeakerOn] = useState(true); // State for speaker

  useEffect(() => {
    if (videoUrls && videoUrls.length > 0) {
      const randomIndex = Math.floor(Math.random() * videoUrls.length);
      const selectedVideo = videoUrls[randomIndex];
      setCurrentVideoUrl(selectedVideo);
    } else {
      setCurrentVideoUrl(null);
    }
  }, [videoUrls]);

  const navigation = useNavigation(); // Get navigation object

  const handleEndCall = () => {
    // Implement navigation back or call dismissal logic here
    navigation.goBack(); // Navigate back to the previous screen
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const toggleCamera = () => {
    setIsCameraOn(prev => !prev);
    // In a real app, you would control the camera stream here
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(prev => !prev);
    // In a real app, you would control the audio output here
  };

  return (
    <SafeAreaView className="flex-1 bg-black justify-center items-center">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      {currentVideoUrl ? (
        <>
          <Video
            source={{ uri: currentVideoUrl }}
            style={{ width: width, height: height }}
            resizeMode="cover"
            repeat={true}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="obey"
            muted={isMuted}
            paused={false}
            controls={false} // Changed to false to use custom controls
            onLoad={(data) => console.log('VideoCallScreen: Video loaded:', data)}
            onError={(error) => console.error('VideoCallScreen: Video error:', error)}
          />
          {/* Caller's image when video is not playing */}
          {!currentVideoUrl && callerImage && (
            <Image source={{ uri: callerImage }} className="w-full h-full absolute" resizeMode="cover" />
          )}
          {/* User's small camera preview */}
          {isCameraOn && (
            <View className="absolute top-16 right-5 w-24 h-40 bg-gray-600 rounded-lg overflow-hidden border-2 border-white justify-center items-center">
              <Text className="text-white text-xs">You are</Text>
            </View>
          )}

          {/* Video Call Controls */}
          <View className="absolute bottom-8 flex-row justify-around w-full bg-black bg-opacity-60 rounded-full py-4 items-center">
            <TouchableOpacity className="items-center justify-center p-2" onPress={toggleMute}>
              <Icon name={isMuted ? "microphone-off" : "microphone"} size={30} color="white" />
              <Text className="text-white text-xs mt-1">{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center justify-center p-2" onPress={toggleCamera}>
              <Icon name={isCameraOn ? "video" : "video-off"} size={30} color="white" />
              <Text className="text-white text-xs mt-1">{isCameraOn ? 'Camera Off' : 'Camera On'}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-red-500 rounded-full w-16 h-16 justify-center items-center mx-2" onPress={handleEndCall}>
              <Icon name="phone-hangup" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity className="items-center justify-center p-2" onPress={toggleSpeaker}>
              <Icon name={isSpeakerOn ? "volume-high" : "volume-off"} size={30} color="white" />
              <Text className="text-white text-xs mt-1">{isSpeakerOn ? 'Speaker Off' : 'Speaker On'}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="items-center justify-center p-2">
              <Icon name="image-multiple" size={30} color="white" />
              <Text className="text-white text-xs mt-1">Gallery</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View className="absolute top-1/2 -mt-5 self-center bg-black bg-opacity-50 p-2 rounded-md">
          <Text className="text-white text-lg">Video not available.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default VideoCallScreen;
