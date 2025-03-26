import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { HomeScreen } from '../screens/home/HomeScreen';
import InboxScreen from '../screens/inbox/InboxScreen';
import { FavoriteScreen } from '../screens/favorite/FavoriteScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { TabStackParamList, RootStackParamList } from './types';

export type TabScreenProps<T extends keyof TabStackParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabStackParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

const Tab = createBottomTabNavigator<TabStackParamList>();

const CustomTabButton = ({ children, accessibilityState, onPress }: any) => {
  const focused = accessibilityState.selected;

  return (
    <Pressable
      onPress={onPress}
      className={`items-center justify-center flex-1`}
    >
      <View 
        className={`items-center justify-center p-2 rounded-2xl ${
          focused ? '' : ''
        }`}
        style={{
          transform: [{ scale: focused ? 1.1 : 1 }],
        }}
      >
        {children}
      </View>
    </Pressable>
  );
};

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#111827',
        },
        headerTintColor: 'white',
        tabBarStyle: {
          backgroundColor: '#111827',
          height: 65 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 12,
          elevation: 0,
          borderTopWidth: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTopColor: 'transparent',
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -8,
          },
          shadowOpacity: 0.1,
          shadowRadius: 24,
        },
        tabBarActiveTintColor: '#EC4899',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarShowLabel: true,
        tabBarButton: (props) => <CustomTabButton {...props} />,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarBackground: () => (
          <View className="absolute inset-0 overflow-hidden">
            <View className="absolute inset-0 bg-[#111827]/95 backdrop-blur-xl" />
            <View className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" />
          </View>
        )
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          headerShown: false,
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Animated.View entering={FadeInDown}>
              <Icon name="home-outline" color={color} size={22} />
            </Animated.View>
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Animated.View entering={FadeInDown.delay(100)}>
              <Icon name="chatbubble-ellipses-outline" color={color} size={22} />
            </Animated.View>
          ),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoriteScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Animated.View entering={FadeInDown.delay(200)}>
              <Icon name="heart-outline" color={color} size={22} />
            </Animated.View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Animated.View entering={FadeInDown.delay(300)}>
              <Icon name="person-outline" color={color} size={22} />
            </Animated.View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}; 