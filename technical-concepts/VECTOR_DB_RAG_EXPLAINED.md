# Vector Database & RAG Explained - Retrieval Augmented Generation

## TL;DR

**Vector Database** = Database that stores data as numerical vectors (embeddings) for semantic similarity search

**RAG** = Retrieval Augmented Generation - Give LLM relevant context from your data before it answers

**Think of it like:**
- Traditional search = Find documents with exact keyword matches
- Vector DB = Find documents with similar *meaning* (even if words differ)
- RAG = Open-book exam (LLM has access to notes) vs closed-book exam (LLM only knows training data)

---

## What Problem Does RAG Solve?

### Without RAG (LLM Alone)

```python
# Ask LLM to classify root cause
prompt = """
You are a manufacturing expert. Classify the root cause of this incident:
- Tool: Litho-3 is DOWN
- Lot ABC-123 queued at Lithography step
- 15 lots waiting

What's the root cause?
"""

response = llm.invoke(prompt)
# "The root cause is likely TOOL_DOWNTIME due to equipment failure..."
```

**Problems:**
- ❌ LLM has never seen your factory's data
- ❌ No knowledge of past similar incidents
- ❌ Generic answer, not specific to your context
- ❌ Can't cite specific historical examples
- ❌ Might hallucinate (make up plausible-sounding but wrong answers)

---

### With RAG (LLM + Your Historical Data)

```python
# Step 1: Retrieve similar past incidents from Vector DB
query = "Tool Litho-3 DOWN, 15 lots queued at Lithography"
similar_incidents = vector_db.search(query, top_k=5)

# Similar incidents found:
# 1. "Litho-3 DOWN for 4 hours, vacuum leak, 12 lots delayed" → TOOL_DOWNTIME
# 2. "Litho-2 DOWN, electrical issue, 20 lots queued" → TOOL_DOWNTIME
# 3. "Etch-5 DOWN, chamber contamination, 8 lots held" → TOOL_DOWNTIME
# 4. "Litho-3 PM overrun by 2 hours, 10 lots queued" → TOOL_DOWNTIME
# 5. "Photo step queue time 6 hours, no downtime" → CAPACITY_CONSTRAINT

# Step 2: Give these examples to LLM
prompt = f"""
You are a manufacturing expert. Here are 5 similar past incidents:

{similar_incidents}

Now classify this NEW incident:
- Tool: Litho-3 is DOWN
- Lot ABC-123 queued at Lithography step
- 15 lots waiting

What's the root cause?
"""

response = llm.invoke(prompt)
# "Based on incidents #1, #2, and #4, this is TOOL_DOWNTIME. 
#  Historical pattern: Litho-3 downtimes average 3.5 hours. 
#  Recommend: Create CMMS ticket, alert maintenance."
```

**Benefits:**
- ✅ LLM sees 5 relevant examples from YOUR factory
- ✅ Specific, context-aware answer
- ✅ Can cite historical incidents
- ✅ Less hallucination (grounded in real data)
- ✅ Learns from your past patterns

---

## Core Concepts

### 1. **Embeddings** (Vector Representation of Text)

An **embedding** = list of numbers that represents the meaning of text

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Convert text to vector (384 numbers)
text1 = "Tool Litho-3 is down"
embedding1 = model.encode(text1)
# [0.23, -0.45, 0.67, ..., 0.12]  (384 numbers)

text2 = "Equipment Lithography-3 failed"
embedding2 = model.encode(text2)
# [0.21, -0.43, 0.69, ..., 0.15]  (384 numbers)

text3 = "Customer ordered pizza"
embedding3 = model.encode(text3)
# [0.87, 0.02, -0.34, ..., -0.56]  (384 numbers)

# Similar meaning → similar numbers
# text1 and text2 are close in vector space
# text3 is far away
```

**Key Point:** Similar meanings have similar embeddings, even if words differ!

---

### 2. **Vector Database** (Stores and Searches Embeddings)

A **Vector DB** stores embeddings and finds similar ones fast.

```python
from pinecone import Pinecone

# Create vector database
pc = Pinecone(api_key="your-key")
index = pc.Index("manufacturing-incidents")

# Insert historical incidents (with embeddings)
index.upsert([
    {
        "id": "incident_001",
        "values": embedding1,  # 384 numbers
        "metadata": {
            "description": "Tool Litho-3 DOWN, vacuum leak, 12 lots delayed",
            "root_cause": "TOOL_DOWNTIME",
            "tool_group": "Lithography",
            "timestamp": "2024-03-15T14:30:00Z"
        }
    },
    {
        "id": "incident_002",
        "values": embedding2,
        "metadata": {
            "description": "Litho-2 DOWN, electrical issue, 20 lots queued",
            "root_cause": "TOOL_DOWNTIME",
            "tool_group": "Lithography",
            "timestamp": "2024-04-10T09:15:00Z"
        }
    }
])

# Search for similar incidents
query_text = "Litho-3 is down, 15 lots waiting"
query_embedding = model.encode(query_text)

results = index.query(
    vector=query_embedding,
    top_k=5,
    include_metadata=True
)

# Returns: Top 5 most similar incidents
for match in results['matches']:
    print(f"Similarity: {match['score']}")
    print(f"Description: {match['metadata']['description']}")
    print(f"Root Cause: {match['metadata']['root_cause']}")
```

**Key Point:** Vector DB finds similar incidents in milliseconds, even with millions of records!

---

### 3. **RAG Workflow** (Retrieval + Generation)

```
USER QUERY
    ↓
1. Convert query to embedding
    ↓
2. Search Vector DB for similar documents
    ↓
3. Retrieve top K results (e.g., K=5)
    ↓
4. Build prompt with retrieved context
    ↓
5. Send prompt to LLM
    ↓
6. LLM generates answer using context
    ↓
RESPONSE (with citations!)
```

**Example:**
```python
def rag_classify_root_cause(incident_description):
    # Step 1: Convert query to embedding
    query_embedding = embedding_model.encode(incident_description)
    
    # Step 2: Retrieve similar incidents
    similar_incidents = vector_db.search(
        query_embedding,
        top_k=5,
        filter={"tool_group": "Lithography"}  # Optional filter
    )
    
    # Step 3: Build context
    context = "\n\n".join([
        f"Past Incident {i+1}:\n"
        f"Description: {inc['metadata']['description']}\n"
        f"Root Cause: {inc['metadata']['root_cause']}\n"
        f"Resolution: {inc['metadata']['resolution']}"
        for i, inc in enumerate(similar_incidents)
    ])
    
    # Step 4: Create prompt with context
    prompt = f"""
    You are a root cause classifier.
    
    Here are 5 similar past incidents:
    {context}
    
    Now classify this NEW incident:
    {incident_description}
    
    Output: root cause category, confidence (0-1), evidence
    """
    
    # Step 5: LLM generates answer
    response = llm.invoke(prompt)
    
    return response
```

---

### 4. **Hybrid Retrieval** (Dense + Sparse)

**Problem:** Sometimes you need exact keyword matches (sparse) AND semantic similarity (dense)

**Dense Retrieval (Vector Search):**
- Query: "Tool is broken"
- Finds: "Equipment failed", "Machine down" (similar meaning)

**Sparse Retrieval (Keyword Search - BM25):**
- Query: "Litho-3"
- Finds: Exact matches of "Litho-3" (not "Lithography-3" or "Photo-2")

**Hybrid = Best of Both:**
```python
# Hybrid search
results = vector_db.search(
    query="Litho-3 DOWN",
    top_k=10,
    hybrid={
        "alpha": 0.7  # 70% vector, 30% keyword
    }
)

# Finds:
# 1. "Litho-3 DOWN" (exact match, high score)
# 2. "Lithography-3 failed" (semantic + keyword)
# 3. "Equipment Litho-3 issue" (semantic + keyword)
# 4. "Etch tool DOWN" (semantic only, lower score)
```

**Why Hybrid:** Catches both exact tool names AND similar concepts!

---

## Vector DB in Your Design

### 1. **Incident Database Schema**

```python
# Historical incident stored in Vector DB
{
    "id": "incident_20240315_001",
    "embedding": [0.23, -0.45, ..., 0.12],  # 384 or 768 dimensions
    "metadata": {
        "description": "Tool Litho-3 DOWN for 4 hours, vacuum leak detected",
        "root_cause": "TOOL_DOWNTIME",
        "root_cause_detail": "Vacuum pump failure",
        "tool_group": "Lithography",
        "tool_id": "Litho-3",
        "product_family": "DRAM-DDR5",
        "week_bucket": "W1",
        "lots_impacted": 12,
        "downtime_hours": 4.2,
        "resolution": "Replaced vacuum pump O-ring, restarted chamber",
        "resolution_time_hours": 1.5,
        "timestamp": "2024-03-15T14:30:00Z",
        "created_by": "maintenance_team"
    }
}
```

---

### 2. **Cause Classifier with RAG**

```python
from langchain.vectorstores import Pinecone
from langchain.embeddings import OpenAIEmbeddings
from langchain.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA

# Setup
embeddings = OpenAIEmbeddings()
vector_store = Pinecone.from_existing_index("incidents", embeddings)

llm = ChatOpenAI(model="gpt-4", temperature=0.1)

# Create RAG chain
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",  # "stuff" = put all docs in prompt
    retriever=vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 5}  # Top 5 results
    )
)

# Use in Cause Classifier Agent
def classify_root_cause(incident):
    query = f"""
    Tool: {incident['tool_id']} is {incident['status']}
    WIP: {incident['lots_waiting']} lots queued at {incident['current_step']}
    Duration: {incident['duration_mins']} minutes
    """
    
    result = qa_chain.invoke({"query": query})
    
    return result
```

---

### 3. **Filtered Retrieval** (Metadata Filters)

```python
# Only retrieve incidents for same tool group and week bucket
results = vector_store.similarity_search(
    query="Litho-3 DOWN, 15 lots queued",
    k=5,
    filter={
        "tool_group": {"$eq": "Lithography"},
        "week_bucket": {"$eq": "W1"}
    }
)

# Only returns incidents from Lithography tools in W1
# More relevant than mixing W4 planning issues
```

**Why Filter:** W1 equipment issues are different from W4 supply shortages!

---

### 4. **Chunking Strategy**

**Problem:** Incident reports can be long (1000+ words). Embeddings work best on ~200-500 words.

**Solution:** Split into chunks

```python
# Long incident report
incident_text = """
2024-03-15 14:30 - Tool Litho-3 alarm: Vacuum pressure low
2024-03-15 14:35 - Operator reports chamber won't pump down
2024-03-15 14:40 - Maintenance dispatched
2024-03-15 15:00 - Vacuum pump O-ring found cracked
2024-03-15 15:30 - O-ring replaced, system restarted
2024-03-15 16:00 - Tool qualified, back in production
Root Cause: Vacuum pump O-ring failure (wear and tear)
Impact: 12 lots delayed, 4.2 hours downtime
Resolution: Replaced O-ring, added to PM schedule
"""

# Chunk into smaller pieces
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=50
)

chunks = splitter.split_text(incident_text)

# Chunk 1: Alarm details + dispatch
# Chunk 2: Root cause + impact + resolution

# Embed each chunk separately
for i, chunk in enumerate(chunks):
    embedding = embed_model.encode(chunk)
    vector_db.upsert({
        "id": f"incident_20240315_chunk_{i}",
        "values": embedding,
        "metadata": {
            "parent_id": "incident_20240315",
            "chunk_index": i,
            "text": chunk
        }
    })
```

**Why Chunk:** Better retrieval accuracy, especially for long documents.

---

## Common RAG Patterns

### Pattern 1: Simple RAG (Retrieve → Generate)

```python
# Retrieve
docs = vector_db.search(query, top_k=5)

# Generate
prompt = f"Context: {docs}\n\nQuestion: {query}"
answer = llm.invoke(prompt)
```

---

### Pattern 2: RAG with Re-Ranking

```python
# Step 1: Retrieve more candidates (e.g., 20)
candidates = vector_db.search(query, top_k=20)

# Step 2: Re-rank with cross-encoder (more accurate, slower)
from sentence_transformers import CrossEncoder

reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
scores = reranker.predict([(query, doc) for doc in candidates])

# Step 3: Take top 5 after re-ranking
top_docs = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)[:5]

# Step 4: Generate
answer = llm.invoke(f"Context: {top_docs}\n\nQuestion: {query}")
```

**Why:** Initial vector search is fast but approximate. Re-ranking improves accuracy.

---

### Pattern 3: RAG with Self-Query (LLM generates filter)

```python
# User query: "Show me Litho tool downtimes in March"

# Step 1: LLM extracts filter
filter_prompt = f"""
Extract search filters from this query: "{query}"
Output JSON: {{"tool_group": "...", "month": "..."}}
"""

filters = llm.invoke(filter_prompt)
# {"tool_group": "Lithography", "month": "2024-03"}

# Step 2: Search with filters
results = vector_db.search(
    query="tool downtime",
    filter=filters
)
```

**Why:** Lets users query with natural language, system extracts structured filters.

---

## Interview Talking Points

### Q: "What is RAG and why do you use it?"

**A:** "RAG is Retrieval Augmented Generation—it gives the LLM relevant context from my historical incident data before it classifies. Without RAG, the LLM only knows generic manufacturing concepts from training. With RAG, I retrieve the top 5 similar past incidents from a vector database, pass them to the LLM, and it classifies based on actual patterns from my factory. This reduces hallucination and makes the classification context-aware. For example, if Litho-3 has a history of vacuum leaks, RAG surfaces that pattern."

---

### Q: "What's a vector database?"

**A:** "A vector database stores data as numerical embeddings—lists of numbers that represent semantic meaning. When I insert an incident like 'Tool Litho-3 DOWN, vacuum leak,' an embedding model converts it to a 384-dimensional vector. Later, when I query 'Equipment Lithography-3 failed,' the vector DB finds incidents with similar embeddings, even though the words differ. It's semantic search, not keyword search. For the MVP, I'd use a managed vector database like Pinecone or Weaviate since they're production-ready. I'd also evaluate specialized document retrieval solutions like PageIndex if we need lighter weight or the incident data is document-heavy rather than structured."

---

### Q: "What's the difference between dense and sparse retrieval?"

**A:** "Dense retrieval uses vector embeddings for semantic similarity—it finds 'tool DOWN' when you search 'equipment failed.' Sparse retrieval uses keyword matching like BM25—it finds exact matches of 'Litho-3.' Hybrid combines both: 70% vector for semantic similarity, 30% keywords for exact tool names. This is important because I need both—semantic understanding for concepts like 'downtime' and exact matching for tool IDs like 'Litho-3' versus 'Etch-5.'"

---

### Q: "How do you prevent RAG from retrieving irrelevant documents?"

**A:** "I use metadata filters. When classifying a W1 Lithography issue, I filter by tool_group='Lithography' and week_bucket='W1' so I only get relevant incidents. I also use hybrid search with exact tool ID matching. If retrieval quality is poor, I can re-rank the top 20 candidates with a cross-encoder to get the best 5. And I track retrieval metrics—if the LLM says 'retrieved docs aren't helpful,' that's a signal to tune my embedding model or filters."

---

### Q: "What if the vector DB goes down?"

**A:** "The Cause Classifier falls back to LLM-only mode without RAG—it still works but with less context. I show a 'LIMITED CONTEXT' banner so planners know the classification is based on generic knowledge, not historical patterns. For high-severity risks, I escalate to human review. The system doesn't stop, but it operates in degraded mode. Since I use a managed vector DB, downtime is rare, and I can fail over to a read replica."

---

### Q: "How do you measure RAG quality?"

**A:** "I track three metrics: retrieval relevance (are the top 5 incidents actually similar?), LLM answer quality (does the classification match human judgment?), and citation accuracy (do the retrieved incidents support the answer?). For retrieval, I use human annotators to label 'relevant' vs 'not relevant' for a sample. For answer quality, I use LLM-as-judge or A/B testing with planners. I iterate on embedding models and chunk sizes to improve both."

---

## Vector Database Options

| Database | Type | Pros | Cons |
|----------|------|------|------|
| **Pinecone** | Managed | Easy setup, fast, scales | Vendor lock-in, cost |
| **Weaviate** | Open-source / Managed | Flexible, hybrid search | More complex setup |
| **Chroma** | Open-source | Simple, local dev | Not for production scale |
| **Qdrant** | Open-source / Managed | Fast, Rust-based | Smaller ecosystem |
| **pgvector** | PostgreSQL extension | Use existing DB | Slower at scale |
| **Milvus** | Open-source | Very fast, scalable | Complex deployment |
| **PageIndex** | Specialized | Lightweight, document-focused | Newer, smaller ecosystem |

**Your Design:** Managed vector database (Pinecone or Weaviate) for MVP speed. Can self-host Milvus later if needed.

**Alternative Consideration:** Specialized document retrieval solutions like PageIndex could be evaluated if incident data is document-heavy (PDFs, reports) rather than structured records.

---

## Embedding Models

| Model | Dimensions | Speed | Quality | Use Case |
|-------|-----------|-------|---------|----------|
| **all-MiniLM-L6-v2** | 384 | Very Fast | Good | Production (balanced) |
| **all-mpnet-base-v2** | 768 | Fast | Better | Higher accuracy needed |
| **text-embedding-3-large** (OpenAI) | 3072 | Slow | Best | Top accuracy, cost OK |
| **voyage-2** (Voyage AI) | 1024 | Fast | Excellent | Manufacturing domain |

**Your Design:** Start with `all-MiniLM-L6-v2` (384-dim) for speed, evaluate `all-mpnet-base-v2` (768-dim) if accuracy isn't good enough.

---

## Code Example: Full RAG Pipeline

```python
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from langchain.chat_models import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

# ===== SETUP =====
embed_model = SentenceTransformer('all-MiniLM-L6-v2')
pc = Pinecone(api_key="your-key")
index = pc.Index("manufacturing-incidents")
llm = ChatOpenAI(model="gpt-4", temperature=0.1)

# ===== PYDANTIC OUTPUT =====
class RootCauseAnalysis(BaseModel):
    root_cause: str = Field(description="Root cause category")
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(description="Supporting evidence from retrieved docs")
    recommendation: str

parser = PydanticOutputParser(pydantic_object=RootCauseAnalysis)

# ===== RAG FUNCTION =====
def classify_with_rag(incident_description, tool_group, week_bucket):
    # Step 1: Embed query
    query_embedding = embed_model.encode(incident_description).tolist()
    
    # Step 2: Retrieve similar incidents
    results = index.query(
        vector=query_embedding,
        top_k=5,
        filter={
            "tool_group": {"$eq": tool_group},
            "week_bucket": {"$eq": week_bucket}
        },
        include_metadata=True
    )
    
    # Step 3: Build context
    context = "\n\n".join([
        f"Past Incident {i+1} (Similarity: {match['score']:.2f}):\n"
        f"Description: {match['metadata']['description']}\n"
        f"Root Cause: {match['metadata']['root_cause']}\n"
        f"Resolution: {match['metadata']['resolution']}\n"
        f"Downtime: {match['metadata']['downtime_hours']} hours"
        for i, match in enumerate(results['matches'])
    ])
    
    # Step 4: Create prompt
    prompt = f"""
    You are a root cause classifier for semiconductor manufacturing.
    
    Here are 5 similar past incidents from the same tool group and week horizon:
    
    {context}
    
    Now classify this NEW incident:
    {incident_description}
    
    {parser.get_format_instructions()}
    """
    
    # Step 5: LLM generates structured output
    response = llm.invoke(prompt)
    result = parser.parse(response)
    
    # Step 6: Add citations
    result.citations = [
        f"incident_{match['id']}" for match in results['matches']
    ]
    
    return result

# ===== USAGE =====
incident = """
Tool: Litho-3 is DOWN
Status: Vacuum pressure alarm
WIP: 15 lots queued at Lithography step
Duration: 45 minutes so far
"""

classification = classify_with_rag(
    incident_description=incident,
    tool_group="Lithography",
    week_bucket="W1"
)

print(f"Root Cause: {classification.root_cause}")
print(f"Confidence: {classification.confidence}")
print(f"Evidence: {classification.evidence}")
print(f"Recommendation: {classification.recommendation}")
print(f"Citations: {classification.citations}")
```

---

## Summary

**Vector Database** = Stores embeddings for semantic similarity search  
**RAG** = Retrieval Augmented Generation (LLM + your historical data)  
**Hybrid Retrieval** = Combine vector search (semantic) + keyword search (exact matches)

**Key Benefits:**
- ✅ LLM sees YOUR factory's historical incidents
- ✅ Context-aware classification (not generic)
- ✅ Reduced hallucination (grounded in real data)
- ✅ Can cite specific past examples
- ✅ Learns from your patterns over time

**In Your Design:**
- Managed vector database (Pinecone or Weaviate)
- Hybrid retrieval (70% dense vector + 30% BM25 keywords)
- Filtered by tool_group and week_bucket
- Top 5 similar incidents retrieved
- Passed to Cause Classifier LLM with Pydantic output
- Citations tracked in audit log

**One-liner for interview:**
> "I use RAG to give the Cause Classifier LLM context from historical incidents. When it classifies a new Litho-3 downtime, it sees the top 5 similar past downtimes from a vector database—this makes the classification specific to my factory's patterns instead of generic manufacturing knowledge."

You're ready! 🚀
