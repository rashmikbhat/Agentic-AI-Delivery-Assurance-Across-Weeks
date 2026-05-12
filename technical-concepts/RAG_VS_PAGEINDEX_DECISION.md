# RAG vs PageIndex for Cause Classifier - Decision Guide

## TL;DR

**Recommendation: Use RAG with Vector DB for production, mention PageIndex as an alternative in interview**

**Why RAG wins for this use case:**
- Need to search **thousands** of historical manufacturing incidents (not 50 documents)
- Semantic similarity matters ("tool down" = "equipment failure" = "downtime event")
- Hybrid retrieval (vector + keyword) gives best accuracy for incident matching
- Production-proven, auditable retrieval with citation tracking

**When PageIndex would be better:**
- If you had 50-100 detailed incident reports (document-heavy)
- If context was mostly unstructured text (not structured MES records)
- If you wanted a simpler MVP with no infrastructure

---

## What is PageIndex?

**PageIndex** = A "ragless" retrieval approach that uses the LLM's native long context window instead of a vector database.

**How it works:**
1. Load all historical incidents directly into the LLM's context window
2. Ask LLM to find the top 5 most similar incidents
3. LLM uses its native understanding to match patterns

**Example:**
```python
# PageIndex approach (simplified)
incidents_text = """
INCIDENT 1: 2025-01-15, Lot ABC-123, Litho tool down, 8 hours, root cause: laser alignment
INCIDENT 2: 2025-01-18, Lot DEF-456, Etch queue, 12 hours, root cause: recipe issue
INCIDENT 3: 2025-01-20, Lot GHI-789, Litho downtime, 6 hours, root cause: PM overdue
... (100 more incidents)
"""

prompt = f"""
Given these historical incidents:
{incidents_text}

Current incident: Lot XYZ-999, Litho tool down, 10 hours

Find the top 5 most similar past incidents and explain why.
"""

response = llm.invoke(prompt)
```

**Pros:**
- ✅ No vector DB infrastructure needed
- ✅ Simpler setup (just text in prompt)
- ✅ LLM uses native understanding of similarity
- ✅ Good for document-heavy use cases (long reports, PDFs)

**Cons:**
- ❌ Limited by context window size (e.g., 200K tokens = ~500-1000 incidents max)
- ❌ Expensive (every query sends ALL incidents to LLM)
- ❌ Slower (LLM has to "read" thousands of incidents each time)
- ❌ Less precise than semantic vector search
- ❌ Harder to audit (which incidents were considered? Why top 5?)

---

## What is RAG with Vector DB?

**RAG (Retrieval Augmented Generation)** = Pre-compute embeddings for all incidents, store in vector database, retrieve top-K by semantic similarity.

**How it works:**
1. **Offline**: Convert all historical incidents to vector embeddings (one-time)
2. **Online**: Convert current incident to embedding, find nearest neighbors in vector DB
3. **LLM**: Only send the top 5 retrieved incidents (not all 1000+)

**Example:**
```python
# RAG approach

# STEP 1: Offline - Index historical incidents (one-time)
for incident in historical_incidents:
    # Convert incident to text
    text = f"Product: {incident.product}, Tool: {incident.tool}, Symptom: {incident.symptom}, Root Cause: {incident.root_cause}"
    
    # Generate embedding (vector representation)
    embedding = embedding_model.encode(text)
    
    # Store in vector DB
    vector_db.upsert(
        id=incident.id,
        vector=embedding,
        metadata={"text": text, "root_cause": incident.root_cause}
    )

# STEP 2: Online - Query for current incident
current_incident_text = f"Product: NAND, Tool: Litho, Symptom: tool down 10 hours"
current_embedding = embedding_model.encode(current_incident_text)

# Retrieve top 5 similar incidents (fast!)
top_5 = vector_db.query(
    vector=current_embedding,
    top_k=5,
    include_metadata=True
)

# STEP 3: Send only top 5 to LLM (not all 1000+)
prompt = f"""
Current incident: {current_incident_text}

Here are the 5 most similar past incidents:
{top_5[0]['metadata']['text']}
{top_5[1]['metadata']['text']}
{top_5[2]['metadata']['text']}
{top_5[3]['metadata']['text']}
{top_5[4]['metadata']['text']}

Classify the root cause category and recommend action.
"""

response = llm.invoke(prompt)
```

**Pros:**
- ✅ Scales to millions of incidents (not limited by context window)
- ✅ Fast retrieval (<100ms for similarity search)
- ✅ Cheaper (only send top 5 to LLM, not all incidents)
- ✅ Semantic search (finds conceptually similar even if wording differs)
- ✅ Hybrid retrieval (combine vector + keyword matching)
- ✅ Auditable (can log which incidents were retrieved and their similarity scores)

**Cons:**
- ❌ Infrastructure overhead (need vector DB - managed or self-hosted)
- ❌ Requires embedding model (additional dependency)
- ❌ More complex setup

---

## Decision Matrix for Your Use Case

### Your Requirements (Cause Classifier)

| Requirement | RAG | PageIndex |
|-------------|-----|-----------|
| **Scale: Thousands of historical incidents** | ✅ Handles millions | ❌ Limited to ~500-1000 max |
| **Speed: Real-time classification** | ✅ <100ms retrieval | ❌ Slower (sends all to LLM) |
| **Cost: Every 2 hours, multiple lots** | ✅ Cheap (top-5 only) | ❌ Expensive (all incidents) |
| **Semantic similarity: "tool down" = "equipment failure"** | ✅ Vector search excels | ⚠️ LLM can match but less precise |
| **Auditability: Which incidents were considered?** | ✅ Vector DB logs similarity scores | ⚠️ LLM black box |
| **Traceability: Citations for compliance** | ✅ Easy (metadata from vector DB) | ⚠️ Harder (extract from LLM response) |
| **Hybrid retrieval: Keyword + semantic** | ✅ Built-in | ❌ Not available |
| **MVP simplicity** | ⚠️ Needs vector DB setup | ✅ Simpler (no infra) |

---

## When to Use RAG vs PageIndex

### Use RAG When:
- ✅ You have **1000+ historical incidents** (common in manufacturing)
- ✅ Incidents are **semi-structured** (MES records, maintenance logs)
- ✅ You need **semantic similarity** ("Litho tool down" should match "Lithography equipment failure")
- ✅ **Speed matters** (<100ms retrieval for real-time classification)
- ✅ **Cost matters** (sending 1000 incidents to LLM every query = expensive)
- ✅ **Auditability** is critical (compliance, traceability)
- ✅ You're building for **production scale**

### Use PageIndex When:
- ✅ You have **<100 detailed documents** (e.g., incident reports, PDFs)
- ✅ Documents are **long and unstructured** (not database records)
- ✅ You want **simplest possible MVP** (no vector DB infrastructure)
- ✅ **Cost is not a concern** (or query volume is low)
- ✅ Context fits in LLM window (e.g., 200K tokens)

---

## Your Case: Manufacturing Incident Classification

**Context:**
- Manufacturing runs 24/7 → generates **thousands of incidents per year**
- MES logs capture: lot_id, tool_id, downtime_duration, queue_time, root_cause_notes
- Maintenance logs capture: work_orders, parts_replaced, resolution_actions
- Quality logs capture: scrap_reason, yield_loss, defect_type

**Data characteristics:**
- **Semi-structured**: Database records + free-text notes
- **High volume**: 5000+ incidents per year (10+ years of history = 50K+ incidents)
- **Semantic similarity needed**: "Litho tool down" vs "Lithography downtime" vs "Equipment failure at litho"
- **Frequent queries**: Every 2 hours for W1/W2 high-risk lots (could be 5-10 queries per refresh)

**Cost comparison:**

| Approach | Query Cost | Queries/Month | Total Cost |
|----------|-----------|---------------|------------|
| **PageIndex** | Send 50K incidents (~100K tokens) to LLM each query = $0.30 | 10 queries/day × 30 days = 300 | **$90/month** |
| **RAG** | Send top 5 incidents (~200 tokens) to LLM = $0.006 | 10 queries/day × 30 days = 300 | **$1.80/month** |
| **Vector DB cost** | Pinecone free tier: 100K vectors | - | **$0/month (free tier)** |

**RAG saves $88/month** and scales better.

---

## Recommendation for Interview

### What to Say

**Primary answer (production approach):**

> "I'm using **RAG with a managed vector database** like Pinecone or Weaviate for the Cause Classifier. Manufacturing generates thousands of incidents over time—across multiple tool groups, products, and shifts. I need semantic similarity search because 'tool down' and 'equipment failure' should match even though the wording differs.
>
> I use hybrid retrieval—70% dense vector for semantic similarity, 30% BM25 for exact keyword matches. This gives the best accuracy for retrieving the top 5 similar incidents. The vector DB returns results in under 100 milliseconds, and I only send those 5 incidents to the LLM, not all 5000+. That keeps costs low and gives me full traceability—I can log which incidents were retrieved and their similarity scores for audit purposes."

**Alternative mention (shows broader awareness):**

> "I also evaluated **PageIndex** as a ragless alternative since it simplifies infrastructure—you just load incidents directly into the LLM's context window. It would work for an MVP with a few hundred incidents, but it doesn't scale to thousands and costs more per query since you're sending all incidents to the LLM each time. For production, RAG is the right choice."

### Why This Answer Works

1. **Shows production thinking**: Scalability, cost, and performance matter
2. **Technical depth**: Mentions hybrid retrieval (dense vector + BM25)
3. **Acknowledges alternatives**: Shows you researched options, not just defaulting
4. **Ties to case requirements**: Auditability and traceability for compliance
5. **Confident choice**: Clear recommendation with reasoning

---

## Code Comparison

### PageIndex Approach

```python
from anthropic import Anthropic

# Load all incidents (limited by context window)
all_incidents = load_all_incidents()  # Returns 500 incidents max

# Format as text
incidents_text = "\n".join([
    f"ID: {inc.id}, Date: {inc.date}, Product: {inc.product}, Tool: {inc.tool}, "
    f"Symptom: {inc.symptom}, Root Cause: {inc.root_cause}, Resolution: {inc.resolution}"
    for inc in all_incidents[:500]  # Limited to what fits in context
])

# Current incident
current = "Lot XYZ-999, Product: NAND, Tool: Litho, Symptom: tool down 10 hours"

# Query LLM (sends ALL incidents)
prompt = f"""
Historical incidents:
{incidents_text}

Current incident: {current}

Find the top 5 most similar incidents and classify the root cause.
"""

response = client.messages.create(
    model="claude-sonnet-4",
    max_tokens=1000,
    messages=[{"role": "user", "content": prompt}]
)

# Cost: ~100K tokens input = $0.30 per query
```

**Problems:**
- Limited to 500 incidents (context window limit)
- Sends 100K tokens every query ($0.30 each)
- Slower (LLM has to "read" 500 incidents)
- No audit trail (which incidents were considered?)

---

### RAG with Vector DB Approach

```python
from anthropic import Anthropic
import chromadb  # Or Pinecone, Weaviate, etc.

# SETUP (one-time)
client = chromadb.Client()
collection = client.create_collection(
    name="manufacturing_incidents",
    metadata={"hnsw:space": "cosine"}  # Similarity metric
)

# Index all incidents (one-time)
all_incidents = load_all_incidents()  # 5000+ incidents

for inc in all_incidents:
    text = f"Product: {inc.product}, Tool: {inc.tool}, Symptom: {inc.symptom}, Root Cause: {inc.root_cause}"
    
    collection.add(
        ids=[inc.id],
        documents=[text],
        metadatas=[{
            "date": inc.date,
            "product": inc.product,
            "root_cause": inc.root_cause,
            "resolution": inc.resolution
        }]
    )

# QUERY (real-time)
current = "Lot XYZ-999, Product: NAND, Tool: Litho, Symptom: tool down 10 hours"

# Retrieve top 5 similar (fast!)
results = collection.query(
    query_texts=[current],
    n_results=5,
    include=["documents", "metadatas", "distances"]
)

# Format for LLM
top_5_text = "\n\n".join([
    f"INCIDENT {i+1} (similarity: {1-results['distances'][0][i]:.2f}):\n{doc}\nResolution: {meta['resolution']}"
    for i, (doc, meta) in enumerate(zip(results['documents'][0], results['metadatas'][0]))
])

# Query LLM (only top 5)
prompt = f"""
Current incident: {current}

Here are the 5 most similar past incidents:

{top_5_text}

Based on these incidents, classify the root cause category (DOWNTIME, UPH_DEGRADATION, WIP_QUEUE, MATERIAL, QUALITY, OTHER) and recommend action.
"""

response = client.messages.create(
    model="claude-sonnet-4",
    max_tokens=1000,
    messages=[{"role": "user", "content": prompt}]
)

# Cost: ~200 tokens input = $0.006 per query (50× cheaper!)

# AUDIT TRAIL
audit_log = {
    "current_incident": current,
    "retrieved_incidents": [
        {
            "id": results['ids'][0][i],
            "similarity_score": 1 - results['distances'][0][i],
            "text": results['documents'][0][i]
        }
        for i in range(5)
    ],
    "llm_response": response.content[0].text
}
```

**Benefits:**
- Handles 5000+ incidents (scales to millions)
- Only sends top 5 to LLM (~200 tokens = $0.006)
- Fast retrieval (<100ms)
- Full audit trail with similarity scores

---

## Final Recommendation

**For the interview: Say you're using RAG with vector DB**

**Reasoning to give:**
1. **Scale**: Manufacturing generates thousands of incidents—RAG handles this, PageIndex doesn't
2. **Cost**: RAG is 50× cheaper per query ($0.006 vs $0.30)
3. **Speed**: Vector search <100ms vs LLM reading 500 incidents
4. **Semantic search**: "tool down" matches "equipment failure" with high precision
5. **Auditability**: Vector DB logs similarity scores for traceability
6. **Hybrid retrieval**: Dense vector + BM25 keywords = best accuracy

**Optional mention:**
> "I evaluated PageIndex as a simpler alternative, but it doesn't scale to the thousands of incidents we have in manufacturing, and costs more per query. For an MVP with 50-100 detailed reports, PageIndex would be great. But for structured incident data at scale, RAG is the right choice."

**This shows:**
- ✅ You know about cutting-edge alternatives (PageIndex)
- ✅ You made an informed technical decision
- ✅ You optimized for production scale, cost, and auditability
- ✅ You're not just following trends—you evaluated trade-offs

---

## Quick Decision Tree

```
Do you have 1000+ incidents?
├─ YES → RAG
└─ NO (< 100)
   ├─ Are they long documents/reports?
   │  ├─ YES → PageIndex
   │  └─ NO (structured records) → RAG (overkill but fine)
   └─ Is cost/speed critical?
      ├─ YES → RAG
      └─ NO → Either works, PageIndex simpler for MVP
```

**For your case: 1000+ structured manufacturing incidents → RAG**
