# Agentic AI Delivery Assurance - Interview Preparation

## Overview

This repository contains the design documentation for an **Agentic AI system for manufacturing delivery assurance** across a rolling 4-week horizon (W1-W4). The system uses a hybrid approach combining LLMs for classification with traditional optimization for trade-off decisions.

##  Repository Contents

### Presentation Materials

- **`Agentic_AI_Delivery_Assurance_UPDATED_FINAL.pptx`** - Complete presentation deck
  - Vendor-agnostic language (no specific tool names)
  - Updated cadences and data frequencies
  - Generic ROI metrics (no baseline data assumed)

### Documentation

- **`agenticaideliveryassurance/PRESENTATION_SCRIPT_Natural_Flow.md`** - Speaking script (12-15 minutes)
  - Natural, conversational flow
  - Vendor-agnostic terminology
  - Focus on business value and ROI

- **`agenticaideliveryassurance/GAP_ANALYSIS_Design_Review.md`** - Interview preparation
  - Design coverage vs requirements
  - Potential interview questions
  - Defense strategies for design decisions

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
- **Week 2: Follow-Up Agent** - Auto-ping maintenance for W1 equipment issues
- **Week 3: Action Pilot** - Generate recommendations with impact analysis
- **Week 4: Automation** - Auto-execute low-risk actions with full audit trail

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

