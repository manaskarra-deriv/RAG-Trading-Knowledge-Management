# Deployment Guide: Render + Vercel

This guide explains how to deploy the Trading RAG application with backend on Render and frontend on Vercel.

## 🔧 Prerequisites

- GitHub repository (already set up)
- Render account (render.com)
- Vercel account (vercel.com)
- OpenAI API key

## 🚀 Backend Deployment (Render)

### 1. Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `mrudula-deriv/RAG-Trading-Knowledge-Management`
4. Configure the service:

**Basic Settings:**
- **Name**: `trading-rag-backend`
- **Region**: Oregon (US West)
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: Python 3

**Build & Deploy:**
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python main.py`

### 2. Environment Variables

Add these environment variables in Render:

```env
OPENAI_API_KEY=your_openai_api_key_here
API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-3.5-turbo
EMBEDDING_MODEL=text-embedding-3-small
```

### 3. Health Check

- **Health Check Path**: `/health`

### 4. Deploy

Click "Create Web Service" and wait for deployment to complete.

**Your backend URL will be**: `https://trading-rag-backend.onrender.com`

---

## 🌐 Frontend Deployment (Vercel)

### 1. Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `mrudula-deriv/RAG-Trading-Knowledge-Management`
4. Configure the project:

**Project Settings:**
- **Framework Preset**: Create React App
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `build`

### 2. Environment Variables

Add this environment variable in Vercel:

```env
REACT_APP_API_URL=https://trading-rag-backend.onrender.com
```

*Replace with your actual Render backend URL*

### 3. Deploy

Click "Deploy" and wait for deployment to complete.

**Your frontend URL will be**: `https://your-project-name.vercel.app`

---

## 🔒 Important Configuration

### Backend CORS Update

After getting your Vercel frontend URL, update the CORS settings in `backend/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "https://your-project-name.vercel.app"  # Add your Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then redeploy the backend.

---

## 📊 Persistent Logging Features

✅ **Admin logs are now persistent and survive restarts!**

- Logs stored in `persistent_logs.json` file
- Automatically saves after each log entry
- Keeps last 10,000 entries to prevent file bloat
- Tracks all user queries, response times, and system events
- Password: `DerivRAG` for admin access

### What's Tracked:
- All user queries and responses
- System startup/shutdown events
- Error messages and warnings
- User session information
- API response times
- Document processing status

---

## 🧪 Testing Deployment

### 1. Test Backend
```bash
curl https://your-backend-url.onrender.com/health
```

### 2. Test Frontend
Visit your Vercel URL and verify:
- Chat functionality works
- Knowledge base upload works
- Admin panel (password: `DerivRAG`)
- Logs are persistent across restarts

---

## 🔧 Troubleshooting

### Common Issues:

1. **CORS Errors**: Update frontend URL in backend CORS settings
2. **Environment Variables**: Double-check all env vars are set correctly
3. **Build Failures**: Check build logs for missing dependencies
4. **API Connection**: Verify backend URL in frontend env vars

### Logs Access:
- Render: Check service logs in dashboard
- Vercel: Check function logs in dashboard
- Application: Use admin panel with password `DerivRAG`

---

## 📝 Post-Deployment Checklist

- [ ] Backend health check returns 200
- [ ] Frontend loads without console errors
- [ ] Chat functionality works end-to-end
- [ ] File upload and processing works
- [ ] Admin panel accessible with password
- [ ] Persistent logs working (survive backend restart)
- [ ] CORS configured for your domains

---

## 🔐 Security Notes

- Admin password is hardcoded as `DerivRAG` 
- Change this in production by updating the password check in backend
- OpenAI API key should be kept secure in environment variables
- Consider rate limiting for production use

---

**Your app is now deployed and production-ready!** 🎉 