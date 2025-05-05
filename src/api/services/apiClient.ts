import axios, { AxiosHeaders, AxiosRequestConfig } from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { setupCache } from 'axios-cache-interceptor';
import auth from '@react-native-firebase/auth';

// Use 10.0.2.2 for Android emulator to connect to host machine's localhost
// Use localhost for iOS simulator and web

// Create an API client with the proper base URL and caching
const API = setupCache(axios.create({
  baseURL: `https://luvhai-605246487551.us-central1.run.app/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000, // Increase timeout for slower connections
}), {
  // Basic cache configuration
  ttl: 5 * 60 * 1000, // 5 minutes cache
  interpretHeader: true, // Respect cache headers
  methods: ['get'] // Only cache GET requests
});

// Helper function to get Firebase auth headers
const getFirebaseAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  try {
    const currentUser = auth().currentUser;
    if (currentUser) {
      headers['firebase-id'] = currentUser.uid;
      
      // Only get token for non-anonymous users
      if (!currentUser.isAnonymous) {
        const token = await currentUser.getIdToken();
        headers['firebase-token'] = token;
      }
    }
  } catch (error) {
    console.error('Error getting Firebase auth headers:', error);
  }
  return headers;
};

// Add request interceptor to check network connectivity and log requests
API.interceptors.request.use(async (config) => {
  try {
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      throw new Error('No internet connection');
    }
    
    // Add Firebase authentication headers to all requests
    const firebaseHeaders = await getFirebaseAuthHeaders();
    
    // Create new Axios headers if they don't exist
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    
    // Add Firebase headers
    Object.entries(firebaseHeaders).forEach(([key, value]) => {
      config.headers && config.headers.set(key, value);
    });
    
    // Log the request details
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      data: config.data,
      headers: config.headers
    });
    
    // Don't add timestamp for cached GET requests to improve caching
    if (config.method?.toLowerCase() !== 'get') {
      // Add a timestamp to prevent caching issues for non-GET requests
      const timestamp = new Date().getTime();
      const separator = config.url?.includes('?') ? '&' : '?';
      config.url = `${config.url}${separator}_t=${timestamp}`;
    }
    
    return config;
  } catch (error) {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
}, (error) => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor for better error handling
API.interceptors.response.use(
  (response) => {
    // Log successful response
    console.log('API Response:', {
      status: response.status,
      data: response.data,
      url: response.config.url
    });
    return response;
  },
  (error) => {
    // Log detailed error information
    console.error('API Error:', {
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      },
      response: {
        status: error.response?.status,
        data: error.response?.data
      },
      message: error.message
    });

    if (!error.response) {
      throw new Error('Network error - please check your internet connection');
    }
    
    if (error.response.status === 401 || error.response.status === 403) {
      throw new Error('Authentication error - please sign in again');
    }
    
    if (error.response.status === 400) {
      throw new Error(error.response.data?.message || 'Invalid request - please check your input');
    }

    if (error.response.status === 404) {
      throw new Error('Resource not found');
    }
    
    if (error.response.status >= 500) {
      throw new Error('Server error - please try again later');
    }
    
    return Promise.reject(error);
  }
);

export default API;