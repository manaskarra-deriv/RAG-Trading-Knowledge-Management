import React, { useState, useEffect } from 'react';
import { Activity, Users, MessageCircle, Database, AlertTriangle, CheckCircle, Clock, Search, Filter, Download, RefreshCw } from 'lucide-react';
import { adminAPI } from '../services/api';

const Admin = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStats, setSystemStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);

  // Fetch data when component mounts or active section changes
  useEffect(() => {
    fetchData();
  }, [activeSection]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [activeSection]);

  const fetchData = async () => {
    try {
      setError(null);
      
      if (activeSection === 'overview') {
        const stats = await adminAPI.getSystemStatus();
        setSystemStats(stats);
      } else if (activeSection === 'logs') {
        await fetchLogs();
      } else if (activeSection === 'analytics') {
        const analyticsData = await adminAPI.getAnalytics();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.response?.data?.detail || error.message);
    }
  };

  const fetchLogs = async () => {
    try {
      setError(null);
      const response = await adminAPI.getLogs({
        limit: 100,
        level: filterLevel === 'all' ? null : filterLevel,
        search: searchTerm || null
      });
      
      if (response.error) {
        setError(`Logs error: ${response.error}`);
        setLogs([]);
      } else {
        setLogs(response.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      if (error.response?.status === 500) {
        setError('Server error while fetching logs. Please check if the backend is running.');
      } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        setError('Cannot connect to server. Please make sure the backend is running on port 8000.');
      } else {
        setError(`Failed to fetch logs: ${error.response?.data?.detail || error.message}`);
      }
      setLogs([]);
    }
  };

  const refreshLogs = async () => {
    setIsLoading(true);
    try {
      await fetchLogs();
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Level', 'User', 'Message', 'Query', 'Response Time'],
      ...logs.map(log => [
        log.timestamp,
        log.level,
        log.user || '',
        log.message,
        log.query || '',
        log.response_time || ''
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rag-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'WARNING':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'SUCCESS':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const sections = [
    { id: 'overview', name: 'Overview', icon: Activity },
    { id: 'logs', name: 'System Logs', icon: MessageCircle },
    { id: 'analytics', name: 'Analytics', icon: Database }
  ];

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 p-6 shadow-sm">
        <nav className="space-y-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center space-x-4 px-4 py-4 rounded-xl transition-all duration-200 font-medium ${
                  activeSection === section.id
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 transform scale-105'
                    : 'text-gray-700 hover:bg-red-50 hover:text-red-600 hover:shadow-md'
                }`}
              >
                <Icon size={22} />
                <span className="text-base">{section.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center space-x-3 text-sm">
            <div className={`w-3 h-3 rounded-full ${error ? 'bg-red-400' : 'bg-green-400'} animate-pulse`}></div>
            <span className={`font-medium ${error ? 'text-red-600' : 'text-green-600'}`}>
              {error ? 'Connection Error' : 'Connected'}
            </span>
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-2 font-medium">{error}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-b from-gray-50 to-white">
        {activeSection === 'overview' && (
          <div className="p-8 space-y-8">
            {/* System Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Total Queries</h3>
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <MessageCircle className="text-red-500" size={24} />
                  </div>
                </div>
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {systemStats ? systemStats.total_queries.toLocaleString() : '...'}
                </p>
                <p className="text-gray-600 text-sm">Since server start</p>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Active Users</h3>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="text-blue-500" size={24} />
                  </div>
                </div>
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {systemStats ? systemStats.unique_users : '...'}
                </p>
                <p className="text-gray-600 text-sm">Unique sessions</p>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Documents</h3>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Database className="text-green-500" size={24} />
                  </div>
                </div>
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {systemStats ? systemStats.documents_indexed : '...'}
                </p>
                <p className="text-gray-600 text-sm">Indexed documents</p>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Avg Response Time</h3>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Clock className="text-purple-500" size={24} />
                  </div>
                </div>
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {systemStats ? `${systemStats.average_response_time}s` : '...'}
                </p>
                <p className="text-gray-600 text-sm">Query processing</p>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">System Uptime</h3>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="text-green-500" size={24} />
                  </div>
                </div>
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {systemStats ? `${systemStats.uptime_hours.toFixed(1)}h` : '...'}
                </p>
                <p className="text-gray-600 text-sm">Current session</p>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <Activity className="mr-3 text-red-500" size={28} />
                System Status
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center space-x-4">
                    <CheckCircle className={`${systemStats?.retriever_loaded ? 'text-green-500' : 'text-amber-500'}`} size={24} />
                    <span className="text-gray-900 font-semibold text-lg">Retrieval System</span>
                  </div>
                  <span className={`text-base font-medium ${systemStats?.retriever_loaded ? 'text-green-600' : 'text-amber-600'}`}>
                    {systemStats?.retriever_loaded ? 'Loaded' : 'Not Loaded'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center space-x-4">
                    <CheckCircle className="text-green-500" size={24} />
                    <span className="text-gray-900 font-semibold text-lg">API Server</span>
                  </div>
                  <span className="text-green-600 text-base font-medium">Operational</span>
                </div>
                <div className="flex items-center justify-between p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center space-x-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      systemStats?.processing_status === 'processing' ? 'text-amber-500' : 
                      systemStats?.processing_status === 'error' ? 'text-red-500' : 'text-green-500'
                    }`}>
                      {systemStats?.processing_status === 'processing' ? <Clock size={20} /> : <CheckCircle size={20} />}
                    </div>
                    <span className="text-gray-900 font-semibold text-lg">Document Processing</span>
                  </div>
                  <span className={`text-base font-medium ${
                    systemStats?.processing_status === 'processing' ? 'text-amber-600' : 
                    systemStats?.processing_status === 'error' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {systemStats?.processing_status?.charAt(0).toUpperCase() + systemStats?.processing_status?.slice(1) || 'Idle'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'logs' && (
          <div className="p-8 space-y-8">
            {/* Log Controls */}
            <div className="flex items-center justify-between bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && fetchLogs()}
                    className="pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
                  />
                </div>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
                >
                  <option value="all">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="success">Success</option>
                </select>
                <button
                  onClick={fetchLogs}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-red-500/25"
                >
                  Search
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={refreshLogs}
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl transition-all duration-200 font-semibold"
                >
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={exportLogs}
                  disabled={logs.length === 0}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded-xl transition-all duration-200 font-semibold"
                >
                  <Download size={18} />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-8 py-4 text-left text-sm font-bold text-gray-900">Timestamp</th>
                      <th className="px-8 py-4 text-left text-sm font-bold text-gray-900">Level</th>
                      <th className="px-8 py-4 text-left text-sm font-bold text-gray-900">User</th>
                      <th className="px-8 py-4 text-left text-sm font-bold text-gray-900">Message</th>
                      <th className="px-8 py-4 text-left text-sm font-bold text-gray-900">Query</th>
                      <th className="px-8 py-4 text-left text-sm font-bold text-gray-900">Response Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-8 py-12 text-center text-gray-500">
                          {isLoading ? 'Loading logs...' : 'No logs found'}
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-8 py-4 text-sm text-gray-600 font-medium">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-8 py-4">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getLogColor(log.level)}`}>
                              {log.level}
                            </span>
                          </td>
                          <td className="px-8 py-4 text-sm text-gray-900 font-medium">{log.user || '-'}</td>
                          <td className="px-8 py-4 text-sm text-gray-900 max-w-md truncate">
                            {log.message}
                          </td>
                          <td className="px-8 py-4 text-sm text-gray-600 max-w-xs truncate">
                            {log.query || '-'}
                          </td>
                          <td className="px-8 py-4 text-sm text-gray-600 font-medium">
                            {log.response_time ? `${log.response_time}s` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'analytics' && (
          <div className="p-8 space-y-8">
            {/* Query Categories */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <Database className="mr-3 text-red-500" size={28} />
                Most Queried Categories
              </h3>
              <div className="space-y-6">
                {analytics && analytics.query_categories && analytics.query_categories.length > 0 ? (
                  analytics.query_categories.map((stat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-gray-900 font-semibold text-lg">{stat.category}</span>
                          <span className="text-gray-600 text-sm font-medium">{stat.count} queries</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${stat.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-12 text-lg">No query data available yet</p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <Activity className="mr-3 text-red-500" size={28} />
                Recent User Activity
              </h3>
              <div className="space-y-4">
                {analytics && analytics.recent_activity && analytics.recent_activity.length > 0 ? (
                  analytics.recent_activity.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-4 p-6 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MessageCircle size={20} className="text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-base font-semibold">{activity.user}</p>
                        <p className="text-gray-600 text-sm truncate mt-1">{activity.query}</p>
                        <p className="text-gray-500 text-xs mt-2 font-medium">
                          {new Date(activity.timestamp).toLocaleString()} • {activity.response_time}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-12 text-lg">No recent activity</p>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            {analytics && (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                  <Activity className="mr-3 text-red-500" size={28} />
                  Summary Statistics
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-8 rounded-xl border border-blue-200">
                    <p className="text-blue-600 text-sm font-bold mb-2">Total Queries</p>
                    <p className="text-gray-900 text-4xl font-bold">{analytics.total_queries || 0}</p>
                  </div>
                  <div className="bg-gradient-to-r from-red-50 to-red-100 p-8 rounded-xl border border-red-200">
                    <p className="text-red-600 text-sm font-bold mb-2">Error Rate</p>
                    <p className="text-gray-900 text-4xl font-bold">{analytics.error_rate || 0}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin; 