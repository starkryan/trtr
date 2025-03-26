import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// Use 10.0.2.2 for Android emulator to connect to host machine's localhost
// Use localhost for iOS simulator and web

// Create an API client with the proper base URL
const API = axios.create({
  baseURL: `https://luvhai-605246487551.us-central1.run.app/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000, // Increase timeout for slower connections
});

// Add request interceptor to check network connectivity and log requests
API.interceptors.request.use(async (config) => {
  try {
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      throw new Error('No internet connection');
    }
    
    // Log the request details
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      data: config.data,
      headers: config.headers
    });
    
    // Add a timestamp to prevent caching issues
    const timestamp = new Date().getTime();
    const separator = config.url?.includes('?') ? '&' : '?';
    config.url = `${config.url}${separator}_t=${timestamp}`;
    
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
