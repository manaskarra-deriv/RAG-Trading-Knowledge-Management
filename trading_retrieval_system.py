"""
Production-Ready Trading Knowledge Retrieval System

A robust document retrieval system for trading knowledge base using hybrid search
combining FAISS (semantic similarity) and BM25 (keyword matching).

Features:
- Production-grade error handling and logging
- Configurable parameters
- Performance monitoring
- Thread-safe operations
- Comprehensive validation
- Memory-efficient processing
"""

import os
import pickle
import logging
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib

import numpy as np
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document
from rank_bm25 import BM25Okapi
from pypdf import PdfReader
from tqdm import tqdm
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('retrieval_system.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class RetrievalConfig:
    """Configuration class for the retrieval system"""
    embedding_model: str = "text-embedding-3-small"
    base_url: Optional[str] = None  # For LiteLLM support
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k_retrieval: int = 5
    pdf_folder: str = "TradingKB"
    faiss_index_path: str = "faiss_index"
    bm25_data_path: str = "bm25_data.pkl"
    max_workers: int = 4
    batch_size: int = 10
    similarity_threshold: float = 0.0
    enable_caching: bool = True
    cache_ttl: int = 3600  # 1 hour

@dataclass
class RetrievalResult:
    """Result object for retrieval operations"""
    documents: List[Document]
    scores: List[float]
    retrieval_time: float
    method_used: str
    query_hash: str
    total_candidates: int

class DocumentProcessor:
    """Handles PDF processing and text extraction"""
    
    def __init__(self, config: RetrievalConfig):
        self.config = config
        self.processed_files_cache = {}
    
    def extract_text_from_pdf(self, pdf_path: Path) -> Tuple[str, Dict[str, Any]]:
        """
        Extract text from PDF with metadata
        
        Returns:
            Tuple of (text_content, metadata)
        """
        try:
            reader = PdfReader(str(pdf_path))
            text_parts = []
            metadata = {
                "filename": pdf_path.name,
                "file_size": pdf_path.stat().st_size,
                "num_pages": len(reader.pages),
                "creation_time": pdf_path.stat().st_ctime
            }
            
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text_parts.append(page_text)
            
            full_text = "\n".join(text_parts)
            metadata["text_length"] = len(full_text)
            metadata["word_count"] = len(full_text.split())
            
            return full_text, metadata
            
        except Exception as e:
            logger.error(f"Error extracting text from {pdf_path}: {e}")
            return "", {"error": str(e), "filename": pdf_path.name}
    
    def process_single_pdf(self, pdf_path: Path, text_splitter: RecursiveCharacterTextSplitter) -> List[Document]:
        """Process a single PDF file into document chunks"""
        try:
            text, file_metadata = self.extract_text_from_pdf(pdf_path)
            
            if not text.strip():
                logger.warning(f"No text extracted from {pdf_path.name}")
                return []
            
            # Create file hash for caching
            file_hash = hashlib.md5(text.encode()).hexdigest()
            
            # Split into chunks
            chunks = text_splitter.split_text(text)
            documents = []
            
            for i, chunk in enumerate(chunks):
                if chunk.strip():  # Only add non-empty chunks
                    doc = Document(
                        page_content=chunk,
                        metadata={
                            **file_metadata,
                            "chunk_id": f"{pdf_path.stem}_{i}",
                            "chunk_index": i,
                            "total_chunks": len(chunks),
                            "doc_type": "trading_guide",
                            "file_hash": file_hash
                        }
                    )
                    documents.append(doc)
            
            logger.info(f"Processed {pdf_path.name}: {len(documents)} chunks")
            return documents
            
        except Exception as e:
            logger.error(f"Error processing {pdf_path}: {e}")
            return []

class TradingKnowledgeRetriever:
    """
    Production-ready retrieval system for trading knowledge base
    """
    
    def __init__(self, config: Optional[RetrievalConfig] = None):
        self.config = config or RetrievalConfig()
        self.embeddings = None
        self.vector_store = None
        self.bm25 = None
        self.documents = []
        self.doc_processor = DocumentProcessor(self.config)
        self.query_cache = {} if self.config.enable_caching else None
        self._initialize_embeddings()
    
    def _initialize_embeddings(self):
        """Initialize OpenAI embeddings with error handling and fallback support"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            
            # Prepare OpenAI embeddings kwargs
            embedding_kwargs = {
                "model": self.config.embedding_model,
                "openai_api_key": api_key
            }
            
            # Add base_url if specified (for LiteLLM support)
            if self.config.base_url:
                embedding_kwargs["openai_api_base"] = self.config.base_url
                logger.info(f"Using custom API base URL: {self.config.base_url}")
            
            self.embeddings = OpenAIEmbeddings(**embedding_kwargs)
            logger.info(f"Initialized embeddings with model: {self.config.embedding_model}")
            
            # Test the embeddings with a simple query
            try:
                test_embedding = self.embeddings.embed_query("test")
                if test_embedding and len(test_embedding) > 0:
                    logger.info("Embeddings API test successful")
                else:
                    raise ValueError("Embeddings API returned empty result")
            except Exception as test_error:
                if "403" in str(test_error) or "Forbidden" in str(test_error):
                    logger.warning(f"API blocked, attempting fallback: {test_error}")
                    # Try fallback to standard OpenAI API
                    fallback_kwargs = {
                        "model": self.config.embedding_model,
                        "openai_api_key": api_key
                        # No base_url for standard OpenAI API
                    }
                    self.embeddings = OpenAIEmbeddings(**fallback_kwargs)
                    logger.info("Successfully initialized embeddings with fallback OpenAI API")
                else:
                    raise test_error
            
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")
            raise
    
    def _validate_pdf_folder(self, pdf_folder: str) -> Path:
        """Validate PDF folder exists and contains PDF files"""
        folder_path = Path(pdf_folder)
        
        if not folder_path.exists():
            raise FileNotFoundError(f"PDF folder not found: {pdf_folder}")
        
        pdf_files = list(folder_path.glob("*.pdf"))
        if not pdf_files:
            raise ValueError(f"No PDF files found in {pdf_folder}")
        
        logger.info(f"Found {len(pdf_files)} PDF files in {pdf_folder}")
        return folder_path
    
    def build_retrieval_system(self, pdf_folder: Optional[str] = None) -> Dict[str, Any]:
        """
        Build the retrieval system from PDF documents
        
        Returns:
            Dictionary with build statistics
        """
        start_time = time.time()
        pdf_folder = pdf_folder or self.config.pdf_folder
        folder_path = self._validate_pdf_folder(pdf_folder)
        
        logger.info("Starting retrieval system build...")
        
        # Load and process documents
        documents = self._load_and_chunk_documents(folder_path)
        
        if not documents:
            raise ValueError("No documents were successfully processed")
        
        self.documents = documents
        
        # Build FAISS index
        faiss_build_time = self._build_faiss_index()
        
        # Build BM25 index
        bm25_build_time = self._build_bm25_index()
        
        # Save indices
        self._save_indices()
        
        build_time = time.time() - start_time
        
        stats = {
            "total_documents": len(documents),
            "total_build_time": build_time,
            "faiss_build_time": faiss_build_time,
            "bm25_build_time": bm25_build_time,
            "pdf_files_processed": len(list(folder_path.glob("*.pdf"))),
            "average_chunk_size": np.mean([len(doc.page_content) for doc in documents]),
            "config": self.config.__dict__
        }
        
        logger.info(f"Retrieval system built successfully in {build_time:.2f}s")
        logger.info(f"Build stats: {stats}")
        
        return stats
    
    def _load_and_chunk_documents(self, folder_path: Path) -> List[Document]:
        """Load and chunk documents with parallel processing"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        pdf_files = list(folder_path.glob("*.pdf"))
        all_documents = []
        
        logger.info(f"Processing {len(pdf_files)} PDF files...")
        
        # Process files in parallel
        with ThreadPoolExecutor(max_workers=self.config.max_workers) as executor:
            future_to_file = {
                executor.submit(self.doc_processor.process_single_pdf, pdf_file, text_splitter): pdf_file
                for pdf_file in pdf_files
            }
            
            for future in tqdm(as_completed(future_to_file), total=len(pdf_files), desc="Processing PDFs"):
                pdf_file = future_to_file[future]
                try:
                    documents = future.result()
                    all_documents.extend(documents)
                except Exception as e:
                    logger.error(f"Failed to process {pdf_file}: {e}")
        
        logger.info(f"Created {len(all_documents)} document chunks")
        return all_documents
    
    def _build_faiss_index(self) -> float:
        """Build FAISS vector store"""
        start_time = time.time()
        logger.info("Building FAISS vector store...")
        
        try:
            self.vector_store = FAISS.from_documents(self.documents, self.embeddings)
            build_time = time.time() - start_time
            logger.info(f"FAISS index built in {build_time:.2f}s")
            return build_time
            
        except Exception as e:
            logger.error(f"Failed to build FAISS index: {e}")
            raise
    
    def _build_bm25_index(self) -> float:
        """Build BM25 index"""
        start_time = time.time()
        logger.info("Building BM25 index...")
        
        try:
            tokenized_corpus = [doc.page_content.split() for doc in self.documents]
            self.bm25 = BM25Okapi(tokenized_corpus)
            build_time = time.time() - start_time
            logger.info(f"BM25 index built in {build_time:.2f}s")
            return build_time
            
        except Exception as e:
            logger.error(f"Failed to build BM25 index: {e}")
            raise
    
    def _save_indices(self):
        """Save indices to disk"""
        try:
            # Save FAISS index
            self.vector_store.save_local(self.config.faiss_index_path)
            logger.info(f"FAISS index saved to {self.config.faiss_index_path}")
            
            # Save BM25 and documents
            with open(self.config.bm25_data_path, "wb") as f:
                pickle.dump({
                    "bm25": self.bm25,
                    "documents": self.documents,
                    "config": self.config.__dict__
                }, f)
            logger.info(f"BM25 data saved to {self.config.bm25_data_path}")
            
        except Exception as e:
            logger.error(f"Failed to save indices: {e}")
            raise
    
    def load_retrieval_system(self) -> bool:
        """Load pre-built retrieval system"""
        try:
            # Check if files exist
            if not Path(self.config.faiss_index_path).exists():
                logger.warning(f"FAISS index not found at {self.config.faiss_index_path}")
                return False
            
            if not Path(self.config.bm25_data_path).exists():
                logger.warning(f"BM25 data not found at {self.config.bm25_data_path}")
                return False
            
            # Load FAISS index
            self.vector_store = FAISS.load_local(
                self.config.faiss_index_path,
                self.embeddings,
                allow_dangerous_deserialization=True
            )
            
            # Load BM25 and documents
            with open(self.config.bm25_data_path, "rb") as f:
                data = pickle.load(f)
                self.bm25 = data["bm25"]
                self.documents = data["documents"]
            
            logger.info("Retrieval system loaded successfully")
            logger.info(f"Loaded {len(self.documents)} documents")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load retrieval system: {e}")
            return False
    
    def retrieve_documents(
        self, 
        query: str, 
        k: Optional[int] = None,
        method: str = "hybrid",
        return_scores: bool = False
    ) -> RetrievalResult:
        """
        Retrieve documents using specified method
        
        Args:
            query: Search query
            k: Number of documents to retrieve
            method: Retrieval method ("hybrid", "faiss", "bm25")
            return_scores: Whether to return similarity scores
            
        Returns:
            RetrievalResult object
        """
        if not self.vector_store or not self.bm25:
            raise ValueError("Retrieval system not loaded. Please build or load the system first.")
        
        k = k or self.config.top_k_retrieval
        start_time = time.time()
        query_hash = hashlib.md5(query.encode()).hexdigest()
        
        # Check cache
        if self.query_cache and query_hash in self.query_cache:
            cached_result = self.query_cache[query_hash]
            if time.time() - cached_result["timestamp"] < self.config.cache_ttl:
                logger.debug(f"Returning cached result for query: {query[:50]}...")
                return cached_result["result"]
        
        try:
            if method == "hybrid":
                documents, scores = self._hybrid_retrieval(query, k, return_scores)
            elif method == "faiss":
                documents, scores = self._faiss_retrieval(query, k, return_scores)
            elif method == "bm25":
                documents, scores = self._bm25_retrieval(query, k, return_scores)
            else:
                raise ValueError(f"Unknown retrieval method: {method}")
            
            retrieval_time = time.time() - start_time
            
            result = RetrievalResult(
                documents=documents,
                scores=scores if return_scores else [],
                retrieval_time=retrieval_time,
                method_used=method,
                query_hash=query_hash,
                total_candidates=len(self.documents)
            )
            
            # Cache result
            if self.query_cache:
                self.query_cache[query_hash] = {
                    "result": result,
                    "timestamp": time.time()
                }
            
            logger.debug(f"Retrieved {len(documents)} documents in {retrieval_time:.3f}s using {method}")
            return result
            
        except Exception as e:
            logger.error(f"Retrieval failed for query '{query}': {e}")
            raise
    
    def _hybrid_retrieval(self, query: str, k: int, return_scores: bool) -> Tuple[List[Document], List[float]]:
        """Hybrid retrieval combining FAISS and BM25"""
        # Get results from both methods
        faiss_docs = self.vector_store.similarity_search_with_score(query, k=k)
        
        tokenized_query = query.split()
        bm25_scores = self.bm25.get_scores(tokenized_query)
        top_bm25_indices = np.argsort(bm25_scores)[-k:][::-1]
        
        # Combine results with deduplication
        combined_docs = []
        combined_scores = []
        seen_content = set()
        
        # Add FAISS results (prioritized for semantic similarity)
        for doc, score in faiss_docs:
            content_hash = hashlib.md5(doc.page_content.encode()).hexdigest()
            if content_hash not in seen_content:
                combined_docs.append(doc)
                combined_scores.append(float(score))
                seen_content.add(content_hash)
        
        # Add BM25 results
        for idx in top_bm25_indices:
            if len(combined_docs) >= k:
                break
            doc = self.documents[idx]
            content_hash = hashlib.md5(doc.page_content.encode()).hexdigest()
            if content_hash not in seen_content:
                combined_docs.append(doc)
                combined_scores.append(float(bm25_scores[idx]))
                seen_content.add(content_hash)
        
        return combined_docs[:k], combined_scores[:k] if return_scores else []
    
    def _faiss_retrieval(self, query: str, k: int, return_scores: bool) -> Tuple[List[Document], List[float]]:
        """FAISS-only retrieval"""
        if return_scores:
            results = self.vector_store.similarity_search_with_score(query, k=k)
            docs, scores = zip(*results) if results else ([], [])
            return list(docs), [float(s) for s in scores]
        else:
            docs = self.vector_store.similarity_search(query, k=k)
            return docs, []
    
    def _bm25_retrieval(self, query: str, k: int, return_scores: bool) -> Tuple[List[Document], List[float]]:
        """BM25-only retrieval"""
        tokenized_query = query.split()
        scores = self.bm25.get_scores(tokenized_query)
        top_indices = np.argsort(scores)[-k:][::-1]
        
        docs = [self.documents[i] for i in top_indices]
        doc_scores = [float(scores[i]) for i in top_indices] if return_scores else []
        
        return docs, doc_scores
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        if not self.documents:
            return {"status": "not_loaded"}
        
        return {
            "status": "loaded",
            "total_documents": len(self.documents),
            "config": self.config.__dict__,
            "cache_size": len(self.query_cache) if self.query_cache else 0,
            "unique_sources": len(set(doc.metadata.get("filename", "") for doc in self.documents)),
            "average_chunk_size": np.mean([len(doc.page_content) for doc in self.documents]),
            "total_text_length": sum(len(doc.page_content) for doc in self.documents)
        }

# Convenience functions for backward compatibility
def build_retrieval_system(config: Optional[RetrievalConfig] = None) -> TradingKnowledgeRetriever:
    """Build and return a retrieval system"""
    retriever = TradingKnowledgeRetriever(config)
    retriever.build_retrieval_system()
    return retriever

def load_retrieval_system(config: Optional[RetrievalConfig] = None) -> Optional[TradingKnowledgeRetriever]:
    """Load and return a pre-built retrieval system"""
    retriever = TradingKnowledgeRetriever(config)
    if retriever.load_retrieval_system():
        return retriever
    return None

# Example usage
if __name__ == "__main__":
    # Configure system
    config = RetrievalConfig(
        chunk_size=1000,
        chunk_overlap=200,
        top_k_retrieval=5,
        max_workers=4
    )
    
    # Initialize retriever
    retriever = TradingKnowledgeRetriever(config)
    
    # Try to load existing system, build if not available
    if not retriever.load_retrieval_system():
        logger.info("Building new retrieval system...")
        stats = retriever.build_retrieval_system()
        logger.info(f"Build completed: {stats}")
    
    # Test retrieval
    test_query = "What is a PIP in forex trading?"
    logger.info(f"Testing retrieval with query: {test_query}")
    
    result = retriever.retrieve_documents(
        query=test_query,
        method="hybrid",
        return_scores=True
    )
    
    logger.info(f"Retrieved {len(result.documents)} documents in {result.retrieval_time:.3f}s")
    for i, doc in enumerate(result.documents):
        logger.info(f"Document {i+1}: {doc.metadata.get('source', 'Unknown')} - Score: {result.scores[i] if result.scores else 'N/A'}")
    
    # Print system stats
    stats = retriever.get_system_stats()
    logger.info(f"System stats: {stats}") 