import React from 'react';
import { View, Pressable, Dimensions, StyleSheet, Text } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { MaterialTopTabScreenProps } from '@react-navigation/material-top-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { HomeScreen } from '../screens/home/HomeScreen';
import InboxScreen from '../screens/inbox/InboxScreen';
import { FavoriteScreen } from '../screens/favorite/FavoriteScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { TabStackParamList, RootStackParamList } from './types';

export type TabScreenProps<T extends keyof TabStackParamList> = CompositeScreenProps<
  MaterialTopTabScreenProps<TabStackParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

const Tab = createMaterialTopTabNavigator<TabStackParamList>();
const { width, height } = Dimensions.get('window');

// Custom tab bar item to control the layout and appearance
const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View 
      style={{
        flexDirection: 'row',
        backgroundColor: 'transparent',
        height: 65 + insets.bottom,
        paddingBottom: insets.bottom,
        borderTopColor: 'transparent',
      }}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.title || route.name;
        const isFocused = state.index === index;
        
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <View 
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                transform: [{ scale: isFocused ? 1.05 : 1 }],
              }}
            >
              <View
                style={{
                  padding: 8,
                  borderRadius: isFocused ? 16 : 12,
                  backgroundColor: isFocused ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  borderWidth: 1,
                  borderColor: isFocused ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                }}
              >
                {options.tabBarIcon && options.tabBarIcon({ 
                  color: isFocused ? '#fff' : 'rgba(255, 255, 255, 0.6)', 
                  focused: isFocused,
                  size: 22 
                })}
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: isFocused ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  marginTop: 4,
                }}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

export const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#111827' }}>
      <Tab.Navigator
        style={{
          position: 'relative',
          minHeight: height - (48 + insets.bottom),
        }}
        tabBarPosition="bottom"
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{
          tabBarIndicatorStyle: {
            opacity: 0,
            height: 0,
          },
          swipeEnabled: true,
          animationEnabled: true,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
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
            title: 'Inbox',
            tabBarIcon: ({ color }) => (
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
            title: 'Favorites',
            tabBarIcon: ({ color }) => (
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
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <Animated.View entering={FadeInDown.delay(300)}>
                <Icon name="person-outline" color={color} size={22} />
              </Animated.View>
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}; 