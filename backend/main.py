"""
FastAPI Backend for Trading RAG Knowledge Management System

This backend provides REST API endpoints for:
- PDF document upload and processing
- Chat/query functionality
- System monitoring and analytics
- Admin dashboard data
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path
import shutil
import hashlib
from collections import defaultdict
import re

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import our existing retrieval system
import sys
sys.path.append('..')
from trading_retrieval_system import TradingKnowledgeRetriever, RetrievalConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api_server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Trading RAG API",
    description="REST API for Trading Knowledge Retrieval-Augmented Generation System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LiteLLM Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.openai.com/v1")  # Default to OpenAI if not set
OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "gpt-3.5-turbo")  # Default model
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")  # Default embedding model

# Validate environment variables
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY environment variable is required")
    raise ValueError("OPENAI_API_KEY environment variable is required")

logger.info(f"Using API Base URL: {API_BASE_URL}")
logger.info(f"Using Model: {OPENAI_MODEL_NAME}")
logger.info(f"Using Embedding Model: {EMBEDDING_MODEL}")

# Global variables
retriever: Optional[TradingKnowledgeRetriever] = None
system_stats = {
    "total_queries": 0,
    "unique_users": set(),
    "documents_processed": 0,
    "average_response_time": 0.0,
    "uptime_start": datetime.now(),
    "query_history": [],
    "error_count": 0,
    "processing_status": "idle"
}

# In-memory storage for demo (use Redis/DB in production)
chat_sessions = {}
query_analytics = defaultdict(int)

# Persistent logging system
LOGS_FILE = "persistent_logs.json"
MAX_LOG_ENTRIES = 10000  # Keep last 10k entries to prevent file from growing too large

def load_logs_from_file():
    """Load logs from persistent file"""
    try:
        if os.path.exists(LOGS_FILE):
            with open(LOGS_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading logs from file: {e}")
    return []

def save_logs_to_file(logs):
    """Save logs to persistent file"""
    try:
        # Keep only the most recent entries to prevent file from growing too large
        recent_logs = logs[-MAX_LOG_ENTRIES:] if len(logs) > MAX_LOG_ENTRIES else logs
        with open(LOGS_FILE, 'w') as f:
            json.dump(recent_logs, f, default=str, indent=2)
    except Exception as e:
        logger.error(f"Error saving logs to file: {e}")

# Load existing logs on startup
system_logs = load_logs_from_file()

# Add conversation memory storage
conversation_memory = defaultdict(list)  # chat_id -> list of messages

# Pydantic models
class ChatMessage(BaseModel):
    content: str
    chat_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]]
    chat_id: str
    response_time: float

class UploadResponse(BaseModel):
    message: str
    files_received: List[str]
    upload_id: str

class ProcessingStatus(BaseModel):
    status: str  # idle, processing, completed, error
    progress: int  # 0-100
    current_step: str
    steps_completed: List[str]
    total_files: int
    files_processed: int
    error_message: Optional[str] = None

class SystemStatus(BaseModel):
    total_queries: int
    unique_users: int
    documents_indexed: int
    average_response_time: float
    uptime_hours: float
    retriever_loaded: bool
    processing_status: str
    api_base_url: str
    model_name: str
    embedding_model: str

class LogEntry(BaseModel):
    id: int
    timestamp: datetime
    level: str
    message: str
    user: Optional[str] = None
    query: Optional[str] = None
    response_time: Optional[float] = None

# Utility functions
def add_log(level: str, message: str, user: str = None, query: str = None, response_time: float = None):
    """Add a log entry to the system logs and save to persistent storage"""
    log_entry = {
        "id": len(system_logs) + 1,
        "timestamp": datetime.now(),
        "level": level,
        "message": message,
        "user": user,
        "query": query,
        "response_time": response_time
    }
    system_logs.append(log_entry)
    
    # Save to persistent file
    save_logs_to_file(system_logs)
    
    logger.info(f"{level}: {message}")

def create_custom_retrieval_config():
    """Create a custom RetrievalConfig with LiteLLM settings"""
    config = RetrievalConfig()
    
    # Always use the embedding model from environment variables
    config.embedding_model = EMBEDDING_MODEL
    
    # Set the base URL for LiteLLM support (if different from OpenAI)
    if API_BASE_URL != "https://api.openai.com/v1":
        config.base_url = API_BASE_URL
    
    return config

def get_retriever():
    """Dependency to get the retriever instance"""
    global retriever
    if retriever is None:
        raise HTTPException(status_code=503, detail="Retrieval system not loaded. Please process documents first.")
    return retriever

def verify_admin_password(x_admin_password: str = Header(None)):
    """Verify admin password from header"""
    if x_admin_password != "DerivRAG":
        raise HTTPException(
            status_code=401, 
            detail="Invalid admin password. Please provide the correct password in X-Admin-Password header."
        )
    return True

# API Endpoints

@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup"""
    global retriever
    add_log("INFO", f"Trading RAG API server starting up with LiteLLM support")
    add_log("INFO", f"Loaded {len(system_logs)} existing log entries from persistent storage")
    add_log("INFO", f"API Base URL: {API_BASE_URL}")
    add_log("INFO", f"Chat Model: {OPENAI_MODEL_NAME}")
    add_log("INFO", f"Embedding Model: {EMBEDDING_MODEL}")
    
    # Try to load existing retrieval system
    try:
        config = create_custom_retrieval_config()
        retriever = TradingKnowledgeRetriever(config)
        if retriever.load_retrieval_system():
            add_log("SUCCESS", "Existing retrieval system loaded successfully")
            system_stats["documents_processed"] = len(retriever.documents) if retriever.documents else 0
        else:
            add_log("WARNING", "No existing retrieval system found. Upload documents to create one.")
    except Exception as e:
        add_log("ERROR", f"Failed to load retrieval system: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Trading RAG API Server with LiteLLM Support", 
        "status": "running", 
        "docs": "/docs",
        "api_base_url": API_BASE_URL,
        "model": OPENAI_MODEL_NAME,
        "embedding_model": EMBEDDING_MODEL
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "timestamp": datetime.now(),
        "api_base_url": API_BASE_URL,
        "model": OPENAI_MODEL_NAME,
        "embedding_model": EMBEDDING_MODEL
    }

# Knowledge Base Endpoints

@app.post("/api/upload", response_model=UploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload PDF files for processing"""
    try:
        upload_id = hashlib.md5(f"{datetime.now()}".encode()).hexdigest()[:8]
        uploaded_files = []
        
        # Create upload directory
        upload_dir = Path("uploads") / upload_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail=f"File {file.filename} is not a PDF")
            
            # Save uploaded file
            file_path = upload_dir / file.filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            uploaded_files.append(file.filename)
            add_log("INFO", f"File uploaded: {file.filename}", user="api_user")
        
        return UploadResponse(
            message=f"Successfully uploaded {len(uploaded_files)} files",
            files_received=uploaded_files,
            upload_id=upload_id
        )
        
    except Exception as e:
        add_log("ERROR", f"File upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process")
async def process_documents(background_tasks: BackgroundTasks, upload_id: str):
    """Process uploaded documents to build the retrieval system"""
    global system_stats
    
    upload_dir = Path("uploads") / upload_id
    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload ID not found")
    
    # Start background processing
    background_tasks.add_task(process_documents_background, upload_dir)
    system_stats["processing_status"] = "processing"
    
    add_log("INFO", f"Started processing documents from upload {upload_id}")
    return {"message": "Document processing started", "upload_id": upload_id}

async def process_documents_background(upload_dir: Path):
    """Background task to process documents"""
    global retriever, system_stats
    
    try:
        add_log("INFO", "Starting document processing with LiteLLM configuration")
        system_stats["processing_status"] = "processing"
        
        # Create new retriever instance with custom config
        config = create_custom_retrieval_config()
        config.pdf_folder = str(upload_dir)
        retriever = TradingKnowledgeRetriever(config)
        
        # Build retrieval system
        build_stats = retriever.build_retrieval_system(str(upload_dir))
        
        system_stats["processing_status"] = "completed"
        system_stats["documents_processed"] = build_stats["total_documents"]
        
        add_log("SUCCESS", f"Document processing completed. Processed {build_stats['total_documents']} documents")
        
    except Exception as e:
        system_stats["processing_status"] = "error"
        add_log("ERROR", f"Document processing failed: {str(e)}")

@app.get("/api/processing-status", response_model=ProcessingStatus)
async def get_processing_status():
    """Get the current processing status"""
    status = system_stats.get("processing_status", "idle")
    
    # Mock progress for demo (in real implementation, track actual progress)
    if status == "processing":
        progress = min(95, (datetime.now().timestamp() % 60) * 2)  # Simulate progress
    elif status == "completed":
        progress = 100
    else:
        progress = 0
    
    return ProcessingStatus(
        status=status,
        progress=int(progress),
        current_step="Building vector index" if status == "processing" else "Idle",
        steps_completed=["Upload", "Text extraction"] if progress > 50 else ["Upload"],
        total_files=system_stats.get("documents_processed", 0),
        files_processed=system_stats.get("documents_processed", 0) if status == "completed" else 0
    )

# Chatbot Endpoints

@app.post("/api/chat", response_model=ChatResponse)
async def chat_query(message: ChatMessage, retriever: TradingKnowledgeRetriever = Depends(get_retriever)):
    """Process a chat query and return response with sources"""
    try:
        start_time = datetime.now()
        
        # Generate unique user ID (in production, use proper authentication)
        user_id = f"user_{hashlib.md5(message.content.encode()).hexdigest()[:8]}"
        chat_id = message.chat_id or f"chat_{hashlib.md5(f'{user_id}_{start_time}'.encode()).hexdigest()[:8]}"
        
        # Get conversation history for this chat
        chat_history = conversation_memory.get(chat_id, [])
        
        # Retrieve relevant documents
        result = retriever.retrieve_documents(
            query=message.content,
            method="hybrid",
            return_scores=True,
            k=10  # Retrieve more documents to ensure complete information
        )
        
        # Generate response using LiteLLM with conversation context
        response_text = await generate_llm_response(message.content, result.documents, chat_history)
        
        # Store the conversation in memory
        conversation_memory[chat_id].append({
            "role": "user",
            "content": message.content,
            "timestamp": start_time
        })
        conversation_memory[chat_id].append({
            "role": "assistant", 
            "content": response_text,
            "timestamp": datetime.now()
        })
        
        # Keep only last 20 messages per chat (10 exchanges) to manage memory
        if len(conversation_memory[chat_id]) > 20:
            conversation_memory[chat_id] = conversation_memory[chat_id][-20:]
        
        # Calculate response time
        response_time = (datetime.now() - start_time).total_seconds()
        
        # Update statistics
        system_stats["total_queries"] += 1
        system_stats["unique_users"].add(user_id)
        system_stats["query_history"].append({
            "query": message.content,
            "response_time": response_time,
            "timestamp": start_time,
            "user": user_id
        })
        
        # Update analytics
        query_analytics[categorize_query(message.content)] += 1
        
        # Format sources (but don't include them in the response)
        sources = []
        # for i, doc in enumerate(result.documents[:3]):  # Top 3 sources
        #     sources.append({
        #         "title": doc.metadata.get("filename", "Unknown Document"),
        #         "page": doc.metadata.get("chunk_index", 0) + 1,
        #         "confidence": result.scores[i] if result.scores else 0.8
        #     })
        
        add_log("INFO", f"Query processed successfully using {OPENAI_MODEL_NAME}", user=user_id, query=message.content, response_time=response_time)
        
        return ChatResponse(
            response=response_text,
            sources=sources,  # Empty sources list
            chat_id=chat_id,
            response_time=response_time
        )
        
    except Exception as e:
        add_log("ERROR", f"Query processing failed: {str(e)}", user=user_id, query=message.content)
        system_stats["error_count"] += 1
        raise HTTPException(status_code=500, detail=str(e))

def clean_markdown_for_chat(text: str) -> str:
    """
    Clean markdown formatting for better chat display
    Converts markdown headers to plain text and improves readability
    """
    if not text:
        return text
    
    # Convert markdown headers to plain text with better formatting
    # ### Header -> **Header**
    text = re.sub(r'^### (.+)$', r'**\1**', text, flags=re.MULTILINE)
    # ## Header -> **Header**
    text = re.sub(r'^## (.+)$', r'**\1**', text, flags=re.MULTILINE)
    # # Header -> **Header**  
    text = re.sub(r'^# (.+)$', r'**\1**', text, flags=re.MULTILINE)
    
    # Clean up any remaining markdown artifacts
    # Remove excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Clean up list formatting - ensure proper spacing
    text = re.sub(r'\n- ', '\n• ', text)  # Convert - to bullet points
    text = re.sub(r'\n\* ', '\n• ', text)  # Convert * to bullet points
    
    return text.strip()

async def generate_llm_response(query: str, documents: List, chat_history: List = None) -> str:
    """Generate a conversational response using LiteLLM/OpenAI compatible API"""
    try:
        query_lower = query.lower().strip()
        
        # Handle greetings first - before relevance check (only if no chat history)
        greeting_patterns = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening']
        if (not chat_history and 
            any(greeting in query_lower for greeting in greeting_patterns) and 
            len(query_lower.split()) <= 3):
            responses = [
                "Hey! I'm Deriv's trading knowledge agent, nice to meet you! 😊",
                "Hello! I'm Deriv's trading assistant, pleasure to meet you! 👋",
                "Hi there! I'm Deriv's trading knowledge agent, nice to meet you! 😄",
                "Hey! I'm Deriv's AI trading assistant, good to meet you! 🤝"
            ]
            import random
            return random.choice(responses)
        
        # Check relevance - but be more permissive if we have documents loaded
        # since the knowledge base itself is trading-focused
        if documents:
            # If we have documents, be more flexible about relevance
            # Only reject obvious off-topic queries
            if is_clearly_irrelevant(query):
                return get_irrelevant_query_response(query)
        else:
            # If no documents, use stricter relevance checking
            if not is_trading_relevant(query):
                return get_irrelevant_query_response(query)
        
        if not documents:
            return get_no_documents_response()
        
        # Extract and clean relevant content from retrieved documents
        relevant_info = []
        for doc in documents[:5]:  # Use top 5 most relevant documents to get more complete info
            content = doc.page_content.strip()
            if content:
                relevant_info.append(content)
        
        # Generate conversational response using LiteLLM
        try:
            import openai
            
            # Set up OpenAI client with LiteLLM configuration
            client = openai.OpenAI(
                api_key=os.getenv("OPENAI_API_KEY", "not-needed-for-litellm"),
                base_url=API_BASE_URL
            )
            
            # Create a comprehensive context from retrieved documents
            context = "\n\n".join(relevant_info)
            
            # System prompt for conversational trading assistant
            system_prompt = """You are a helpful trading assistant. Provide clear, informative answers based on the uploaded documents.

Guidelines:
- Be conversational and natural
- Bold **key terms** 
- Use bullet points • for lists when helpful
- Answer the question with appropriate detail
- Keep it focused and readable"""

            # Build conversation history for context
            conversation_context = ""
            if chat_history and len(chat_history) > 0:
                conversation_context = "\n\nPrevious conversation:\n"
                for msg in chat_history[-6:]:  # Include last 3 exchanges (6 messages)
                    role = "User" if msg["role"] == "user" else "Assistant"
                    conversation_context += f"{role}: {msg['content']}\n"
                conversation_context += "\n"

            user_prompt = f"""Context: {context}
{conversation_context}
Question: "{query}"

Please answer this question using the context provided. Be helpful and clear."""

            response = client.chat.completions.create(
                model=OPENAI_MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=400  
            )
            
            # Get the response text and clean markdown formatting
            response_text = response.choices[0].message.content.strip()
            cleaned_response = clean_markdown_for_chat(response_text)
            
            return cleaned_response
            
        except Exception as e:
            logger.error(f"LiteLLM API call failed, falling back to template response: {str(e)}")
            # Fallback to template-based responses
            fallback_response = generate_template_response(query, relevant_info, chat_history)
            return clean_markdown_for_chat(fallback_response)
            
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        return f"I apologize, but I encountered an issue processing your question. Could you please try rephrasing it? 🤔"

def is_trading_relevant(query: str) -> bool:
    """Check if the query is related to trading, finance, or markets"""
    query_lower = query.lower().strip()
    
    # Handle greetings and normal conversation starters - these are fine
    greeting_patterns = [
        'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
        'how are you', 'whats up', "what's up", 'sup', 'greetings'
    ]
    
    # If it's just a greeting, allow it
    if any(greeting in query_lower for greeting in greeting_patterns) and len(query_lower.split()) <= 3:
        return True
    
    # Trading and finance related keywords
    trading_keywords = [
        # Core trading terms
        'trading', 'trade', 'trader', 'market', 'markets', 'stock', 'stocks', 'forex', 'currency',
        'investment', 'invest', 'portfolio', 'asset', 'assets', 'financial', 'finance',
        'risk', 'profit', 'loss', 'position', 'positions', 'buy', 'sell', 'price', 'chart',
        
        # Technical analysis
        'indicator', 'indicators', 'technical', 'analysis', 'trend', 'trends', 'support', 'resistance',
        'candlestick', 'moving average', 'rsi', 'macd', 'bollinger', 'fibonacci', 'volume',
        
        # Strategy and management
        'strategy', 'strategies', 'plan', 'planning', 'management', 'diversification', 'allocation',
        'hedge', 'hedging', 'arbitrage', 'scalping', 'swing', 'day trading',
        
        # Market types
        'cryptocurrency', 'crypto', 'bitcoin', 'ethereum', 'commodity', 'commodities', 'gold',
        'oil', 'indices', 'index', 'etf', 'bond', 'bonds', 'derivatives', 'options', 'futures',
        
        # Options and derivatives terms
        'lookbacks', 'lookback', 'barrier', 'barriers', 'knock-in', 'knock-out', 'binary',
        'digital', 'exotic', 'vanilla', 'call', 'put', 'strike', 'expiry', 'expiration',
        'premium', 'volatility', 'delta', 'gamma', 'theta', 'vega', 'greeks',
        
        # Platforms and tools
        'smarttrader', 'deriv', 'platform', 'broker', 'brokerage', 'exchange', 'mt4', 'mt5',
        
        # Economic terms
        'economy', 'economic', 'inflation', 'interest rate', 'gdp', 'unemployment', 'federal reserve',
        'central bank', 'monetary', 'fiscal', 'bull market', 'bear market', 'recession'
    ]
    
    # Check if any trading keywords are present
    for keyword in trading_keywords:
        if keyword in query_lower:
            return True
    
    # Check for question patterns that might be trading-related
    trading_patterns = [
        'how to trade', 'what is', 'how do i', 'can you explain', 'tell me about',
        'help me understand', 'what are the', 'how does', 'when should i'
    ]
    
    for pattern in trading_patterns:
        if pattern in query_lower:
            # If it contains a trading pattern, it might be relevant
            # But let's be more specific and check for context
            if any(keyword in query_lower for keyword in ['market', 'trading', 'invest', 'stock', 'profit', 'loss']):
                return True
    
    return False

def get_irrelevant_query_response(query: str) -> str:
    """Generate a polite response for irrelevant queries"""
    query_lower = query.lower().strip()
    
    # Handle greetings specially
    greeting_patterns = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening']
    if any(greeting in query_lower for greeting in greeting_patterns) and len(query_lower.split()) <= 3:
        responses = [
            "Hey! I'm Deriv's trading knowledge agent, nice to meet you! 😊",
            "Hello! I'm Deriv's trading assistant, pleasure to meet you! 👋",
            "Hi there! I'm Deriv's trading knowledge agent, nice to meet you! 😄",
            "Hey! I'm Deriv's AI trading assistant, good to meet you! 🤝"
        ]
    else:
        # For truly irrelevant topics
        responses = [
            "I can't help with that. Ask me about trading! 📈",
            "Sorry, I can't help with that topic. Ask me about trading instead! 💼",
            "I can't assist with that. Try asking about trading or markets! 📊",
            "I can't help with that. Ask me about trading, risk management, or market analysis! 🎯"
        ]
    
    import random
    return random.choice(responses)

def get_no_documents_response() -> str:
    """Response when no relevant documents are found"""
    return """I don't have specific information about that in your knowledge base yet. 

📚 **To get helpful answers**, please upload relevant documents in the Knowledge Base tab.

💡 **Once you've uploaded documents**, you can ask me about:
- Platform features and capabilities
- Specific tools and functionalities  
- Product information and specifications
- Platform comparisons and differences

What would you like to know about? 🚀"""

def generate_template_response(query: str, relevant_info: List[str], chat_history: List = None) -> str:
    """Fallback template-based response generation"""
    if not relevant_info:
        return get_no_documents_response()
    
    # Just use the general response for all fallback cases
    return generate_general_response(relevant_info, query)

def generate_risk_management_response(relevant_info: List[str], query: str) -> str:
    """Generate structured response about risk management"""
    return format_retrieved_information(relevant_info, "Risk Management Information")

def generate_strategy_response(relevant_info: List[str], query: str) -> str:
    """Generate structured response about trading strategies"""
    return format_retrieved_information(relevant_info, "Strategy Information")

def generate_technical_response(relevant_info: List[str], query: str) -> str:
    """Generate structured response about technical analysis"""
    return format_retrieved_information(relevant_info, "Technical Information")

def generate_market_response(relevant_info: List[str], query: str) -> str:
    """Generate structured response about market analysis"""
    return format_retrieved_information(relevant_info, "Market Information")

def generate_general_response(relevant_info: List[str], query: str) -> str:
    """Generate structured response for general queries"""
    return format_retrieved_information(relevant_info, "Information")

def format_retrieved_information(relevant_info: List[str], title: str) -> str:
    """Format retrieved information from documents"""
    if not relevant_info:
        return "I don't have specific information about that in your knowledge base. Please make sure you've uploaded relevant documents."
    
    response = f"**{title}**\n\n"
    response += "Based on your uploaded documents:\n\n"
    
    # Extract meaningful content from retrieved documents
    for i, content in enumerate(relevant_info[:5], 1):  # Use all 5 documents for complete info
        # Clean up the content
        content_clean = content.strip()
        if content_clean and len(content_clean) > 20:
            response += f"{i}. {content_clean}\n\n"
    
    return response.strip()

def categorize_query(query: str) -> str:
    """Categorize query for analytics"""
    query_lower = query.lower()
    
    if any(term in query_lower for term in ["platform", "deriv", "smarttrader", "dtrader", "dbot"]):
        return "Platform"
    elif any(term in query_lower for term in ["feature", "tool", "function", "capability"]):
        return "Features"
    elif any(term in query_lower for term in ["product", "instrument", "market", "asset"]):
        return "Products"
    elif any(term in query_lower for term in ["comparison", "difference", "versus", "vs"]):
        return "Comparisons"
    elif any(term in query_lower for term in ["how to", "tutorial", "guide", "instruction"]):
        return "How-to"
    else:
        return "General"

def is_clearly_irrelevant(query: str) -> bool:
    """Check if a query is clearly irrelevant to trading/finance (more permissive)"""
    query_lower = query.lower().strip()
    
    # Only reject clearly non-trading topics
    irrelevant_topics = [
        # Entertainment
        'movie', 'movies', 'film', 'tv show', 'series', 'netflix', 'youtube', 'music', 'song',
        'game', 'gaming', 'video game', 'anime', 'manga', 'book', 'novel',
        
        # Unrelated fields
        'cooking', 'recipe', 'food', 'restaurant', 'weather', 'sports', 'football', 'basketball',
        'medicine', 'health', 'doctor', 'hospital', 'car', 'travel', 'vacation', 'hotel',
        
        # Personal questions unrelated to trading
        'birthday', 'age', 'family', 'relationship', 'dating', 'marriage',
        
        # Technology unrelated to trading
        'social media', 'facebook', 'instagram', 'twitter', 'dating app',
        
        # Clearly off-topic comparisons
        'naruto', 'pokemon', 'superman', 'batman', 'celebrity'
    ]
    
    # Only reject if the query contains clearly irrelevant terms
    for topic in irrelevant_topics:
        if topic in query_lower:
            return True
    
    # Default to allowing the query - let the documents determine relevance
    return False

# Admin Endpoints

@app.delete("/api/chat/{chat_id}/clear")
async def clear_chat_memory(chat_id: str, admin_auth: bool = Depends(verify_admin_password)):
    """Clear conversation memory for a specific chat"""
    if chat_id in conversation_memory:
        del conversation_memory[chat_id]
        add_log("INFO", f"Cleared conversation memory for chat {chat_id}")
        return {"message": f"Conversation memory cleared for chat {chat_id}"}
    else:
        return {"message": f"No conversation found for chat {chat_id}"}

@app.get("/api/system-status", response_model=SystemStatus)
async def get_system_status(admin_auth: bool = Depends(verify_admin_password)):
    """Get system status and statistics"""
    uptime = (datetime.now() - system_stats["uptime_start"]).total_seconds() / 3600
    
    # Calculate average response time
    if system_stats["query_history"]:
        avg_response_time = sum(q["response_time"] for q in system_stats["query_history"]) / len(system_stats["query_history"])
    else:
        avg_response_time = 0.0
    
    return SystemStatus(
        total_queries=system_stats["total_queries"],
        unique_users=len(system_stats["unique_users"]),
        documents_indexed=system_stats["documents_processed"],
        average_response_time=round(avg_response_time, 2),
        uptime_hours=round(uptime, 2),
        retriever_loaded=retriever is not None,
        processing_status=system_stats["processing_status"],
        api_base_url=API_BASE_URL,
        model_name=OPENAI_MODEL_NAME,
        embedding_model=EMBEDDING_MODEL
    )

@app.get("/api/logs")
async def get_logs(limit: int = 100, level: Optional[str] = None, search: Optional[str] = None, admin_auth: bool = Depends(verify_admin_password)):
    """Get system logs with optional filtering"""
    try:
        filtered_logs = system_logs.copy()
        
        # Filter by level
        if level and level.lower() != "all":
            filtered_logs = [log for log in filtered_logs if log["level"].lower() == level.lower()]
        
        # Filter by search term
        if search:
            search_lower = search.lower()
            filtered_logs = [
                log for log in filtered_logs 
                if (search_lower in log["message"].lower() or 
                    (log.get("user") and search_lower in log["user"].lower()) or
                    (log.get("query") and search_lower in log["query"].lower()))
            ]
        
        # Sort by timestamp (newest first) and limit
        filtered_logs = sorted(filtered_logs, key=lambda x: x["timestamp"], reverse=True)[:limit]
        
        # Convert datetime to string for JSON serialization (create new objects)
        serialized_logs = []
        for log in filtered_logs:
            serialized_log = {
                "id": log.get("id", 0),
                "timestamp": log["timestamp"].isoformat() if isinstance(log["timestamp"], datetime) else str(log["timestamp"]),
                "level": log.get("level", "INFO"),
                "message": log.get("message", ""),
                "user": log.get("user"),
                "query": log.get("query"),
                "response_time": log.get("response_time")
            }
            serialized_logs.append(serialized_log)
        
        return {"logs": serialized_logs, "total": len(serialized_logs)}
        
    except Exception as e:
        logger.error(f"Error retrieving logs: {str(e)}")
        add_log("ERROR", f"Failed to retrieve logs: {str(e)}")
        # Return empty logs instead of failing
        return {"logs": [], "total": 0, "error": "Failed to retrieve logs"}

@app.get("/api/analytics")
async def get_analytics(admin_auth: bool = Depends(verify_admin_password)):
    """Get usage analytics"""
    # Query categories analytics
    total_queries = sum(query_analytics.values()) or 1
    category_stats = [
        {
            "category": category,
            "count": count,
            "percentage": round((count / total_queries) * 100, 1)
        }
        for category, count in sorted(query_analytics.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Recent activity (last 10 queries)
    recent_activity = []
    for query_data in system_stats["query_history"][-10:]:
        recent_activity.append({
            "user": query_data["user"],
            "query": query_data["query"],
            "timestamp": query_data["timestamp"].isoformat(),
            "response_time": f"{query_data['response_time']:.1f}s"
        })
    
    return {
        "query_categories": category_stats,
        "recent_activity": list(reversed(recent_activity)),  # Most recent first
        "total_queries": system_stats["total_queries"],
        "error_rate": round((system_stats["error_count"] / max(system_stats["total_queries"], 1)) * 100, 2),
        "api_config": {
            "base_url": API_BASE_URL,
            "model": OPENAI_MODEL_NAME,
            "embedding_model": EMBEDDING_MODEL
        }
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    add_log("ERROR", f"Internal server error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    # Create necessary directories
    Path("uploads").mkdir(exist_ok=True)
    
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 