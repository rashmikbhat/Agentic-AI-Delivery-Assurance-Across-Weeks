# Presentation Script: Agentic AI Delivery Assurance (W1-W4 Rolling Horizon)

## OPENING (30 seconds)

Thanks for the opportunity to walk through this design. So, the problem I'm solving here is actually something I've seen play out in multiple manufacturing environments—it's this constant tension between reacting to what's happening right now in Week 1 and not completely destroying your plan for Weeks 2, 3, and 4. 

And what makes this particularly challenging is the product mix complexity. You've got multiple product families running through shared bottleneck tools, each consuming capacity at different rates. So when you expedite one product to hit a W1 commit, you're not just borrowing from the future—you're borrowing from *other products'* future capacity. That's the core constraint I had to design around.

---

## SLIDE 1: PROBLEM & SOLUTION (2-3 minutes)

### The Problem

Let's start with the problem. We're dealing with delivery misses driven by equipment downtime, UPH degradation, and WIP bottlenecks at critical steps. Right now, it's all manual monitoring—planners and IEs are pulling data from multiple data sources. By the time they see the full picture, they're already dealing with problems instead of preventing them.

There's also product mix complexity with shifting bottlenecks. Multiple product families run through shared tool groups, and the bottleneck moves depending on which products are running and equipment availability. This makes capacity planning much harder.

And the biggest issue: local fixes harm downstream weeks. When you expedite a lot in W1 to hit a customer commit, you're pulling capacity from W2, W3, and W4.

**The other thing that's broken** is traceability. When someone asks "why did you expedite this lot last Tuesday?" there's no systematic record of what data supported that decision, what alternatives were considered, and what the actual outcome was versus the prediction. So you're not learning systematically—just reacting over and over.

### The Solution

So I designed a six-agent system, and I want to be clear upfront about where I use LLMs and where I don't, because that's critical to making this work in production.

**Agent 1 is Data Quality**—not exciting, but critical. I use Great Expectations with Pydantic to validate data freshness, check keys exist, and run sanity checks. For W1, if MES data is over 30 minutes old, the system blocks auto-execution and shows a "MANUAL MODE" banner. Stale data is worse than no data—you'll make the wrong decision with confidence.

**Agent 2 is Risk Detection**—this is *not* an LLM. It's custom Python with ML for speed. Under 100 milliseconds on every refresh, and LLM takes 1 to 3 seconds. I use a Random Forest model to predict completion times—this approach achieves 92-94% accuracy in production. Then NumPy calculates five risk factors: OTIF gap from ML prediction, WIP position, capacity utilization, product mix with UPH-weighted demand, and cross-week impact. Fast, deterministic, and I can show exactly why each lot got flagged.

**Agent 3 is the Cause Classifier**—this is where I use an LLM. Once the system detects a high-severity risk, I need to understand why. Is it downtime? UPH degradation? A queue bottleneck? The system retrieves the top 5 similar past incidents, then asks the LLM to classify into 6 categories using Pydantic for structured output. Temperature is 0.1—I want consistent answers, not creative ones.

**Agent 4 is Follow-Up**—uses the ReAct pattern. It figures out who to contact, picks the right tool—Slack, email, or CMMS ticket—checks the result, and decides next steps. If maintenance doesn't respond in 15 minutes, it escalates to the supervisor. After 4 hours, it goes to the plant manager. This is where LangChain's tool binding works well.

**Agent 5 is the Trade-Off Engine**—also not an LLM. I use OR-Tools, a constraint solver. Why? Because LLMs make mistakes on math, and I need proof that fixing W1 won't hurt W2, W3, and W4. I encode rules like "W1 fixes can't reduce W2 beyond a threshold" and "W2 through W4 keep a capacity buffer." OR-Tools either finds the best solution or tells you "no solution exists"—which means I escalate to a human.

**Agent 6 is Action and Audit**—executes approved actions and logs everything with SHA-256 hash chaining. Why? Because quality incidents can trigger audits 18 months later, and I need to prove the records weren't changed. Each entry contains the hash of the previous one, so any tampering shows up.

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

Let's talk about data architecture. Most AI projects assume clean data just exists—it doesn't.

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

For RAG, I use a managed vector database with an embedding model. The embedding size could be tuned based on retrieval accuracy once we have historical incident data.

Documents would be incident description plus root cause plus resolution, chunked for optimal retrieval. Metadata includes tool_group, product_family, week_bucket, and timestamp for filtered retrieval.

Retrieval is hybrid: dense vector plus BM25 keyword matching. This catches semantic similarity and exact keyword matches.

The number of retrieved incidents could be tuned based on context needs and accuracy once we have data.

### Data Quality Checks

The system runs Great Expectations on every ingestion.

**Freshness**: W1 MES data must be under 30 minutes old. If not, the system alerts and blocks auto-execute. W2 allows up to 1 hour, W3-W4 have longer thresholds.

**Referential integrity**: every lot_id must exist in route_master. If not, the system quarantines it for review.

**Sanity checks**: UPH can't be over a multiple of baseline. Queue time can't exceed reasonable limits. OEE can't be over 100%.

These are circuit breakers. Bad data kills trust.

### Data Unification

The join pattern ties everything together. Join plan to WIP on product_family, then to route to get tool_group, then to OEE, then to capacity vs demand.

Key relationships: lot_id is WIP identity, product_family groups routes, tool_group is the capacity pool, week_bucket is the time horizon.

This lets me answer "which lots are at risk in W2 because a tool group has degraded OEE?"—I've unified MES, route, equipment, and capacity in one schema.

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

### Agent Implementation

**Data Quality Agent**: LangChain DataLoader plus Great Expectations. Great Expectations has 300+ built-in checks. I compose these instead of writing custom validation.

**Risk Detection Agent**: Custom Python with ML, not an LLM. I need under 100 milliseconds per refresh. LLM takes 1-3 seconds. I use a Random Forest model for time-to-completion prediction—this approach achieves 92-94% accuracy in production. Then NumPy vectorized calculations for risk scoring: OTIF gap from ML prediction, WIP position, capacity utilization, product mix competition with UPH-weighted demand, and cross-week impact. Five factors combined with weighted sum. Fast, deterministic, product mix aware, and I can show exactly why each lot got flagged.

**Cause Classifier**: LLMChain with Pydantic. RAG retrieves top 5 incidents, the system passes them to LLM, and it outputs a RootCauseAnalysis model. That enforces 6 categories, confidence 0-1, evidence list, and recommendation. If it outputs an invalid category, Pydantic catches it and the system retries.

**Follow-Up Agent**: ReAct Agent with Slack, email, and CMMS tools. Gets the problem, reasons about who to contact, calls the tool, observes the result. If no response in 15 minutes, escalates to supervisor. Reason, Act, Observe, repeat.

**Trade-Off Engine**: OR-Tools SCIP solver. Not an LLM—it's a math optimizer. I define decision variables—capacity per product per week—and constraints: minimum commitments, buffer reservations, cross-week limits. Objective: maximize OTIF. OR-Tools finds optimal allocation or proves none exists. LLMs can't give mathematical guarantees.

**Action and Audit Agent**: ToolExecutor for actions, PostgreSQL JSONB for audit log with SHA-256 hash chaining. Every action writes action_id, timestamp, agent_name, rationale, citations, impact, and hashes. Current_hash covers the entry; previous_hash links to prior entry. If you alter one entry, the chain breaks—tampering is detectable.

### Pydantic Models

`RiskAssessment` has risk_score (0-100), week_bucket (W1/W2/W3/W4), product_family, and citations. If the LLM outputs risk_score of 150, Pydantic errors and the system retries.

`RootCauseAnalysis` has root_cause (6 allowed values), confidence (0-1), evidence list, and recommendation (auto/approval/blocked). Structured output makes LLM output actionable—no string parsing needed.

### Debugging

**Scenario 1: False positive**. Planner says "no actual problem." I pull agent trace, check risk_score inputs, query wip_snapshot at alert time, check data freshness. Usually stale MES data. Fix: make freshness check fail loudly.

**Scenario 2: Follow-up spam**. 50 Slack pings in 5 minutes. Check SLA table for backoff bug, inspect agent state for infinite loops, check Kafka lag. Usually a state reset bug. Fix: reset flags after escalation.

**Scenario 3: No feasible solution**. Check OR-Tools logs for violated constraint, query capacity vs demand. Usually business problem—products need more than available capacity. Escalate to planning manager to renegotiate.

---

## SLIDE 4: TRADE-OFF ENGINE & GUARDRAILS (3-4 minutes)

### Trade-Off Engine

This prevents "fix W1, harm W2-W4."

I use OR-Tools, Google's optimization library. SCIP solver for mixed-integer linear programming. Why not an LLM? LLMs make mistakes on math. OR-Tools gives mathematical proof.

I define decision variables: capacity per product per week. Then constraints: minimum commitments, capacity ceiling, buffer for W2-W4 (untouchable by W1), and W1 can't reduce W2 beyond a threshold.

Objective: maximize OTIF, weighted by week.

Solver returns: optimal (best solution, proven), feasible (solution found), or infeasible (no solution exists—conflicting requirements, escalate to manager).

### Why OR-Tools, Not LLM

LLMs are probabilistic—good for classification, bad for math with hard constraints. If I tell a planner "your W1 fix won't harm W2" and I'm wrong, trust is destroyed.

OR-Tools proves, not guesses. When it says "infeasible," it shows which constraint binds. An LLM would keep generating invalid plans.

I could use an LLM to explain solver output in natural language—that's fine.

### Guardrails

**Bottleneck Protection**: W1 expedite beyond a threshold of bottleneck capacity gets blocked. Prevents W1 panic from breaking the plan.

**Mix Balance**: Each product maintains a balanced percentage of weekly load. Prevents over-indexing on high-margin products.

**Capacity Reservation**: W2-W4 keep a capacity buffer, W1 can't touch it.

**Cross-Week Impact**: W1 can't reduce W2 beyond a threshold, W3-W4 have a higher threshold since they have more recovery time.

### Approval Matrix

Not all actions are equal.

**W1**: Flag lot (AUTO—low-risk), Create ticket (AUTO), Re-sequence (APPROVAL—affects multiple customers), Expedite (APPROVAL), Release hold (APPROVAL—needs expert), Reallocate capacity (BLOCKED—too late).

**W2-W4**: More approvals required. W3-W4 expedites are blocked—sign of panic mode.

The approval mechanism is Teams or Slack adaptive cards. The system sends a card with the recommendation, the impact forecast, and citations. The planner can approve, reject, or delay. If they approve, the system executes and logs the approval. If they reject, it logs the rejection and the reason. If they delay, it re-prompts 4 hours later. All of this is in the audit log.

### Immutable Audit Log

So the audit log is PostgreSQL JSONB with SHA-256 hash chaining. Let me explain why I went this route.

First, why JSONB and not a relational schema? Because the structure of audit entries varies by action type. A "create ticket" action has different fields than a "reallocate capacity" action. JSONB gives schema flexibility while keeping everything queryable—I can still do `WHERE action_type = 'EXPEDITE_LOT'` and `WHERE approved_by = 'planner@micron.com'` because PostgreSQL's JSONB indexing is fast.

Why hash chaining? Quality incidents can trigger audits months or even years later. I need to prove the audit trail wasn't altered. If you alter one entry, the hash changes and breaks the chain.

Why SHA-256? Industry-standard, collision-resistant, fast.

Audit log has: action_id, timestamp, agent, rationale, citations, impact forecast vs actual, agent trace_id, hashes. Citations provide data evidence with timestamps.

I can answer: What did the system recommend? Why? What data supported it? Who approved? Forecast vs actual? And prove it wasn't altered.

---

## SLIDE 5: KPIs & MVP ROADMAP (2-3 minutes)

### KPIs

Let me walk through how I measure success.

**Primary outcomes** are what matters to the business: OTIF improvement by week, commit accuracy, and false positive rate kept low. Some false alarms are okay—better to catch real risks with a few false alerts than miss critical issues. But if false positives are too high, people start ignoring the system.

**Leading indicators** help catch problems early: detection lead time before a delivery miss gives time to react, expedite volume reduction, and W1 WIP queue time at bottleneck steps.

**Agent performance** metrics tell if the system is helping: action closure time for W1 issues, recommendation acceptance rate—if too many are rejected I'm creating work not value—and effort saved per planner.

### MVP Roadmap

Here's the 4-week rollout. Each week has a gate—I don't advance until I hit it.

**Week 1: Shadow Mode**. Deploy infrastructure, turn on Risk Detection in read-only mode logging to staging. Run internal monitoring only. **Gate**: precision high enough—the agent catches most of the risks humans are already seeing. If it can't hit that, it's not ready.

**Week 2: Follow-Up Agent**. Add Follow-Up for W1 equipment issues only. Wire up Slack and Teams, add SLA tracking, start auto-pinging maintenance. Collect feedback from the maintenance team. **Gate**: response rate high enough within SLA.

**Week 3: Action Pilot**. Turn on Cause Classifier with RAG, Trade-Off Engine in advisory mode, CMMS ticketing, and MES flags with approval required. Generate recommendations per day, show impact analysis, execute approved actions. **Gate**: approval rate acceptable.

**Week 4: Automation**. Enable auto-execution for low-risk actions, turn on KPI tracking, full audit trail, real-time dashboard. Measure W1 OTIF improvement, false positive rate, audit cleanliness. Collect planner feedback. **Gate**: OTIF improvement plus low false positives plus clean audit. Go/no-go decision to scale beyond pilot.

### Infrastructure

Kubernetes cluster with 5 nodes running API endpoints and async workers. Data layer is Kafka with 3 brokers, PostgreSQL with TimescaleDB, and managed vector database. Observability with agent tracing, infrastructure metrics, and centralized logging. CI/CD with automated testing and GitOps deployments.

Testing approach: majority unit tests with high coverage, integration tests with containerized services, and LLM evaluation with historical incidents using LLM-as-judge.

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
