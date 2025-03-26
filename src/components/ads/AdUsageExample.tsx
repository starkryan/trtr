import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, Platform } from 'react-native';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import BannerAdComponent from './BannerAdComponent';
import { useInterstitialAd, useRewardedAd } from '../../hooks/useAdMob';
import AdMobService from '../../services/AdMobService';

/**
 * Example component showing how to use all types of ads
 */
const AdUsageExample: React.FC = () => {
  // App Open Ads
  const showAppOpenAd = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not Supported', 'App Open ads are only supported on Android in this app.');
      return;
    }
    
    const shown = await AdMobService.getInstance().showAppOpenAd();
    
    if (!shown) {
      Alert.alert('No Ad Available', 'No app open ad was ready to show.');
    }
  };
  
  // Interstitial Ads using the optimized hook (which uses AdMobService)
  const { show: showInterstitial, isLoaded: isInterstitialLoaded } = useInterstitialAd();
  
  // Rewarded Ads using the optimized hook (which uses AdMobService)
  const { 
    show: showRewarded, 
    isLoaded: isRewardedLoaded,
    earned: rewardEarned,
    reward: earnedReward
  } = useRewardedAd();
  
  // Handle rewards
  useEffect(() => {
    if (rewardEarned && earnedReward) {
      Alert.alert(
        'Reward Earned!', 
        `You earned a reward of ${earnedReward.amount} ${earnedReward.type}`
      );
    }
  }, [rewardEarned, earnedReward]);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AdMob Examples</Text>
      
      {/* Banner Ad */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Banner Ad</Text>
        <BannerAdComponent 
          size={BannerAdSize.BANNER} 
          useSimulatorAdUnit={__DEV__} // Use simulator ad unit in development
        />
      </View>
      
      {/* Large Banner Ad */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Large Banner Ad</Text>
        <BannerAdComponent 
          size={BannerAdSize.LARGE_BANNER} 
          useSimulatorAdUnit={__DEV__} // Use simulator ad unit in development
        />
      </View>
      
      {/* App Open Ad */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Open Ad</Text>
        <Button 
          title="Show App Open Ad" 
          onPress={showAppOpenAd} 
        />
      </View>
      
      {/* Interstitial Ad */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interstitial Ad</Text>
        <Button 
          title={isInterstitialLoaded ? "Show Interstitial Ad" : "Loading Interstitial Ad..."}
          onPress={showInterstitial}
          disabled={!isInterstitialLoaded}
        />
      </View>
      
      {/* Rewarded Ad */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rewarded Ad</Text>
        <Button 
          title={isRewardedLoaded ? "Watch Ad for Reward" : "Loading Rewarded Ad..."}
          onPress={showRewarded}
          disabled={!isRewardedLoaded}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#111827',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E5E7EB',
    marginBottom: 8,
  },
});

export default AdUsageExample; 