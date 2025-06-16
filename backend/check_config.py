#!/usr/bin/env python3
"""
Configuration checker for RAG Trading Knowledge Management
Run this to verify your API configuration is correct
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_config():
    print("🔍 RAG Trading Knowledge Management - Configuration Check")
    print("=" * 60)
    
    # Check API configuration
    api_key = os.getenv("OPENAI_API_KEY")
    api_base = os.getenv("API_BASE_URL", "https://api.openai.com/v1")
    model_name = os.getenv("OPENAI_MODEL_NAME", "gpt-3.5-turbo")
    embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    
    print(f"📡 API Base URL: {api_base}")
    print(f"🤖 Chat Model: {model_name}")
    print(f"🔤 Embedding Model: {embedding_model}")
    print(f"🔑 API Key: {'✅ Set' if api_key else '❌ Missing'}")
    
    if api_key:
        print(f"    Key starts with: {api_key[:10]}...")
    
    print("\n" + "=" * 60)
    
    # Check if using LiteLLM or OpenAI
    if "litellm.deriv.ai" in api_base:
        print("⚠️  WARNING: Using LiteLLM endpoint")
        print("   This may be blocked by Cloudflare!")
        print("   Consider switching to: https://api.openai.com/v1")
    elif "api.openai.com" in api_base:
        print("✅ Using standard OpenAI API endpoint")
    else:
        print(f"❓ Using custom endpoint: {api_base}")
    
    print("\n🔧 To fix Cloudflare blocking issue:")
    print("1. Go to your Render service dashboard")
    print("2. Click 'Environment' tab")
    print("3. Update these variables:")
    print("   API_BASE_URL=https://api.openai.com/v1")
    print("   OPENAI_MODEL_NAME=gpt-4o-mini")
    print("   EMBEDDING_MODEL=text-embedding-3-small")
    print("4. Click 'Save and Deploy'")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    check_config() 