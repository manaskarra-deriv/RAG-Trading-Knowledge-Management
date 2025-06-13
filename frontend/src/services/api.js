import axios from 'axios';

// API base URL - change this to your backend URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Knowledge Base API calls
export const knowledgeBaseAPI = {
  // Upload PDF files
  uploadFiles: async (files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await api.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Process uploaded documents
  processDocuments: async (uploadId) => {
    const response = await api.post('/api/process', null, {
      params: { upload_id: uploadId },
    });
    return response.data;
  },

  // Get processing status
  getProcessingStatus: async () => {
    const response = await api.get('/api/processing-status');
    return response.data;
  },
};

// Chatbot API calls
export const chatAPI = {
  // Send chat message
  sendMessage: async (content, chatId = null) => {
    const response = await api.post('/api/chat', {
      content,
      chat_id: chatId,
    });
    return response.data;
  },
};

// Admin API calls
export const adminAPI = {
  // Get system status
  getSystemStatus: async () => {
    const response = await api.get('/api/system-status');
    return response.data;
  },

  // Get logs
  getLogs: async (params = {}) => {
    const { limit = 100, level = null, search = null } = params;
    const response = await api.get('/api/logs', {
      params: { limit, level, search },
    });
    return response.data;
  },

  // Get analytics
  getAnalytics: async () => {
    const response = await api.get('/api/analytics');
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api; 