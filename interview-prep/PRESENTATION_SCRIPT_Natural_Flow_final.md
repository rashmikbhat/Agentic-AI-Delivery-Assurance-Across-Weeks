# Presentation Script: Agentic AI Delivery Assurance (W1-W4 Rolling Horizon)

## OPENING (30 seconds)

Thanks for the opportunity to walk through this design. The problem I'm solving is delivery assurance across W1 to W4 with explicit handling of product mix complexity—where fixing one product's W1 shortage can consume shared bottleneck capacity and cause misses for other products in W2 through W4.

---

## SLIDE 1: PROBLEM & SOLUTION (2-3 minutes)

### The Problem

Let's start with the problem. We're dealing with delivery misses driven by equipment downtime, UPH degradation, and WIP bottlenecks at critical steps. Right now, it's all manual monitoring—planners and IEs are pulling data from multiple data sources. By the time they see the full picture, they're already dealing with problems instead of preventing them.

There's also product mix complexity with shifting bottlenecks. Multiple product families run through shared tool groups, and the bottleneck moves depending on which products are running and equipment availability. Critically, different products consume capacity at different rates—Product A might need 2 hours per unit at Lithography while Product B needs only 1.5 hours. So when you expedite 50 units of Product A to fix W1, you're not just borrowing time—you're consuming 100 hours of shared capacity that Products B and C also need.

And the biggest issue: local fixes harm downstream weeks. When you expedite a lot in W1, you're pulling resources from W2, W3, and W4. This isn't just about one lot—it's a product mix trade-off across weeks.

**The other thing that's broken** is traceability. When someone asks "why did you expedite this lot last Tuesday?" there's no systematic record of what data supported that decision, what alternatives were considered, and what the actual outcome was versus the prediction. So you're not learning systematically—just reacting over and over.

### The Solution

I designed a six-agent system. I want to be clear upfront about where I use LLMs and where I don't, because that's critical for production.

The six agents are:

**1. Data Quality** - Validates freshness and integrity using Great Expectations. For W1, if MES data is over 30 minutes old, blocks auto-execution.

**2. Risk Detection** - ML model plus NumPy for fast scoring. Predicts completion times, calculates five risk factors including product mix with UPH-weighted capacity demand and cross-week impact. Under 100 milliseconds for 200 lots. This is the triage layer.

**3. Cause Classifier** - LLM with RAG. Retrieves top 5 similar past incidents, classifies into 6 root cause categories with Pydantic structured output. Only runs on high-risk lots flagged by Risk Detection.

**4. Follow-Up** - ReAct agent with tool binding. Contacts maintenance, process engineers, planners via Slack, email, or CMMS. Escalates if no response in 15 minutes.

**5. Trade-Off Engine** - OR-Tools optimizer. Models shared bottleneck capacity with different UPH rates per product. Allocates capacity across products and weeks while proving W1 fixes won't harm W2-W4. This is where product mix trade-offs are resolved mathematically.

**6. Action and Audit** - Executes approved actions, logs everything with SHA-256 hash chaining for tamper-evident audit trails.

### Workflow and Cadence

So end-to-end, the flow is: **INGEST → DETECT → CLASSIFY → FOLLOW-UP → TRADE-OFF → ACTION**.

The cadence varies by week because data ages differently. W1 and W2 refresh every 2 hours since they're actively executing. W3 and W4 refresh 3 times a week since we're mostly planning, not executing.

This cuts compute costs significantly and prevents alert fatigue. If you ping planners constantly about a W4 issue, they'll ignore you.

### Failure Modes

Let me cover failure modes because this shows production thinking, not just whiteboard design.

If LLM times out—and it will—the system retries three times, then escalates to a human. The system doesn't fail silently or block forever.

If the system gets stale data beyond the threshold, it blocks auto-execute. Full stop. Better to have humans make decisions with context than have the agent make confident decisions on bad data.

If the Trade-Off Engine says "no feasible solution," the system alerts the planner with details on which constraints conflict. Maybe three products need more than available capacity—that's a business problem, not a system bug, and humans need to negotiate.

---

## SLIDE 2: DATA ARCHITECTURE (2-3 minutes)

### Data Sources

Let's talk about data architecture. 
The system ingests from four primary sources:

**MES** comes in via CDC (change data capture) streaming into Kafka. Avro format with Schema Registry. Batch updates every 15-30 minutes—sufficient for Risk Detection's 2-hour refresh cadence.

**Equipment** comes from MQTT into Kafka. Event-driven, updates within minutes. Critical events like tool down at bottleneck trigger immediate Slack alerts to maintenance—that's the real-time path. Data ingestion runs on a near real-time schedule since Risk Detection only refreshes every 2 hours.

**ERP** is daily. Airflow DAG dumps to S3, converts to Parquet, streams into Kafka on a daily schedule. Why not more often? Because ERP only updates once daily. More frequent polling wastes API calls.

**Quality** comes from REST API, hourly batch plus immediate alerts for critical defects. When scrap spikes, we get an immediate Slack alert to quality engineers—that's real-time alerting, not data ingestion.

### Key Tables

This all lands in five core tables in PostgreSQL with TimescaleDB for time-series data.

**`wip_snapshot`** has lot_id, product_family, current_step, queue_time_mins, and hold_reason. Updates hourly for W1 and W2, every 3 hours for W3-W4. This is the heartbeat—if we don't know where WIP is, we can't do anything.

**`route_master`** defines the process flow: product_family, step sequence, tool_group, baseline_uph, and load_factor. Updated only when engineering changes routes.

**`tool_status`** tracks equipment: tool_id, tool_group, status, eta_recovery, owner_id. Event-driven, updated in real time via MQTT.

**`oee_hourly`** rolls up equipment performance: tool_group, availability, performance, quality, OEE, and actual UPH. Hourly rollups. This catches UPH degradation.

**`capacity_vs_demand`** is the summary: week_bucket, tool_group, product_family, gap in units, and gap percentage. Updates every 4 hours for W1 and W2, daily for W3-W4. This is what the Risk Detection agent scores.

### Vector DB for RAG

For RAG, I use a managed vector database with hybrid retrieval—dense vector plus keyword matching for best accuracy.

### Data Quality Checks

The system runs Great Expectations on every ingestion.

**Freshness**: W1 MES data must be under 30 minutes old. If not, the system alerts and blocks auto-execute. W2 allows up to 2 hours, W3-W4 have longer thresholds.

**Referential integrity**: every lot_id must exist in route_master. If not, the system quarantines it for review.

**Sanity checks**: UPH can't be over a multiple of baseline. Queue time can't exceed reasonable limits. OEE can't be over 100%.

These are circuit breakers. Bad data kills trust.

---

## SLIDE 3: AGENT STACK IMPLEMENTATION (3-4 minutes)

### Core Tech Stack

Let me walk through the tech stack and why I chose each piece.

**LangGraph** for orchestration. Why not Airflow? Airflow is DAG-based and my workflow has cycles. Follow-Up needs to: ping, wait, if no response, escalate and re-ping. That's a cycle. LangGraph's conditional edges handle this naturally.

**LangChain** for tool binding. The `@tool` decorator exposes Python functions as tools the LLM can call. LangChain handles retries, parsing, and error recovery.

**Primary and secondary LLMs** for redundancy. If the primary provider goes down, the system doesn't stop. Temperature is 0.1—I want consistent behavior for classification.

**Vector database** as a managed service—I don't run infrastructure. For an MVP, managed services save time.

**Kafka** for event streaming. Continuous data flow, which W1 needs. I use managed Kafka—reduces operational overhead.

**PostgreSQL with TimescaleDB** for structured and time-series data. TimescaleDB partitions time-series data automatically, making OEE trend queries fast. Pure PostgreSQL would slow down. Pure time-series DBs can't do relational joins well.

### LangGraph State Machine

I define an `AgentState` with fields passed between agents: risk_score, root_cause, week_bucket, and citations. Citations lists data sources with timestamps for traceability.

I create a StateGraph, add six nodes—one per agent—and define conditional edges. After risk detection: if risk_score is low, go to END. If medium or high, route to classify. This prevents alert fatigue.

After Trade-Off Engine: if "no feasible solution," route to human escalation, not action executor. The system doesn't execute impossible plans.

Once compiled, you can invoke it and visualize it. When something fails, the agent tracing platform shows exactly which node failed and the state at that point.

### Implementation Details by Agent Type

**ML-Based Agent (Risk Detection)**: Random Forest model predicts time-to-completion. Then NumPy vectorizes risk scoring across 200 lots in under 100 milliseconds. Outputs risk score with full breakdown showing exactly why each lot was flagged. This is the only agent that doesn't use an LLM—speed is critical.

**LLM-Based Agents (Cause Classifier, Follow-Up)**: Use LangChain tool binding and ReAct prompting. Cause Classifier uses RAG with vector DB to retrieve similar historical incidents, then LLM classifies with Pydantic structured output. Follow-Up uses ReAct loop—reasons about who to contact, calls Slack or email tools, observes response, escalates if needed.

**Optimization Agent (Trade-Off Engine)**: OR-Tools SCIP solver for mixed-integer linear programming. Decision variables are capacity per product per week. Constraints enforce minimum commitments and cross-week buffers. Objective maximizes OTIF weighted by week. Returns optimal, feasible, or infeasible with proof.

**Audit Agent (Action and Audit)**: PostgreSQL JSONB stores flexible action schemas. SHA-256 hash chaining makes the log tamper-evident—current_hash covers this entry, previous_hash links to prior entry. Any alteration breaks the chain.

---

## SLIDE 4: TRADE-OFF ENGINE & GUARDRAILS (3-4 minutes)

### Trade-Off Engine

This prevents "fix W1, harm W2-W4."

I use OR-Tools, Google's optimization library. SCIP solver for mixed-integer linear programming. Why not an LLM? LLMs make mistakes on math. OR-Tools gives mathematical proof.

I define decision variables: capacity per product per week. Then constraints: minimum commitments, capacity ceiling, buffer for W2-W4 (untouchable by W1), and W1 can't reduce W2 beyond a threshold.

Objective: maximize OTIF, weighted by week.

Solver returns: optimal (best solution, proven), feasible (solution found), or infeasible (no solution exists—conflicting requirements, escalate to manager).

### Guardrails

**Bottleneck Protection**: W1 expedite beyond a threshold of bottleneck capacity gets blocked. Prevents W1 panic from breaking the plan.

**Mix Balance**: Each product maintains a balanced percentage of weekly load. Prevents over-indexing on high-margin products. Critically, this accounts for different capacity consumption rates—Product A at 2 hours per unit versus Product B at 1.5 hours. The constraint ensures fairness based on capacity hours, not just unit counts.

**Capacity Reservation**: W2-W4 keep a capacity buffer, W1 can't touch it. For example, if Lithography has 500 hours in W1, I reserve 100 hours minimum for W2 commitments. W1 expedites can only use the unreserved 400 hours.

**Cross-Week Impact**: W1 can't reduce W2 beyond a threshold, W3-W4 have a higher threshold since they have more recovery time. This is the core product mix trade-off—OR-Tools proves mathematically that expediting Product A in W1 won't cause Products B and C to miss W2.

### Approval Matrix

Not all actions are equal.

**W1**: Flag lot (AUTO—low-risk), Create ticket (AUTO), Re-sequence (APPROVAL—affects multiple customers), Expedite (APPROVAL), Release hold (APPROVAL—needs expert), Reallocate capacity (BLOCKED—too late).

**W2-W4**: More approvals required. W3-W4 expedites are blocked—sign of panic mode.

The approval mechanism is Teams or Slack adaptive cards. The system sends a card with the recommendation, the impact forecast, and citations. The planner can approve, reject, or delay. If they approve, the system executes and logs the approval. If they reject, it logs the rejection and the reason. If they delay, it re-prompts 4 hours later. All of this is in the audit log.

### Immutable Audit Log

So the audit log is PostgreSQL JSONB with SHA-256 hash chaining. Let me explain why I went this route.

First, why JSONB and not a relational schema? Because the structure of audit entries varies by action type. A "create ticket" action has different fields than a "reallocate capacity" action. JSONB gives schema flexibility while keeping everything queryable—I can still do `WHERE action_type = 'EXPEDITE_LOT'` and `WHERE approved_by = 'planner@infineon.com'` because PostgreSQL's JSONB indexing is fast.

Why hash chaining? Quality incidents can trigger audits months or even years later. I need to prove the audit trail wasn't altered. If you alter one entry, the hash changes and breaks the chain.

Why SHA-256? Industry-standard, collision-resistant, fast.

Audit log has: action_id, timestamp, agent, rationale, citations, impact forecast vs actual, agent trace_id, hashes. Citations provide data evidence with timestamps.

I can answer: What did the system recommend? Why? What data supported it? Who approved? Forecast vs actual? And prove it wasn't altered.

---

## SLIDE 5: KPIs & MVP ROADMAP (2-3 minutes)

### KPIs

Let me walk through how I measure success.

**Primary outcomes** are what matters to the business: OTIF improvement by week AND by product family—critical because the case requires handling product mix trade-offs. Commit accuracy by week, and false positive rate kept low. Some false alarms are okay—better to catch real risks with a few false alerts than miss critical issues. But if false positives are too high, people start ignoring the system.

**Leading indicators** help catch problems early: detection lead time before a delivery miss gives time to react, expedite volume reduction, W1 WIP queue time at bottleneck steps, and bottleneck capacity utilization balance across products—are we favoring one product family over others?

**Agent performance** metrics tell if the system is helping: action closure time for W1 issues, recommendation acceptance rate—if too many are rejected I'm creating work not value—effort saved per planner, and cross-week impact accuracy—when we expedite in W1, did we accurately predict the W2 impact?

### MVP Roadmap

Here's the 4-week rollout. Each week has a gate—I don't advance until I hit it.

**Week 1: Shadow Mode**. Deploy infrastructure, turn on Risk Detection in read-only mode logging to staging. Run internal monitoring only. **Gate**: precision high enough—the agent catches most of the risks humans are already seeing. If it can't hit that, it's not ready.

**Week 2: Follow-Up Agent**. Add Follow-Up for W1 equipment issues only. Wire up Slack and Teams, add SLA tracking, start auto-pinging maintenance. Collect feedback from the maintenance team. **Gate**: response rate high enough within SLA.

**Week 3: Action Pilot**. Turn on Cause Classifier with RAG, Trade-Off Engine in advisory mode, CMMS ticketing, and MES flags with approval required. Generate recommendations per day, show impact analysis, execute approved actions. **Gate**: approval rate acceptable.

**Week 4: Automation**. Enable auto-execution for low-risk actions, turn on KPI tracking, full audit trail, real-time dashboard. Measure W1 OTIF improvement, false positive rate, audit cleanliness. Collect planner feedback. **Gate**: OTIF improvement plus low false positives plus clean audit. Go/no-go decision to scale beyond pilot.

### Infrastructure

Infrastructure runs on Kubernetes with Kafka, PostgreSQL with TimescaleDB, and managed services for MVP speed.

### ROI

Each avoided shortage represents significant revenue risk. Planner time savings come from reduced follow-up overhead. System pays for itself by preventing delivery misses.

---

## CLOSING

Six key technical decisions:

**1. LangGraph over Airflow**: Airflow is DAG-based, I need cycles. Follow-up: ping, wait, no response, escalate, re-ping. LangGraph handles this.

**2. OR-Tools over LLM**: LLMs make mistakes on math. OR-Tools proves W2-W4 won't be harmed.

**3. ML plus NumPy for risk**: Latency. W1 needs under 100ms per refresh for 200 lots. Random Forest predicts completion times, NumPy vectorizes risk scoring with five factors including product mix and cross-week impact. LLM would take 6 minutes for 200 lots.

**4. Hash-chained audit**: Quality audits need tamper-evident trails. SHA-256 chaining shows alterations.

**5. Shadow mode first**: The constraint is trust, not tech. Four weeks of validated predictions builds confidence.

**6. Variable cadence**: W1 and W2 data ages faster than W3-W4. Variable cadence cuts compute costs significantly and prevents alert fatigue.

That's the design.
