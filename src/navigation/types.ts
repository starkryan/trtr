import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Tab navigator types
export type TabStackParamList = {
  HomeTab: undefined;
  Inbox: undefined;
  Favorites: undefined;
  Profile: undefined;
};

// Root stack navigator types
export type RootStackParamList = {
  Onboarding: undefined;
  NotificationPermission: undefined;
  Tabs: NavigatorScreenParams<TabStackParamList>;
  Character: { profile?: any; characterId?: string; id?: string };
  Chat: {
    profile: any;
    characterId: string;
    uncensored?: boolean;
    characterName: string;
    characterImage: string;
    characterBackground?: string;
  };
  Search: undefined;
  Premium: {
    fromOnboarding?: boolean;
  };
  IncomingCall: {
    videoUrls: string[]; // Changed to array of video URLs
    callerName: string;
    callerImage?: string;
  };
};

// Screen props types
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabStackParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabStackParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}
