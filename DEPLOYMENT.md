# RAG Trading Knowledge Management - Deployment Guide

Complete deployment guide for the RAG Trading Knowledge Management system using Render (backend) and Vercel (frontend).

## 🏗️ Architecture Overview

- **Backend**: FastAPI application with LiteLLM integration
- **Frontend**: React application with admin panel
- **Database**: FAISS vector store for document embeddings
- **AI Service**: OpenAI/LiteLLM for chat and embeddings

## 🚀 Quick Start

### Prerequisites
- GitHub account
- Render account (for backend)
- Vercel account (for frontend)
- OpenAI API key

### 1. Backend Deployment (Render)

1. **Create Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository and branch

2. **Configure Service**
   ```
   Name: trading-rag-backend
   Environment: Python
   Region: Oregon (or preferred)
   Branch: main
   Root Directory: backend
   Build Command: pip install --upgrade pip && pip install -r requirements.txt
   Start Command: python main.py
   ```

3. **Environment Variables**
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   API_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL_NAME=gpt-4o-mini
   EMBEDDING_MODEL=text-embedding-3-small
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://your-frontend-url.vercel.app
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (usually 5-10 minutes)
   - Note your backend URL: `https://your-service-name.onrender.com`

### 2. Frontend Deployment (Vercel)

1. **Import Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import from GitHub
   - Select your repository

2. **Configure Build Settings**
   ```
   Framework Preset: Create React App
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: build
   ```

3. **Environment Variables**
   ```bash
   REACT_APP_API_URL=https://your-backend-url.onrender.com
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build completion
   - Your app will be available at: `https://your-project.vercel.app`

## 📋 Post-Deployment Setup

### 1. Update CORS Settings
After frontend deployment, update the backend's `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://your-actual-frontend-url.vercel.app
```

### 2. Upload Documents
1. Visit your frontend URL
2. Go to Admin panel (password: `DerivRAG`)
3. Upload PDF documents
4. Wait for processing to complete

### 3. Test the System
- Try asking questions about your documents
- Verify responses are relevant
- Check admin analytics

## 🔧 Troubleshooting

### Critical Issue: Cloudflare Blocking LiteLLM Endpoint

**Problem**: The LiteLLM endpoint `https://litellm.deriv.ai/v1` is being blocked by Cloudflare, preventing document processing from completing.

**Symptoms**:
- Document upload succeeds
- Processing starts but fails during embedding generation
- Error logs show "Sorry, you have been blocked" HTML response
- Processing gets stuck at "Building FAISS vector store..."

**Solution**:

1. **Update Environment Variables in Render Dashboard**:
   - Go to your Render service → Environment tab
   - Update these variables (dashboard settings override render.yaml):
     ```
     API_BASE_URL=https://api.openai.com/v1
     OPENAI_MODEL_NAME=gpt-4o-mini
     EMBEDDING_MODEL=text-embedding-3-small
     ```
   - Click "Save Changes" and select "Save and Deploy"

2. **Verify Configuration**:
   - Check deployment logs to confirm correct API base URL
   - Look for: `Using API Base URL: https://api.openai.com/v1`
   - Test document processing with a small PDF

3. **Alternative Solutions**:
   - Use a different LiteLLM endpoint if available
   - Contact LiteLLM provider about Cloudflare issues
   - Implement retry logic with exponential backoff

### Common Issues

#### CORS Errors
```
Access to fetch at 'backend-url' from origin 'frontend-url' has been blocked by CORS policy
```
**Solution**: Update `ALLOWED_ORIGINS` in backend environment variables

#### API Connection Issues
```
Failed to fetch from backend
```
**Solutions**:
- Verify `REACT_APP_API_URL` is correct
- Check backend service is running
- Test backend health endpoint: `/health`

#### Document Processing Failures
```
Document processing failed
```
**Solutions**:
- Check OpenAI API key is valid and has quota
- Verify API base URL is accessible
- Check file format (PDF only)
- Monitor backend logs during processing

#### Admin Panel Access Issues
```
401 Unauthorized
```
**Solutions**:
- Password is case-sensitive: `DerivRAG`
- Clear browser cache
- Check network tab for API errors

### Debugging Steps

1. **Check Backend Health**:
   ```bash
   curl https://your-backend-url.onrender.com/health
   ```

2. **Check Frontend Environment**:
   - Open browser dev tools
   - Check if `REACT_APP_API_URL` is set correctly
   - Look for console errors

3. **Monitor Logs**:
   - Render: Service logs in dashboard
   - Vercel: Function logs in dashboard
   - Browser: Console and Network tabs

## 📊 Monitoring and Maintenance

### Health Checks
- Backend: `https://your-backend-url.onrender.com/health`
- Frontend: Should load without console errors

### Persistent Logging
- Admin logs are stored in `persistent_logs.json`
- Survives backend restarts
- Tracks queries, errors, and system events
- Access via admin panel (password: `DerivRAG`)

### Performance Monitoring
- Monitor response times in admin analytics
- Check memory usage during document processing
- Consider upgrading Render plan for better performance

## 🔐 Security Considerations

### API Keys
- Never commit API keys to version control
- Use environment variables for all secrets
- Rotate keys regularly
- Monitor API usage and billing

### CORS Configuration
- Only allow necessary origins
- Update `ALLOWED_ORIGINS` when adding new domains
- Avoid using wildcards in production

### Admin Access
- Default password: `DerivRAG`
- Consider implementing proper authentication
- Monitor admin panel access logs

## 🚀 Performance Optimization

### Backend
- Use appropriate Render plan for your usage
- Monitor memory during document processing
- Implement caching for frequently accessed data
- Consider using Redis for session storage

### Frontend
- Enable Vercel's edge caching
- Optimize bundle size
- Use lazy loading for components
- Implement proper error boundaries

## 📝 Deployment Checklist

- [ ] Backend deployed and health check passes
- [ ] Frontend deployed and loads without errors
- [ ] Environment variables configured correctly
- [ ] CORS settings updated with frontend URL
- [ ] Document upload and processing works
- [ ] Chat functionality works end-to-end
- [ ] Admin panel accessible (password: `DerivRAG`)
- [ ] Persistent logging working
- [ ] API endpoints responding correctly
- [ ] Error handling working properly

## 🆘 Getting Help

If you encounter issues:

1. **Check this guide** for common solutions
2. **Review logs** in Render and Vercel dashboards
3. **Test with minimal examples** (single document, simple query)
4. **Check API quotas** and billing status
5. **Verify environment variables** are set correctly

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://reactjs.org/docs)

---

**Last Updated**: January 2025  
**Version**: 2.0.0
