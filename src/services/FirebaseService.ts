import { getAuth, signInAnonymously as firebaseSignInAnonymously, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';

/**
 * Anonymous sign-in with Firebase
 * Returns the user's Firebase UID which can be used instead of device ID
 */
export const signInAnonymously = async (): Promise<string> => {
  try {
    const auth = getAuth(getApp());
    const { user } = await firebaseSignInAnonymously(auth);
    if (!user) throw new Error('Failed to create anonymous user');
    return user.uid;
  } catch (error) {
    console.error('Anonymous sign-in error:', error);
    throw error;
  }
};

/**
 * Check if user is already authenticated
 * Returns the user's UID if already authenticated, null otherwise
 */
export const getCurrentUser = (): string | null => {
  try {
    const auth = getAuth(getApp());
    return auth.currentUser?.uid || null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  try {
    const auth = getAuth(getApp());
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}; 