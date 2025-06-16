import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, MessageSquare, Bot, User, Copy, Trash2 } from 'lucide-react';
import { chatAPI } from '../services/api';

const Chatbot = ({ chatState, setChatState }) => {
  // Destructure state from props
  const {
    chats,
    currentChatId
  } = chatState;

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const currentChat = chats.find(chat => chat.id === currentChatId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages]);

  const createNewChat = () => {
    const newChatId = Date.now().toString();
    const newChat = {
      id: newChatId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date()
    };
    setChatState(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats],
      currentChatId: newChatId
    }));
    setError(null);
  };

  const deleteChat = (chatId) => {
    setChatState(prev => {
      const chatToDelete = prev.chats.find(chat => chat.id === chatId);
      
      // Show confirmation if chat has messages
      if (chatToDelete && chatToDelete.messages.length > 0) {
        const confirmMessage = prev.chats.length === 1 
          ? 'Are you sure you want to clear this chat and start a new one?'
          : `Are you sure you want to delete "${chatToDelete.title}"? This action cannot be undone.`;
        
        if (!window.confirm(confirmMessage)) {
          return prev; // No change
        }
      }

      if (prev.chats.length === 1) {
        // If deleting the last chat, create a new empty one
        const newChat = {
          id: Date.now().toString(),
          title: 'New Chat',
          messages: [],
          createdAt: new Date()
        };
        setError(null);
        return {
          ...prev,
          chats: [newChat],
          currentChatId: newChat.id
        };
      }
      
      const newChats = prev.chats.filter(chat => chat.id !== chatId);
      const newCurrentChatId = prev.currentChatId === chatId ? newChats[0].id : prev.currentChatId;
      
      return {
        ...prev,
        chats: newChats,
        currentChatId: newCurrentChatId
      };
    });
  };

  const deleteAllChats = () => {
    if (window.confirm('Are you sure you want to delete all chats? This action cannot be undone.')) {
      const newChat = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date()
      };
      setChatState(prev => ({
        ...prev,
        chats: [newChat],
        currentChatId: newChat.id
      }));
      setError(null);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    // Add user message with callback to get fresh state
    setChatState(prev => ({
      ...prev,
      chats: prev.chats.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, userMessage] }
          : chat
      )
    }));

    // Update chat title if this is the first message
    if (currentChat.messages.length === 0) {
      const title = message.length > 30 ? message.substring(0, 30) + '...' : message;
      setChatState(prev => ({
        ...prev,
        chats: prev.chats.map(chat => 
          chat.id === currentChatId ? { ...chat, title: title } : chat
        )
      }));
    }

    const currentMessage = message;
    setMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Call the real API
      const response = await chatAPI.sendMessage(currentMessage, currentChatId);
      
      const botResponse = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: response.response,
        timestamp: new Date(),
        sources: response.sources || []
      };

      setChatState(prev => ({
        ...prev,
        chats: prev.chats.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, messages: [...chat.messages, botResponse] }
            : chat
        )
      }));

    } catch (error) {
      console.error('Chat API error:', error);
      setError(error.response?.data?.detail || error.message);
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: getErrorMessage(error),
        timestamp: new Date(),
        isError: true
      };

      setChatState(prev => ({
        ...prev,
        chats: prev.chats.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, messages: [...chat.messages, errorMessage] }
            : chat
        )
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error) => {
    if (error.response?.status === 503) {
      return "The knowledge base is not loaded yet. Please upload and process some documents first in the Knowledge Base tab.";
    } else if (error.response?.status === 500) {
      return "Sorry, I encountered an internal error while processing your request. Please try again.";
    } else if (error.code === 'NETWORK_ERROR') {
      return "Unable to connect to the server. Please check if the backend is running.";
    } else {
      return `Sorry, I encountered an error: ${error.response?.data?.detail || error.message}. Please try again.`;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Function to convert markdown formatting to JSX
  const formatMessageContent = (content) => {
    if (!content) return '';
    
    // Split content into lines for processing
    const lines = content.split('\n');
    
    return lines.map((line, lineIndex) => {
      if (!line.trim()) {
        return <br key={lineIndex} />;
      }
      
      // Simple regex to replace **text** with <strong>text</strong>
      const formattedLine = line.split(/(\*\*.*?\*\*)/).map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Remove the ** and make it bold
          const boldText = part.slice(2, -2);
          return <strong key={`${lineIndex}-${partIndex}`}>{boldText}</strong>;
        }
        return part;
      });
      
      return <div key={lineIndex} className="mb-1">{formattedLine}</div>;
    });
  };

  return (
    <div className="h-full flex">
      {/* Chat List Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        {/* New Chat Button */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-red-100">
          <button
            onClick={createNewChat}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-4 rounded-xl flex items-center justify-center space-x-3 transition-all duration-200 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 transform hover:scale-105 font-semibold"
          >
            <Plus size={22} />
            <span>New Chat</span>
          </button>
          
          {chats.length > 1 && (
            <button
              onClick={deleteAllChats}
              className="w-full mt-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-4 py-3 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 border border-red-200 hover:border-red-300 font-medium"
            >
              <Trash2 size={16} />
              <span>Delete All Chats</span>
            </button>
          )}
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {/* Chat counter */}
          <div className="px-4 py-3 mb-4 text-sm text-gray-500 flex items-center justify-between bg-gray-50 rounded-lg">
            <span className="font-medium">{chats.length} chat{chats.length !== 1 ? 's' : ''} total</span>
            {chats.some(chat => chat.messages.length > 0) && (
              <span className="text-green-500 text-sm flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                Active
              </span>
            )}
          </div>
          
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setChatState(prev => ({ ...prev, currentChatId: chat.id }))}
              className={`group p-4 mb-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                currentChatId === chat.id
                  ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 shadow-md shadow-red-500/10'
                  : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <MessageSquare size={18} className={`${currentChatId === chat.id ? 'text-red-500' : 'text-gray-400'} flex-shrink-0`} />
                    <h4 className={`${currentChatId === chat.id ? 'text-gray-900' : 'text-gray-700'} font-semibold text-sm truncate`}>
                      {chat.title}
                    </h4>
                  </div>
                  <p className="text-gray-500 text-xs mb-1">
                    {chat.messages.length} messages
                  </p>
                  <p className="text-gray-400 text-xs">
                    {chat.createdAt.toLocaleDateString()}
                  </p>
                </div>
                {/* Always show delete button now */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-60 group-hover:opacity-100 hover:opacity-100 text-gray-400 hover:text-red-500 transition-all duration-200 p-2 rounded-lg hover:bg-red-50"
                  title={chats.length === 1 ? "Clear chat and start new" : "Delete this chat"}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Connection Status */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              Connection issue: {error}
            </div>
          )}
          <div className="flex items-center space-x-3 text-sm">
            <div className={`w-3 h-3 rounded-full ${error ? 'bg-red-400' : 'bg-green-400'} animate-pulse`}></div>
            <span className={`font-medium ${error ? 'text-red-600' : 'text-green-600'}`}>
              {error ? 'Disconnected' : 'Connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-4xl mx-auto space-y-8">
            {currentChat?.messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/25">
                  <Bot className="text-white" size={40} />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  Welcome to Trading RAG Assistant
                </h3>
                <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                  Ask me anything about your trading documents.
                </p>
              </div>
            ) : (
              <>
                {currentChat.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex w-full ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.type === 'bot' ? (
                      // Bot message layout
                      <div className="flex space-x-4 max-w-3xl">
                        <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                          <Bot size={20} className="text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="p-6 rounded-2xl shadow-sm bg-white border border-gray-200 text-gray-800">
                            <div className="whitespace-pre-wrap leading-relaxed">{formatMessageContent(msg.content)}</div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-500 font-medium">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                            {!msg.isError && (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => copyToClipboard(msg.content)}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                                  title="Copy to clipboard"
                                >
                                  <Copy size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // User message layout
                      <div className="flex space-x-4 max-w-3xl">
                        <div className="flex-1">
                          <div className="p-6 rounded-2xl shadow-sm bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/20">
                            <div className="whitespace-pre-wrap leading-relaxed">{formatMessageContent(msg.content)}</div>
                          </div>
                          <div className="flex items-center justify-end mt-3">
                            <span className="text-xs text-gray-500 font-medium">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <User size={20} className="text-gray-600" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                      <Bot size={20} className="text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-8 bg-white shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about your trading documents..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-6 py-4 pr-14 text-gray-900 placeholder-gray-500 resize-none focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
                  rows={1}
                  style={{ minHeight: '56px', maxHeight: '120px' }}
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || isLoading}
                  className="absolute right-3 top-3 p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 shadow-md disabled:shadow-none"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center font-medium">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;