import React, { useState } from 'react';
import { Database, MessageCircle, Shield, Menu, X } from 'lucide-react';
import KnowledgeBase from './components/KnowledgeBase';
import Chatbot from './components/Chatbot';
import Admin from './components/Admin';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('knowledge');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Knowledge Base state lifted up to App level
  const [knowledgeBaseState, setKnowledgeBaseState] = useState({
    files: [],
    uploadStatus: 'idle', // idle, uploading, processing, success, error
    processingSteps: [],
    vectorStoreStats: null,
    uploadId: null,
    processingError: null
  });

  // Chat state lifted up to App level
  const [chatState, setChatState] = useState({
    chats: [
      { id: '1', title: 'New Chat', messages: [], createdAt: new Date() }
    ],
    currentChatId: '1'
  });

  const tabs = [
    { 
      id: 'knowledge', 
      name: 'Knowledge Base', 
      icon: Database, 
      component: KnowledgeBase
    },
    { id: 'chat', name: 'Chatbot', icon: MessageCircle, component: Chatbot },
    { id: 'admin', name: 'Admin', icon: Shield, component: Admin }
  ];

  const renderActiveComponent = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    if (!activeTabData) return null;

    const Component = activeTabData.component;
    
    if (activeTab === 'knowledge') {
      return <Component knowledgeBaseState={knowledgeBaseState} setKnowledgeBaseState={setKnowledgeBaseState} />;
    } else if (activeTab === 'chat') {
      return <Component chatState={chatState} setChatState={setChatState} />;
    }
    
    return <Component />;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-16'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col shadow-lg`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-red-100">
          <div className="flex items-center justify-between">
            {isSidebarOpen && (
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
                    Trading RAG
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">AI Knowledge Assistant</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-red-50 transition-colors text-gray-600 hover:text-red-600"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-6">
          <div className="space-y-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-4 px-4 py-4 rounded-xl transition-all duration-200 font-medium ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 transform scale-105'
                      : 'text-gray-700 hover:bg-red-50 hover:text-red-600 hover:shadow-md'
                  }`}
                >
                  <Icon size={22} />
                  {isSidebarOpen && <span className="text-base">{tab.name}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Info */}
        {isSidebarOpen && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-sm font-bold text-white">U</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Trading User</p>
                <p className="text-xs text-gray-600">Knowledge Analyst</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                {tabs.find(tab => tab.id === activeTab)?.name}
              </h2>
              <p className="text-gray-600 mt-1">
                {activeTab === 'knowledge' && 'Manage your trading documents and build your knowledge base'}
                {activeTab === 'chat' && 'Chat with your AI assistant about trading strategies'}
                {activeTab === 'admin' && 'Monitor system performance and analytics'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                Last updated: {new Date().toLocaleDateString()}
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          {renderActiveComponent()}
        </div>
      </div>
    </div>
  );
}

export default App; 