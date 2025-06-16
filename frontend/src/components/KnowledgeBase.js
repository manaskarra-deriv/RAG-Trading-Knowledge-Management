import React, { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Trash2, Activity } from 'lucide-react';
import { knowledgeBaseAPI } from '../services/api';

const KnowledgeBase = ({ knowledgeBaseState, setKnowledgeBaseState }) => {
  // Destructure state from props
  const {
    files,
    uploadStatus,
    processingSteps,
    vectorStoreStats,
    processingError
  } = knowledgeBaseState;

  // Helper function to update specific part of state
  const updateState = useCallback((updates) => {
    setKnowledgeBaseState(prev => ({ ...prev, ...updates }));
  }, [setKnowledgeBaseState]);

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      error: null
    }));
    
    // If there are existing files with the same name that need re-upload, replace them
    const updatedExisting = files.map(existingFile => {
      const newFile = newFiles.find(nf => nf.name === existingFile.name);
      if (newFile && !existingFile.file) {
        // Replace the file that needed re-upload
        return newFile;
      }
      return existingFile;
    });
    
    // Add any completely new files
    const newUniqueFiles = newFiles.filter(nf => 
      !files.some(ef => ef.name === nf.name)
    );
    
    updateState({
      files: [...updatedExisting, ...newUniqueFiles]
    });
  }, [files, updateState]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const updateProcessingStatus = useCallback((status) => {
    const steps = [
      { step: 'Uploading files', message: 'PDF files uploaded to server' },
      { step: 'Text extraction', message: 'Extracting text from PDFs...' },
      { step: 'Creating embeddings', message: 'Generating vector embeddings...' },
      { step: 'Building vector store', message: 'Creating searchable index...' },
      { step: 'Finalizing', message: 'Optimizing knowledge base...' }
    ];

    const updatedSteps = steps.map((step, index) => {
      if (index < Math.floor(status.progress / 20)) {
        return { ...step, status: 'completed' };
      } else if (index === Math.floor(status.progress / 20)) {
        return { ...step, status: 'processing' };
      } else {
        return { ...step, status: 'pending' };
      }
    });

    // Update file progress
    const updatedFiles = files.map(file => ({
      ...file,
      progress: status.progress,
      status: status.status === 'completed' ? 'completed' : 'processing'
    }));

    updateState({
      processingSteps: updatedSteps,
      files: updatedFiles
    });
  }, [files, updateState]);

  // Poll processing status
  useEffect(() => {
    let intervalId;
    
    if (uploadStatus === 'processing') {
      intervalId = setInterval(async () => {
        try {
          const status = await knowledgeBaseAPI.getProcessingStatus();
          updateProcessingStatus(status);
          
          if (status.status === 'completed') {
            updateState({
              uploadStatus: 'success',
              vectorStoreStats: {
                totalDocuments: status.files_processed,
                totalChunks: status.files_processed * 15, // Estimated
                embeddingDimensions: 1536,
                indexSize: `${(files.reduce((acc, f) => acc + (f.file?.size || f.size || 0), 0) / 1024 / 1024 * 0.1).toFixed(2)} MB`,
                lastUpdated: new Date().toISOString()
              }
            });
            clearInterval(intervalId);
          } else if (status.status === 'error') {
            updateState({
              uploadStatus: 'error',
              processingError: status.error_message
            });
            clearInterval(intervalId);
          }
        } catch (error) {
          console.error('Error polling processing status:', error);
        }
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [uploadStatus, files, updateState, updateProcessingStatus]);

  const processFiles = async () => {
    if (files.length === 0) return;

    // Check if any files need re-upload
    const filesWithoutFileObject = files.filter(f => !f.file);
    if (filesWithoutFileObject.length > 0) {
      alert('Some files need to be re-uploaded. Please drag and drop them again.');
      return;
    }

    try {
      updateState({
        uploadStatus: 'uploading',
        processingError: null
      });

      // Upload files
      const fileObjects = files.map(f => f.file);
      const uploadResponse = await knowledgeBaseAPI.uploadFiles(fileObjects);
      updateState({
        uploadId: uploadResponse.upload_id
      });

      // Start processing
      await knowledgeBaseAPI.processDocuments(uploadResponse.upload_id);
      updateState({
        uploadStatus: 'processing'
      });

      // Initialize processing steps
      updateState({
        processingSteps: [
          { step: 'Uploading files', status: 'completed', message: 'PDF files uploaded successfully' },
          { step: 'Text extraction', status: 'processing', message: 'Extracting text from PDFs...' },
          { step: 'Creating embeddings', status: 'pending', message: 'Generating vector embeddings...' },
          { step: 'Building vector store', status: 'pending', message: 'Creating searchable index...' },
          { step: 'Finalizing', status: 'pending', message: 'Optimizing knowledge base...' }
        ]
      });

    } catch (error) {
      console.error('Processing failed:', error);
      const errorSteps = processingSteps.map(step => 
        step.status === 'processing' ? { ...step, status: 'error', message: 'Processing failed' } : step
      );
      
      updateState({
        uploadStatus: 'error',
        processingError: error.response?.data?.detail || error.message,
        processingSteps: errorSteps
      });
    }
  };

  const removeFile = (fileId) => {
    updateState({
      files: files.filter(f => f.id !== fileId)
    });
  };

  const resetProcess = () => {
    updateState({
      files: [],
      uploadStatus: 'idle',
      processingSteps: [],
      vectorStoreStats: null,
      uploadId: null,
      processingError: null
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-500" size={24} />;
      case 'processing':
        return <Loader className="text-red-500 animate-spin" size={24} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={24} />;
      default:
        return <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>;
    }
  };

  return (
    <div className="h-full p-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Upload and Processing Section - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Area */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Upload className="mr-3 text-red-500" size={24} />
              Upload PDF Documents
            </h3>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragActive
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/25">
                <Upload className="text-white" size={20} />
              </div>
              {isDragActive ? (
                <p className="text-gray-900 text-base font-semibold">Drop the PDF files here...</p>
              ) : (
                <div>
                  <p className="text-gray-900 text-base font-semibold mb-2">
                    Drag & drop PDF files here, or click to select
                  </p>
                  <p className="text-gray-600 text-sm">
                    Supports multiple PDF files. Max 50MB per file.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Processing Status */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            {processingSteps.length > 0 ? (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  {uploadStatus === 'success' ? (
                    <CheckCircle className="text-green-500 mr-3" size={24} />
                  ) : (
                    <Loader className="mr-3 text-red-500 animate-spin" size={24} />
                  )}
                  {uploadStatus === 'success' ? 'Processing Complete!' : 'Processing Status'}
                </h3>
                <div className="space-y-4">
                  {processingSteps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      {getStatusIcon(step.status)}
                      <div className="flex-1">
                        <p className="text-gray-900 font-semibold text-sm">{step.step}</p>
                        <p className="text-gray-600 text-xs">{step.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {uploadStatus === 'success' && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-green-700 font-medium flex items-center text-sm">
                      <CheckCircle className="mr-2" size={16} />
                      ✨ Knowledge base created successfully! Ready for queries.
                    </p>
                  </div>
                )}
                {processingError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm font-medium flex items-center">
                      <AlertCircle className="mr-2" size={16} />
                      Error: {processingError}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="text-gray-400" size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Process</h3>
                <p className="text-gray-600 text-sm">Upload files to see processing status here</p>
              </div>
            )}
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <FileText className="mr-3 text-red-500" size={24} />
                Uploaded Files ({files.length})
              </h3>
              {/* Debug info */}
              <div className="text-xs text-gray-500 mb-2">
                Status: {uploadStatus} | Steps: {processingSteps.length}
              </div>
              {(uploadStatus === 'idle' || uploadStatus === 'error') && (
                <div className="space-x-3">
                  <button
                    onClick={processFiles}
                    disabled={files.some(f => !f.file)}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-red-500/25 disabled:shadow-none"
                  >
                    Process Files
                  </button>
                  <button
                    onClick={resetProcess}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl transition-colors font-semibold"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => updateState({ uploadStatus: 'idle', processingSteps: [], processingError: null })}
                    className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-4 py-2.5 rounded-xl transition-colors font-medium text-sm"
                  >
                    Reset Status
                  </button>
                </div>
              )}
            </div>

            {files.some(f => !f.file) && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-700 text-sm font-medium flex items-center">
                  <AlertCircle className="mr-2" size={16} />
                  Some files need to be re-uploaded. Please drag and drop them again to continue.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {files.map((fileItem) => (
                <div key={fileItem.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="text-red-500" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-gray-900 font-semibold text-sm truncate">{fileItem.name}</p>
                      {!fileItem.file && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                          Re-upload
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-xs mb-2">
                      {(fileItem.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {fileItem.progress > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-red-500 to-red-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${fileItem.progress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(fileItem.status)}
                    {uploadStatus === 'idle' && (
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vector Store Stats - Full Width Success Display */}
        {vectorStoreStats && (
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <CheckCircle className="text-green-500 mr-3" size={28} />
              🎉 Knowledge Base Created Successfully!
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
                <p className="text-red-600 text-sm font-medium mb-2">Documents</p>
                <p className="text-gray-900 text-3xl font-bold">{vectorStoreStats.totalDocuments}</p>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                <p className="text-blue-600 text-sm font-medium mb-2">Text Chunks</p>
                <p className="text-gray-900 text-3xl font-bold">{vectorStoreStats.totalChunks}</p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                <p className="text-green-600 text-sm font-medium mb-2">Embedding Dims</p>
                <p className="text-gray-900 text-3xl font-bold">{vectorStoreStats.embeddingDimensions}</p>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                <p className="text-purple-600 text-sm font-medium mb-2">Index Size</p>
                <p className="text-gray-900 text-3xl font-bold">{vectorStoreStats.indexSize}</p>
              </div>
            </div>
            <div className="p-6 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-700 font-medium flex items-center">
                <CheckCircle className="mr-2" size={20} />
                🚀 Your knowledge base is ready! Head to the Chatbot tab to start asking questions about your documents.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default KnowledgeBase; 