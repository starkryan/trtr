import apiClient from './apiClient'; // Assuming apiClient is configured for your backend base URL

/**
 * Fetches a list of video URLs from the backend media API.
 * @returns {Promise<string[]>} A promise that resolves to an array of video URLs.
 */
export const getMediaVideoUrls = async (): Promise<string[]> => {
  try {
    // The apiClient should be configured with the base URL of your backend (e.g., http://localhost:5000)
    const response = await apiClient.get<string[]>('/media/videos');
    return response.data;
  } catch (error) {
    console.error('Error fetching media video URLs:', error);
    throw error;
  }
};
