# Trading RAG Frontend

A modern React frontend for the Trading RAG (Retrieval-Augmented Generation) Knowledge Management System. Built with React, Tailwind CSS, and featuring a dark theme similar to Deriv's design language.

## Features

### 🗃️ Knowledge Base
- **Drag & Drop PDF Upload**: Easy file management with visual feedback
- **Processing Status**: Real-time updates on vector store creation
- **Embedding Generation**: Track the progress of document indexing
- **Vector Store Statistics**: Monitor knowledge base metrics

### 💬 Chatbot Interface
- **ChatGPT-like Experience**: Familiar chat interface
- **Multiple Chat Sessions**: Create and manage different conversations
- **Source Attribution**: See which documents were used for answers
- **Response Rating**: Thumbs up/down feedback system
- **Quick Suggestions**: Pre-built prompts for common queries

### 🛠️ Admin Dashboard
- **System Overview**: Key metrics and performance indicators
- **Real-time Logs**: Monitor system activity and user interactions
- **Analytics**: Query patterns and usage statistics
- **Export Functionality**: Download logs and analytics data

## Technology Stack

- **React 18**: Modern React with hooks
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Beautiful icon library
- **React Dropzone**: File upload handling
- **Axios**: HTTP client for API calls

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Setup Instructions

1. **Navigate to the frontend directory**:
   \`\`\`bash
   cd RAG-Trading-Knowledge-Management/frontend
   \`\`\`

2. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

3. **Move the logo to the public directory**:
   \`\`\`bash
   cp Deriv.png public/
   \`\`\`

4. **Start the development server**:
   \`\`\`bash
   npm start
   \`\`\`

5. **Open your browser** and navigate to:
   \`\`\`
   http://localhost:3000
   \`\`\`

## Usage Guide

### Knowledge Base Tab
1. **Upload PDFs**: Drag and drop PDF files or click to browse
2. **Process Files**: Click "Process Files" to start indexing
3. **Monitor Progress**: Watch real-time status updates
4. **View Statistics**: Check vector store metrics after completion

### Chatbot Tab
1. **Start Chatting**: Click "New Chat" or use existing conversations
2. **Ask Questions**: Type queries about your trading documents
3. **View Sources**: Check which documents were referenced
4. **Rate Responses**: Use thumbs up/down for feedback
5. **Manage Chats**: Delete or switch between chat sessions

### Admin Tab
1. **System Overview**: Monitor key performance metrics
2. **View Logs**: Search and filter system activity
3. **Export Data**: Download logs and analytics
4. **Monitor Usage**: Track user queries and system health

## Customization

### Colors and Theming
The app uses Deriv's color scheme defined in `tailwind.config.js`:
- Primary: `#00A19C` (Deriv teal)
- Secondary: `#14C8B0` (Deriv green)
- Dark: `#0E0E0E` (Background)
- Gray variations for UI elements

### API Integration
Currently uses mock data. To integrate with your backend:

1. **Update API endpoints** in each component
2. **Replace mock functions** with actual API calls
3. **Configure Axios base URL** for your backend
4. **Add authentication** if required

## File Structure

\`\`\`
frontend/
├── public/
│   ├── index.html
│   └── Deriv.png (logo)
├── src/
│   ├── components/
│   │   ├── KnowledgeBase.js
│   │   ├── Chatbot.js
│   │   └── Admin.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
\`\`\`

## Available Scripts

- `npm start`: Start development server
- `npm build`: Build for production
- `npm test`: Run tests
- `npm run eject`: Eject from Create React App

## API Endpoints (To Implement)

### Knowledge Base
- `POST /api/upload` - Upload PDF files
- `GET /api/documents` - List uploaded documents
- `POST /api/process` - Process documents for indexing
- `GET /api/status` - Get processing status

### Chatbot
- `POST /api/chat` - Send chat message
- `GET /api/chats` - Get chat history
- `DELETE /api/chats/:id` - Delete chat

### Admin
- `GET /api/logs` - Get system logs
- `GET /api/analytics` - Get usage analytics
- `GET /api/status` - Get system status

## Development

### Adding New Features
1. Create component in `src/components/`
2. Import and use in `App.js`
3. Add routing if needed
4. Update styling with Tailwind classes

### Styling Guidelines
- Use Deriv color scheme (`deriv-primary`, `deriv-gray`, etc.)
- Follow dark theme patterns
- Maintain consistent spacing and typography
- Use hover states and transitions for better UX

## Deployment

### Build for Production
\`\`\`bash
npm run build
\`\`\`

### Deploy to Static Hosting
The `build` folder can be deployed to:
- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages

## Contributing

1. Follow the existing code style
2. Test your changes thoroughly
3. Update documentation as needed
4. Ensure responsive design works on all devices

## Support

For issues or questions:
1. Check the console for error messages
2. Verify all dependencies are installed
3. Ensure the backend API is running (when integrated)
4. Check network connectivity for API calls 