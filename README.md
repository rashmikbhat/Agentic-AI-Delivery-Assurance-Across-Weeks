# Agentic AI Delivery Assurance - Interview Preparation

## Overview

This repository contains the design documentation for an **Agentic AI system for manufacturing delivery assurance** across a rolling 4-week horizon (W1-W4). The system uses a hybrid approach combining LLMs for classification with traditional optimization for trade-off decisions.

##  Repository Contents

### Presentation Materials

- **`Agentic_AI_Delivery_Assurance_UPDATED_FINAL.pptx`** - Complete presentation deck
  - Vendor-agnostic language (no specific tool names)
  - Updated cadences: W1/W2 every 2 hours, W3/W4 3x/week
  - Generic ROI metrics (no baseline data assumed)

### Interview Preparation (`interview-prep/`)

- **`PRESENTATION_SCRIPT_Natural_Flow.md`** - Speaking script (12-15 minutes)
  - Natural, conversational flow
  - Vendor-agnostic terminology
  - Focus on business value and ROI

- **`GAP_ANALYSIS_Design_Review.md`** - Interview preparation guide
  - Design coverage vs requirements
  - Potential interview questions
  - Defense strategies for design decisions

- **`PRESENTATION_SCRIPT_Natural_Flow_final.md`** - Final concise script for direct reading
  - Product mix complexity with UPH-weighted capacity
  - ML approach with 5 risk factors
  - Corrected MVP roadmap (Classify → Follow-Up → Auto)

### Technical Concepts Explained (`technical-concepts/`)

Comprehensive guides for understanding the technical stack used in the design:

- **`LANGCHAIN_LANGGRAPH_LANGSMITH_EXPLAINED.md`** - LangChain ecosystem
  - LangChain = LLM application toolkit (tool binding, Pydantic parsers)
  - LangGraph = State machine orchestrator with cyclic workflows
  - LangSmith = Debugging and monitoring platform

- **`KAFKA_EXPLAINED.md`** - Event streaming platform
  - Core concepts: Topics, Producers, Consumers, Partitions, Offsets
  - Advanced: Schema Registry, CDC with Debezium, MQTT, Avro, Protobuf
  - Complete data ingestion flow for all 4 sources
  - Why Kafka vs REST APIs or database polling

- **`NUMPY_RISK_DETECTION_DETAILED.md`** - NumPy vectorization deep dive
  - How NumPy processes 200 lots in 50ms (vs LLM: 6.7 min)
  - SIMD vectorization, contiguous memory, no Python overhead
  - 5 risk factors with product mix and cross-week impact
  - Code examples with ML model integration

- **`RISK_DETECTION_EXPLAINED.md`** - Risk Detection Agent overview
  - Triage layer: filters 200 lots → 5-10 high-risk
  - 5 factors: OTIF gap, WIP position, capacity, product mix, cross-week
  - Why custom Python vs LLM (speed, cost, explainability)

- **`VECTOR_DB_RAG_EXPLAINED.md`** - Vector DB and RAG concepts
  - Semantic search with embeddings
  - Hybrid retrieval (dense vector + BM25 keywords)
  - Why RAG for Cause Classifier

- **`RAG_VS_PAGEINDEX_DECISION.md`** - RAG vs PageIndex comparison
  - When to use RAG (1000+ incidents, production scale)
  - When to use PageIndex (<100 documents, MVP simplicity)
  - Cost and latency comparison

- **`LLM_TEMPERATURE_EXPLAINED.md`** - LLM temperature settings
  - Temperature 0.0-0.2 = Deterministic (classification)
  - Temperature 0.7-1.0 = Creative (chat, content)
  - Why 0.1 for Cause Classifier (consistency matters)

- **`AIRFLOW_VS_LANGGRAPH_EXPLAINED.md`** - Orchestration comparison
  - Airflow = Data pipeline orchestration (DAGs, no loops)
  - LangGraph = Agent workflow orchestration (state machines, with loops)
  - When to use each

- **`SHA256_HASH_CHAINING_EXPLAINED.md`** - Tamper-evident audit trails
  - Hash chaining concept (like blockchain)
  - Why external hash storage is needed
  - Code examples and interview talking points

- **`HASH_CHAINING_EXAMPLE.md`** - Real manufacturing scenario
  - 6-entry audit chain with actual SHA-256 hashes
  - Shows tampering detection with hash mismatches

- **`KUBERNETES_EXPLAINED.md`** - Container orchestration
  - Core concepts: Pods, Deployments, Services, ConfigMaps, Secrets
  - Auto-scaling, self-healing, zero-downtime deployments
  - Why K8s vs Docker alone

- **`PYDANTIC_EXPLAINED.md`** - Data validation and structured output
  - Type-safe validation for LLM outputs
  - BaseModel, Field validators, nested models
  - Used in Cause Classifier for structured responses

- **`GREAT_EXPECTATIONS_EXPLAINED.md`** - Data quality testing
  - Unit tests for data (not code)
  - Expectation suites for validation gates
  - Used in Data Quality Agent

- **`POSTGRESQL_JSONB_EXPLAINED.md`** - Flexible JSON storage
  - JSONB = binary JSON (fast, queryable, indexed)
  - Audit log with flexible action schemas
  - Combined with SHA-256 hash chaining
##  System Design Highlights

### 6-Agent Architecture

1. **Data Quality Agent** - Validation with Great Expectations & Pydantic
2. **Risk Detection Agent** - Custom Python scoring (NOT LLM for speed)
3. **Cause Classifier Agent** - LLM + RAG for root cause analysis
4. **Follow-Up Agent** - ReAct pattern for stakeholder engagement
5. **Trade-Off Engine** - OR-Tools for mathematical optimization (NOT LLM)
6. **Action & Audit Agent** - SHA-256 hash-chained immutable audit trail

### Key Technical Decisions

- **LangGraph over Airflow** - Handles cyclic workflows (follow-up loops)
- **OR-Tools over LLM** - Mathematical guarantees prevent W1 fixes from harming W2-W4
- **Custom Python for risk scoring** - Sub-100ms latency requirement
- **Hash-chained audit log** - Tamper-evident trail for quality compliance
- **Shadow mode first** - 4-week trust-building before automation
- **Variable cadence** - W1/W2 refresh every 2 hours, W3/W4 refresh 3x/week

### Data Architecture

- **Sources**: MES (CDC), Equipment (MQTT), ERP (batch), Quality (REST API)
- **Storage**: PostgreSQL + TimescaleDB for time-series data
- **RAG**: Managed vector database with hybrid retrieval (dense + BM25)
- **Streaming**: Kafka for event-driven data flow

##  MVP Roadmap (4 Weeks)

- **Week 1: Shadow Mode** - Risk detection validation (read-only)
- **Week 2: Root Cause Classification** - Cause Classifier + RAG (advisory, >80% accuracy gate)
- **Week 3: Automated Follow-Up** - Auto-contact right owner based on classification (>80% response gate)
- **Week 4: Optimization & Automation** - Trade-Off Engine + auto-execute low-risk actions

##  Success Metrics

- **Primary**: OTIF improvement, commit accuracy, low false positive rate
- **Leading**: Detection lead time, expedite reduction, WIP queue time
- **Agent Performance**: Action closure time, recommendation acceptance, effort saved

##  Course Concepts Applied

- **Week 10**: RAG with vector database for historical incident retrieval
- **Week 12**: Multi-agent orchestration with LangGraph, tool binding with LangChain
- **Hybrid Approach**: LLMs where they add value (classification), NOT where they don't (optimization, scoring)

##  Notes

- All metrics and percentages are illustrative - to be calibrated with actual baseline data
- Vendor-agnostic design - adaptable to any LLM provider, vector DB, or infrastructure
- PostgreSQL is a technology choice (TimescaleDB extension), not a vendor lock-in
