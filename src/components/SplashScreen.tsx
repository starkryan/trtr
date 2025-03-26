import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

interface SplashScreenProps {
  onAnimationFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationFinish }) => {
  const opacity = useSharedValue(1);
  const backgroundOpacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const glow = useSharedValue(0.4);
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.5);

  // Handle animation completion
  const handleAnimationComplete = () => {
    opacity.value = withTiming(0, { 
      duration: 800,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }, (finished) => {
      if (finished) {
        runOnJS(onAnimationFinish)();
      }
    });
  };

  useEffect(() => {
    // Fade in background immediately
    backgroundOpacity.value = withTiming(1, { 
      duration: 500,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    // Scale up animation with bounce immediately
    scale.value = withSequence(
      withTiming(1.1, { 
        duration: 300,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      withTiming(1, { 
        duration: 150,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      })
    );

    // Add subtle pulsing effect
    glow.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800 }),
        withTiming(0.4, { duration: 800 })
      ),
      -1,
      true
    );

    // Animate text immediately
    textOpacity.value = withTiming(1, { duration: 500 });
    textScale.value = withSequence(
      withTiming(1.1, { duration: 300 }),
      withTiming(1, { duration: 150 })
    );

    // Reduce total animation duration
    const timeout = setTimeout(() => {
      handleAnimationComplete();
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const gradientStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.fullSize, gradientStyle]}>
        <LinearGradient
          colors={['#1a0b2e', '#3d2352', '#1a0b2e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fullSize}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'transparent']}
          locations={[0.2, 0.8]}
          style={styles.fullSize}
          pointerEvents="none"
        />
      </Animated.View>
      
      <View style={styles.contentContainer}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Animated.Image 
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.Text style={[styles.text, textStyle]}>
          Welcome to Chumzr
        </Animated.Text>
      </View>
    </Animated.View>
  );
};

const { width, height } = Dimensions.get('window');
const splashSize = Math.min(width, height) * 0.6;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0818',
  },
  fullSize: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: splashSize,
    height: splashSize,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff79c6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  logo: {
    width: '80%',
    height: '80%',
  },
  text: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    marginTop: 20,
    textShadowColor: '#ff79c6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  }
});

export default SplashScreen; 