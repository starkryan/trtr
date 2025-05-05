import API from './apiClient';

// Get all characters for the home screen
export const getCharacters = async () => {
  try {
    const response = await API.get('/characters');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching characters:', error);
    throw error;
  }
};

// Get a specific character by ID for the character screen
export const getCharacterById = async (id: string) => {
  try {
    const response = await API.get(`/characters/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching character:', { id, error });
    throw error;
  }
};

// Get featured characters (optional for homepage featured section)
export const getFeaturedCharacters = async () => {
  try {
    const response = await API.get('/characters/featured');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching featured characters:', error);
    throw error;
  }
};

// Types
export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  replyTo?: Message; // Optional reference to the message being replied to
}

export interface ChatRequest {
  characterId: string;
  message: string;
  conversation?: Message[];
}

// Send a message to character and get response
export const sendMessageToCharacter = async (chatRequest: ChatRequest) => {
  try {
    const response = await API.post('/ai/character/response', chatRequest);
    return response.data;
  } catch (error: any) {
    console.error('Error sending message to character:', { 
      characterId: chatRequest.characterId,
      error 
    });
    throw error;
  }
};
