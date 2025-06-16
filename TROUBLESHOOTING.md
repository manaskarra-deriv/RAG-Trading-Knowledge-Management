# Troubleshooting Guide

This guide covers common issues and solutions for the RAG Trading Knowledge Management system.

## 🚨 Critical Issue: Cloudflare Blocking LiteLLM Endpoint

### Problem Description
The LiteLLM endpoint `https://litellm.deriv.ai/v1` is being blocked by Cloudflare, preventing document processing from completing.

### Symptoms
- Document upload succeeds (46 files uploaded successfully)
- Processing starts and extracts text from PDFs
- Processing fails during embedding generation with Cloudflare block page
- Error logs show HTML response: "Sorry, you have been blocked"
- Processing gets stuck at "Building FAISS vector store..." step

### Root Cause
Cloudflare is blocking requests from Render's IP addresses to the LiteLLM endpoint, likely due to:
- Rate limiting policies
- Geographic restrictions
- IP reputation issues
- Security policies

### Solution Steps

#### 1. Update Environment Variables in Render Dashboard

**Important**: Environment variables set in the Render dashboard take precedence over those in `render.yaml`.

1. Go to your Render service dashboard
2. Click on the "Environment" tab
3. Update or add these environment variables:
   ```
   API_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL_NAME=gpt-4o-mini
   EMBEDDING_MODEL=text-embedding-3-small
   ```
4. Click "Save Changes"
5. Select "Save and Deploy" to trigger a new deployment

#### 2. Verify the Fix

1. **Check Deployment Logs**:
   Look for these lines in the startup logs:
   ```
   Using API Base URL: https://api.openai.com/v1
   Using Model: gpt-4o-mini
   Using Embedding Model: text-embedding-3-small
   ```

2. **Test Document Processing**:
   - Upload a small PDF document
   - Monitor the processing logs
   - Verify it completes successfully

#### 3. Alternative Solutions

If you need to continue using LiteLLM:

1. **Try Different LiteLLM Endpoint**:
   ```
   API_BASE_URL=https://alternative-litellm-endpoint.com/v1
   ```

2. **Contact LiteLLM Provider**:
   - Report the Cloudflare blocking issue
   - Request IP whitelisting for Render's IP ranges

3. **Use Proxy or VPN**:
   - Set up a proxy service to route requests
   - Use a VPN endpoint that's not blocked

### Prevention
- Use standard OpenAI endpoints for production deployments
- Keep LiteLLM for development/testing environments only
- Monitor API endpoint availability
- Have fallback endpoints configured

---

## 🔧 Common Issues and Solutions

### CORS Errors

**Error**:
```
Access to fetch at 'backend-url' from origin 'frontend-url' has been blocked by CORS policy
```

**Solution**:
1. Update `ALLOWED_ORIGINS` in backend environment variables
2. Include your exact frontend URL
3. Redeploy the backend service

**Example**:
```
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

### API Connection Issues

**Error**:
```
Failed to fetch from backend
Network Error
```

**Solutions**:
1. Verify `REACT_APP_API_URL` is correct in frontend
2. Check backend service is running: `/health` endpoint
3. Test backend directly with curl:
   ```bash
   curl https://your-backend-url.onrender.com/health
   ```

### Document Processing Failures

**Error**:
```
Document processing failed
Error during embedding generation
```

**Solutions**:
1. Check OpenAI API key is valid and has quota
2. Verify API base URL is accessible
3. Ensure file is in PDF format
4. Check file size (large files may timeout)
5. Monitor backend logs during processing

### Admin Panel Access Issues

**Error**:
```
401 Unauthorized
Invalid password
```

**Solutions**:
1. Password is case-sensitive: `DerivRAG`
2. Clear browser cache and cookies
3. Check network tab for API errors
4. Verify admin endpoints are working:
   ```bash
   curl -H "X-Admin-Password: DerivRAG" https://your-backend-url.onrender.com/api/system-status
   ```

### Build Failures

**Frontend Build Errors**:
```
Module not found
ESLint errors
```

**Solutions**:
1. Check for unused imports
2. Fix ESLint warnings
3. Verify all dependencies are installed
4. Check `package.json` for missing packages

**Backend Build Errors**:
```
Package installation failed
Python version mismatch
```

**Solutions**:
1. Check `requirements.txt` for version conflicts
2. Verify Python version compatibility
3. Update pip: `pip install --upgrade pip`
4. Clear build cache in Render

### Environment Variable Issues

**Problem**: Variables not being loaded correctly

**Solutions**:
1. Check variable names are exact (case-sensitive)
2. Verify no extra spaces in values
3. For Render: Dashboard variables override YAML
4. For Vercel: Variables must start with `REACT_APP_`
5. Redeploy after changing variables

---

## 🔍 Debugging Steps

### 1. Backend Health Check
```bash
curl https://your-backend-url.onrender.com/health
```
Expected response: `{"status": "healthy"}`

### 2. Frontend Environment Check
1. Open browser dev tools
2. Go to Console tab
3. Check if `process.env.REACT_APP_API_URL` is set
4. Look for any console errors

### 3. API Endpoint Testing
```bash
# Test chat endpoint
curl -X POST https://your-backend-url.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "session_id": "test"}'

# Test admin endpoint
curl -H "X-Admin-Password: DerivRAG" \
  https://your-backend-url.onrender.com/api/system-status
```

### 4. Log Analysis

**Render Logs**:
- Go to service dashboard
- Click "Logs" tab
- Look for error messages and stack traces

**Vercel Logs**:
- Go to project dashboard
- Click "Functions" tab
- Check for runtime errors

**Browser Logs**:
- Open dev tools (F12)
- Check Console for JavaScript errors
- Check Network tab for failed requests

---

## 📊 Performance Issues

### Slow Document Processing

**Symptoms**:
- Processing takes very long
- Timeouts during upload
- Memory errors

**Solutions**:
1. Process smaller batches of documents
2. Upgrade Render plan for more resources
3. Optimize PDF file sizes
4. Implement processing queue

### Slow Chat Responses

**Symptoms**:
- Long wait times for responses
- Timeout errors

**Solutions**:
1. Check OpenAI API response times
2. Optimize vector search parameters
3. Implement response caching
4. Use faster embedding models

### High Memory Usage

**Symptoms**:
- Out of memory errors
- Service restarts

**Solutions**:
1. Upgrade Render plan
2. Optimize document chunking
3. Clear vector store cache periodically
4. Monitor memory usage patterns

---

## 🔐 Security Issues

### API Key Exposure

**Problem**: API keys visible in logs or client

**Solutions**:
1. Never log API keys
2. Use environment variables only
3. Rotate keys if exposed
4. Monitor API usage for anomalies

### Unauthorized Access

**Problem**: Admin panel accessed without password

**Solutions**:
1. Verify password validation is working
2. Check for bypass vulnerabilities
3. Implement rate limiting
4. Monitor access logs

---

## 🆘 Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Review recent changes** to code or configuration
3. **Test with minimal examples** (single document, simple query)
4. **Collect relevant logs** and error messages
5. **Verify environment variables** are set correctly

### Information to Include

When reporting issues, include:
- Exact error messages
- Steps to reproduce
- Environment (development/production)
- Recent changes made
- Relevant log excerpts
- Browser/system information

### Escalation Path

1. **Self-service**: Use this guide and documentation
2. **Community**: Check GitHub issues and discussions
3. **Support**: Contact development team with detailed information

---

**Last Updated**: January 2025  
**Version**: 1.0.0 