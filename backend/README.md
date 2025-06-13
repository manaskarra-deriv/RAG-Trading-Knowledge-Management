# Trading RAG Backend

A FastAPI backend server for the Trading RAG (Retrieval-Augmented Generation) Knowledge Management System. This backend integrates with the existing `trading_retrieval_system.py` to provide REST API endpoints for the React frontend.

## Features

### 🚀 **API Endpoints**
- **Document Upload & Processing**: Upload PDF files and build vector embeddings
- **Chat Interface**: Query the knowledge base with natural language
- **System Monitoring**: Real-time logs, analytics, and system status
- **Admin Dashboard**: System metrics and usage statistics

### 🏗️ **Architecture**
- **FastAPI**: Modern, fast web framework with automatic API documentation
- **Background Tasks**: Asynchronous document processing
- **CORS Support**: Configured for React frontend integration
- **Error Handling**: Comprehensive error responses and logging
- **Type Safety**: Pydantic models for request/response validation

## Installation & Setup

### Prerequisites
- Python 3.8+
- OpenAI API Key (for embeddings)
- All dependencies from the existing RAG system

### 1. Install Dependencies
```bash
cd RAG-Trading-Knowledge-Management/backend
pip install -r requirements.txt
```

### 2. Environment Configuration
Create a `.env` file in the backend directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Copy Trading Retrieval System
Make sure the `trading_retrieval_system.py` file is in the parent directory or update the import path in `main.py`.

### 4. Start the Server
```bash
# Development mode with auto-reload
python main.py

# Or using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will start on `http://localhost:8000`

## API Documentation

Once the server is running, you can access:
- **Interactive API Docs**: http://localhost:8000/docs
- **ReDoc Documentation**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Endpoints Overview

### Knowledge Base
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload PDF files for processing |
| `/api/process` | POST | Start document processing and indexing |
| `/api/processing-status` | GET | Get current processing status |

### Chat
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send chat message and get AI response |

### Admin
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/system-status` | GET | Get system statistics and status |
| `/api/logs` | GET | Get system logs with filtering |
| `/api/analytics` | GET | Get usage analytics and query patterns |

## Usage Examples

### Upload and Process Documents
```bash
# Upload PDFs
curl -X POST "http://localhost:8000/api/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@document1.pdf" \
  -F "files=@document2.pdf"

# Start processing (replace upload_id with actual ID from upload response)
curl -X POST "http://localhost:8000/api/process?upload_id=abc12345"

# Check processing status
curl -X GET "http://localhost:8000/api/processing-status"
```

### Query the Knowledge Base
```bash
curl -X POST "http://localhost:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "What are the key risk management strategies?",
    "chat_id": "optional_chat_id"
  }'
```

### Get System Status
```bash
curl -X GET "http://localhost:8000/api/system-status"
```

## Integration with Frontend

The backend is pre-configured to work with the React frontend:

1. **CORS**: Allows requests from `http://localhost:3000`
2. **API Structure**: Matches the expected frontend API calls
3. **Error Handling**: Provides user-friendly error messages
4. **Real-time Updates**: Supports polling for status updates

## Project Structure

```
backend/
├── main.py                 # FastAPI application and endpoints
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── api_server.log         # Server logs (created at runtime)
└── uploads/               # Uploaded files directory (created at runtime)
```

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for embedding generation
- `REACT_APP_API_URL`: Frontend API base URL (default: http://localhost:8000)

### FastAPI Settings
- **Host**: `0.0.0.0` (accessible from all interfaces)
- **Port**: `8000`
- **Reload**: Enabled in development mode
- **CORS**: Configured for React frontend

## Logging

The backend provides comprehensive logging:
- **File Logging**: `api_server.log`
- **Console Logging**: Real-time output
- **API Logging**: All API requests and responses
- **Error Tracking**: Detailed error information

## Error Handling

Common error scenarios and responses:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `503 Service Unavailable` | Knowledge base not loaded | Upload documents first |
| `404 Not Found` | Upload ID not found | Invalid upload ID |
| `400 Bad Request` | Invalid file type | Only PDF files accepted |
| `500 Internal Server Error` | Processing failed | Check logs for details |

## Performance Considerations

### Production Deployment
For production deployment:

1. **Use Production ASGI Server**:
   ```bash
   pip install gunicorn
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

2. **Environment Variables**:
   ```env
   ENVIRONMENT=production
   LOG_LEVEL=INFO
   ```

3. **Database Integration**:
   - Replace in-memory storage with Redis/PostgreSQL
   - Add persistent session management
   - Implement proper user authentication

4. **Security**:
   - Add API rate limiting
   - Implement JWT authentication
   - Configure HTTPS
   - Validate file uploads more strictly

### Memory Management
- The system keeps processed documents in memory
- For large document sets, consider implementing:
  - Document chunking strategies
  - Cache eviction policies
  - Database storage for embeddings

## Troubleshooting

### Common Issues

1. **Import Error for trading_retrieval_system**:
   ```python
   # Update the import path in main.py
   sys.path.append('/path/to/your/trading_retrieval_system.py')
   ```

2. **OpenAI API Key Error**:
   ```bash
   export OPENAI_API_KEY=your_key_here
   ```

3. **CORS Issues**:
   ```python
   # Update CORS origins in main.py
   allow_origins=["http://your-frontend-url:port"]
   ```

4. **Port Already in Use**:
   ```bash
   # Use a different port
   uvicorn main:app --port 8001
   ```

### Debug Mode

Enable debug logging:
```python
import logging
logging.getLogger().setLevel(logging.DEBUG)
```

## Development

### Adding New Endpoints
1. Define Pydantic models for request/response
2. Add endpoint function with proper decorators
3. Update error handling and logging
4. Test with frontend integration

### Testing
```bash
# Manual testing with curl
curl -X GET "http://localhost:8000/health"

# Test file upload
curl -X POST "http://localhost:8000/api/upload" \
  -F "files=@test.pdf"
```

## License

This project is part of the Trading RAG Knowledge Management System.

## Support

For issues and questions:
1. Check the server logs: `tail -f api_server.log`
2. Verify OpenAI API key is set
3. Ensure all dependencies are installed
4. Test individual endpoints using the interactive docs at `/docs` 