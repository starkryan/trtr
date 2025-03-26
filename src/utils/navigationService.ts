import { createNavigationContainerRef, StackActions } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

// Create the navigation reference
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate to a screen
 */
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

/**
 * Navigate and reset the navigation stack
 */
export function resetRoot(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name, params }],
    });
  }
}

/**
 * Push a new screen onto the stack
 */
export function push(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(StackActions.push(name, params));
  }
}

/**
 * Go back to the previous screen
 */
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

// Navigate to a tab
export function navigateToTab(tabName: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Tabs', { screen: tabName } as any);
  }
}

export default {
  navigate,
  resetRoot,
  push,
  goBack,
  navigateToTab,
}; 