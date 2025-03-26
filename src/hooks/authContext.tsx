import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInAnonymously, getCurrentUser, signOut as firebaseSignOut } from '../services/FirebaseService';

type UserProfile = {
  name: string;
  avatar: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  userProfile: UserProfile | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
};

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=0D8ABC&color=fff';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check authentication status and load profile on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Get Firebase user synchronously first
        const uid = getCurrentUser();
        if (!uid) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        // Load storage items in parallel
        const [hasLaunched, storedProfile] = await Promise.all([
          AsyncStorage.getItem('hasLaunched'),
          AsyncStorage.getItem('userProfile')
        ]);
        
        if (storedProfile) {
          setUserProfile(JSON.parse(storedProfile));
        }
        
        setIsAuthenticated(!!uid && hasLaunched === 'true');
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Login function - optimized for speed
  const login = async () => {
    try {
      // Start Firebase auth immediately
      const uidPromise = signInAnonymously();
      
      // Prepare profile data if needed
      const profileData = !userProfile ? {
        name: 'New User',
        avatar: DEFAULT_AVATAR
      } : null;

      // Run all async operations in parallel
      const [uid] = await Promise.all([
        uidPromise,
        AsyncStorage.setItem('hasLaunched', 'true'),
        profileData && AsyncStorage.setItem('userProfile', JSON.stringify(profileData))
      ].filter(Boolean));

      // Update state synchronously
      if (profileData) {
        setUserProfile(profileData);
      }
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  // Optimized logout function
  const logout = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      
      // Run all logout operations in parallel
      await Promise.all([
        firebaseSignOut(),
        AsyncStorage.multiRemove(['hasLaunched', 'userProfile'])
      ]);
      
      // Update state synchronously
      setIsAuthenticated(false);
      setUserProfile(null);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Update profile function
  const updateProfile = async (profile: Partial<UserProfile>) => {
    try {
      const updatedProfile = {
        ...userProfile,
        ...profile
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile as UserProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      userProfile, 
      login, 
      logout,
      updateProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 