import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  runOnJS,
  Easing,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

interface SplashScreenProps {
  onAnimationFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationFinish }) => {
  const opacity = useSharedValue(1);
  const backgroundOpacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const rotate = useSharedValue(0);
  const circleScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.5);
  const pathOffset = useSharedValue(0);

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
    // Initial animations
    backgroundOpacity.value = withTiming(1, { 
      duration: 500,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    // Rotate animation
    rotate.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: 8000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Circle scale animation
    circleScale.value = withSequence(
      withTiming(1.2, { duration: 600, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 500, easing: Easing.inOut(Easing.cubic) })
    );

    // Path offset animation
    pathOffset.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      true
    );

    // Text animations
    textOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    textScale.value = withDelay(400, withSpring(1, {
      damping: 12,
      stiffness: 100,
    }));

    // Complete splash screen
    const timeout = setTimeout(handleAnimationComplete, 3000);
    return () => clearTimeout(timeout);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const gradientStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const rotatingViewStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotate.value}rad` },
      { scale: scale.value }
    ],
  }));

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.fullSize, gradientStyle]}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fullSize}
        />
      </Animated.View>
      
      <View style={styles.contentContainer}>
        <Animated.View style={[styles.logoContainer, rotatingViewStyle]}>
          <Svg height={splashSize} width={splashSize} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor="#EC4899" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            
            {/* Animated circles */}
            <Animated.View style={circleStyle}>
              <Circle cx="50" cy="50" r="40" fill="none" stroke="#EC4899" strokeWidth="0.5" />
              <Circle cx="50" cy="50" r="35" fill="none" stroke="#EC4899" strokeWidth="0.3" />
              <Circle cx="50" cy="50" r="45" fill="none" stroke="#EC4899" strokeWidth="0.2" />
            </Animated.View>

            {/* Decorative paths */}
            <Path
              d="M50,10 A40,40 0 0,1 90,50"
              stroke="#EC4899"
              strokeWidth="1"
              fill="none"
              strokeDasharray="5,5"
            />
            <Path
              d="M50,90 A40,40 0 0,1 10,50"
              stroke="#EC4899"
              strokeWidth="1"
              fill="none"
              strokeDasharray="5,5"
            />
            
            {/* Center glow */}
            <Circle cx="50" cy="50" r="20" fill="url(#grad)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.logoTextContainer, textStyle]}>
          <Image 
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.Text style={[styles.subText, textStyle]}>
          Find your perfect match
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
    backgroundColor: '#0F172A',
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
  },
  logoTextContainer: {
    marginTop: 20,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 150,
    height: 50,
  },
  text: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 20,
    textShadowColor: '#EC4899',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 8,
    opacity: 0.8,
    textShadowColor: '#EC4899',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  }
});

export default SplashScreen; 