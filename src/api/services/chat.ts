import API from './apiClient';
import { ChatRequest, Message } from './character';

// Send a message to a character and get response
export const sendMessage = async (characterId: string, message: string, conversation: Message[] = []) => {
  // Validate required parameters
  if (!characterId) {
    throw new Error('Character ID is required');
  }

  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  try {
    // Format conversation history to match API expectations
    const formattedConversation = conversation.map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.text
    }));

    const chatRequest = {
      characterId,
      message: message.trim(),
      conversation: formattedConversation
    };

    console.log('Sending chat request:', {
      ...chatRequest,
      endpoint: '/ai/character/response'
    });
    
    const response = await API.post('/ai/character/response', chatRequest);
    
    if (!response.data || typeof response.data.response !== 'string') {
      console.error('Invalid response format:', response.data);
      throw new Error('Invalid response format from server');
    }

    return {
      id: Date.now().toString(),
      text: response.data.response,
      isUser: false,
      timestamp: new Date()
    };
  } catch (error: any) {
    // Log the error details
    console.error('Chat service error:', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
      characterId,
      endpoint: '/ai/character/response'
    });
    
    // Enhance error message based on status code
    if (error.response?.status === 404) {
      throw new Error(`Failed to send message: API endpoint not found. Please contact support.`);
    }
    
    throw error;
  }
};

// No need for separate premium message endpoint - removing or commenting out the unused function
// export const sendPremiumMessage = async (characterId: string, message: string, conversation: Message[] = []) => {
//   try {
//     const chatRequest: ChatRequest = {
//       characterId,
//       message,
//       conversation
//     };
//     
//     const response = await API.post('/ai/character/premium-response', chatRequest);
//     return {
//       id: Date.now().toString(),
//       text: response.data.response,
//       isUser: false,
//       timestamp: new Date()
//     };
//   } catch (error) {
//     console.error('Error sending premium message:', error);
//     return {
//       id: Date.now().toString(),
//       text: "I'm having trouble with my premium connection. Let's chat normally for now?",
//       isUser: false,
//       timestamp: new Date()
//     };
//   }
// };
