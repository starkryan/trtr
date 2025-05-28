import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // For icons
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions'; // Import permissions

const { width, height } = Dimensions.get('window');

interface IncomingCallProps {
  videoUrls: string[];
  callerName: string;
  callerImage?: string;
  onAccept: () => void; // Callback to dismiss the incoming call UI from App.tsx
  onDecline: () => void; // Callback to dismiss the incoming call UI from App.tsx
}

const IncomingCall: React.FC<IncomingCallProps> = ({ videoUrls, callerName, callerImage, onAccept, onDecline }) => {
  const [callAccepted, setCallAccepted] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false); // State for user's camera
  const [isSpeakerOn, setIsSpeakerOn] = useState(true); // State for speaker

  useEffect(() => {
    if (callAccepted && videoUrls && videoUrls.length > 0) {
      const randomIndex = Math.floor(Math.random() * videoUrls.length);
      setCurrentVideoUrl(videoUrls[randomIndex]);
    }
  }, [callAccepted, videoUrls]);

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
        setIsCameraOn(true); // Turn on camera if permission granted
      } else {
        console.log('Camera permission denied');
        setIsCameraOn(false);
      }
    }
  };

  const handleAcceptCall = async () => {
    await requestCameraPermission();
    setCallAccepted(true);
    // Do not call onAccept here, as it's meant to dismiss the component from App.tsx
    // The component will now manage its own accepted state and display video
  };

  const handleDeclineCall = () => {
    onDecline(); // Call the prop to dismiss the component from App.tsx
  };

  const handleEndCall = () => {
    onDecline(); // Use onDecline to dismiss the component from App.tsx
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

  if (!callAccepted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.incomingCallContainer}>
          <Image
            source={callerImage ? { uri: callerImage } : require('../../assets/avatar.png')}
            style={styles.callerImage}
          />
          <Text style={styles.callerName}>{callerName || 'Unknown Caller'}</Text>
          <Text style={styles.callStatus}>Incoming Call</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.declineButton]} onPress={handleDeclineCall}>
              <Icon name="phone-hangup" size={30} color="white" />
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={handleAcceptCall}>
              <Icon name="phone" size={30} color="white" />
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentVideoUrl ? (
        <>
          <Video
            source={{ uri: currentVideoUrl }}
            style={styles.video}
            resizeMode="cover"
            repeat={true}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="obey"
            muted={isMuted}
          />
          {/* User's small camera preview */}
          {isCameraOn && (
            <View style={styles.selfCameraPreview}>
              {/* Placeholder for user's camera feed */}
              <Text style={styles.selfCameraText}>Your Camera</Text>
              {/* In a real app, you'd use a camera component here, e.g., from react-native-camera */}
            </View>
          )}

          {/* Caller Info Overlay */}
          <View style={styles.callerInfoOverlay}>
            <TouchableOpacity style={styles.backButton} onPress={handleEndCall}>
              <Icon name="chevron-left" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.callerDetails}>
              <Image
                source={callerImage ? { uri: callerImage } : require('../../assets/avatar.png')}
                style={styles.overlayCallerImage}
              />
              <View>
                <Text style={styles.overlayCallerName}>{callerName || 'Unknown Caller'}</Text>
                <View style={styles.liveIndicatorContainer}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                  <Text style={styles.callTimer}>15:20</Text> {/* Placeholder for call timer */}
                </View>
              </View>
            </View>
          </View>

          {/* Video Call Controls */}
          <View style={styles.videoCallControls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
              <Icon name={isMuted ? "microphone-off" : "microphone"} size={30} color="white" />
              <Text style={styles.controlButtonText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Icon name={isCameraOn ? "video" : "video-off"} size={30} color="white" />
              <Text style={styles.controlButtonText}>{isCameraOn ? 'Camera Off' : 'Camera On'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={handleEndCall}>
              <Icon name="phone-hangup" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
              <Icon name={isSpeakerOn ? "volume-high" : "volume-off"} size={30} color="white" />
              <Text style={styles.controlButtonText}>{isSpeakerOn ? 'Speaker Off' : 'Speaker On'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton}>
              <Icon name="image-multiple" size={30} color="white" />
              <Text style={styles.controlButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.overlayTextContainer}>
          <Text style={styles.overlayText}>Video not available.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingCallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#333',
  },
  callerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  callerName: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  callStatus: {
    color: '#ccc',
    fontSize: 18,
    marginBottom: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    marginHorizontal: 10,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 5,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: width,
    height: height,
  },
  overlayTextContainer: {
    position: 'absolute',
    top: height / 2 - 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
  },
  // New styles for video call UI
  selfCameraPreview: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: 'gray',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfCameraText: {
    color: 'white',
    fontSize: 12,
  },
  callerInfoOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 15,
  },
  callerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  overlayCallerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'white',
  },
  overlayCallerName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
    marginRight: 5,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  callTimer: {
    color: 'white',
    fontSize: 12,
  },
  videoCallControls: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 30, // More rounded for the control bar
    paddingVertical: 15,
    alignItems: 'center',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  endCallButton: {
    backgroundColor: '#F44336',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
  },
});

export default IncomingCall;
