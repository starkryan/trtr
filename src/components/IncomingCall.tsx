import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, Image, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const { width, height } = Dimensions.get('window');

interface IncomingCallProps {
  videoUrls: string[]; // Still passed, but will be forwarded to VideoCallScreen
  callerName: string;
  callerImage?: string;
  onAccept: () => void; // Callback to dismiss and navigate
  onDecline: () => void; // Callback to dismiss
}

const IncomingCall: React.FC<IncomingCallProps> = ({ videoUrls, callerName, callerImage, onAccept, onDecline }) => {

  const requestCameraPermission = async () => {
    let permission;
    if (Platform.OS === 'ios') {
      permission = PERMISSIONS.IOS.CAMERA;
    } else if (Platform.OS === 'android') {
      permission = PERMISSIONS.ANDROID.CAMERA;
    }

    if (permission) {
      const result = await request(permission);
      if (result === RESULTS.GRANTED) {
        console.log('Camera permission granted');
        return true;
      } else {
        console.log('Camera permission denied');
        return false;
      }
    }
    return false;
  };

  const handleAcceptCall = async () => {
    const cameraGranted = await requestCameraPermission();
    // Call onAccept to dismiss this component and trigger navigation to VideoCallScreen
    onAccept();
  };

  const handleDeclineCall = () => {
    onDecline(); // Call the prop to dismiss the component from App.tsx
  };

  // This component only handles the incoming call UI, not the active call.
  // So, no need for toggleMute, toggleCamera, toggleSpeaker, handleEndCall here.

  return (
    <SafeAreaView className="flex-1 bg-black justify-center items-center">
      <View className="flex-1 justify-center items-center w-full bg-gray-800">
        <Image
          source={callerImage ? { uri: callerImage } : require('../../assets/avatar.png')}
          className="w-32 h-32 rounded-full mb-5 border-2 border-white"
        />
        <Text className="text-white text-3xl font-bold mb-2">{callerName || 'Unknown Caller'}</Text>
        <Text className="text-gray-400 text-lg mb-12">Incoming Call</Text>

        <View className="flex-row justify-around w-4/5">
          <TouchableOpacity className="p-4 rounded-full bg-red-500 items-center justify-center min-w-[120px] mx-2" onPress={handleDeclineCall}>
            <Icon name="phone-hangup" size={30} color="white" />
            <Text className="text-white text-lg font-bold mt-1">Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity className="p-4 rounded-full bg-green-500 items-center justify-center min-w-[120px] mx-2" onPress={handleAcceptCall}>
            <Icon name="phone" size={30} color="white" />
            <Text className="text-white text-lg font-bold mt-1">Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default IncomingCall;
