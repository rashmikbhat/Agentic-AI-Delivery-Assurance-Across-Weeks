# LangChain, LangGraph, and LangSmith Explained

## TL;DR - The LangChain Ecosystem

- **LangChain** = Toolkit for building LLM applications (like React for AI apps)
- **LangGraph** = State machine for agent workflows with cycles (orchestrator)
- **LangSmith** = Debugging/monitoring tool (like Chrome DevTools for AI)

**Think of it like web development:**
- LangChain = React (component library)
- LangGraph = Redux (state management)
- LangSmith = Chrome DevTools (debugging)

---

## Part 1: LangChain - The LLM Application Framework

### What It Is
LangChain is a **Python/TypeScript framework** for building applications with Large Language Models (LLMs).

### The Problem It Solves

**Without LangChain:**
```python
# You write everything from scratch
import openai

def ask_llm(question):
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": question}]
    )
    return response.choices[0].message.content

# But now you need:
# - Retry logic if API fails
# - Tool calling (let LLM call functions)
# - Conversation memory
# - Prompt templates
# - Output parsing
# - Error handling
# ...and you build all of this yourself!
```

**With LangChain:**
```python
from langchain.chat_models import ChatOpenAI
from langchain.tools import tool
from langchain.agents import AgentExecutor

@tool
def get_weather(city: str) -> str:
    """Get weather for a city"""
    return f"Weather in {city}: 72°F and sunny"

# LangChain handles everything!
llm = ChatOpenAI(model="gpt-4")
agent = create_tool_calling_agent(llm, tools=[get_weather])
agent_executor = AgentExecutor(agent=agent)

result = agent_executor.invoke({"input": "What's the weather in Seattle?"})
# LangChain handles: API calls, retries, tool binding, parsing, errors
```

---

### Core LangChain Components

#### 1. **LLM Wrappers** (Provider Abstraction)
```python
# Same interface, different providers
from langchain.chat_models import ChatOpenAI, ChatAnthropic

llm_openai = ChatOpenAI(model="gpt-4")
llm_anthropic = ChatAnthropic(model="claude-3-sonnet")

# Both use same interface
response1 = llm_openai.invoke("Hello")
response2 = llm_anthropic.invoke("Hello")
```

**Why This Matters:** Switch LLM providers without rewriting code!

---

#### 2. **Prompt Templates**
```python
from langchain.prompts import ChatPromptTemplate

template = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant for {domain}"),
    ("human", "Question: {question}")
])

prompt = template.invoke({
    "domain": "manufacturing",
    "question": "What causes tool downtime?"
})
```

---

#### 3. **Tool Binding** (Critical for Your Design!)
```python
from langchain.tools import tool

@tool
def create_cmms_ticket(tool_id: str, reason: str) -> str:
    """Create a maintenance ticket in CMMS"""
    # Call CMMS API
    ticket_id = cmms_api.create_ticket(tool_id, reason)
    return f"Created ticket {ticket_id}"

@tool
def send_slack_message(channel: str, message: str) -> str:
    """Send message to Slack channel"""
    slack_api.send(channel, message)
    return "Message sent"

# Bind tools to LLM
llm_with_tools = llm.bind_tools([create_cmms_ticket, send_slack_message])

# LLM can now call these functions!
response = llm_with_tools.invoke("Tool Litho-3 is down, create ticket and alert team")
```

**In Your Design:** Follow-Up Agent uses this to call Slack, CMMS, email APIs.

---

#### 4. **Output Parsers** (Pydantic Integration)
```python
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

class RootCauseAnalysis(BaseModel):
    root_cause: str = Field(description="Root cause category")
    confidence: float = Field(description="Confidence 0-1")
    evidence: list[str] = Field(description="Supporting evidence")

parser = PydanticOutputParser(pydantic_object=RootCauseAnalysis)

# LLM output is automatically parsed and validated
result = llm.invoke(prompt + parser.get_format_instructions())
parsed = parser.parse(result)  # Returns RootCauseAnalysis object
```

**In Your Design:** Cause Classifier uses this for structured output.

---

#### 5. **Chains** (Sequence of Operations)
```python
from langchain.chains import LLMChain

# Chain: Prompt → LLM → Parser
chain = LLMChain(llm=llm, prompt=template, output_parser=parser)

result = chain.invoke({"question": "Why is tool down?"})
# Automatically: formats prompt, calls LLM, parses output
```

---

### LangChain in Your Design

You use LangChain for:
1. **Tool binding** - Follow-Up Agent calls Slack/CMMS/Email
2. **Pydantic parsers** - Cause Classifier structured output
3. **Provider abstraction** - Easy to switch between GPT-4 and Claude
4. **Retry logic** - Automatic retries if LLM times out

---

## Part 2: LangGraph - State Machine for Agents

### What It Is
LangGraph is a **state machine framework** for building agent workflows with **cycles** (loops).

### The Problem It Solves

**LangChain Chains = Linear (No Loops)**
```python
# This works:
chain = prompt | llm | parser

# But this DOESN'T work:
# If parser fails → go back to prompt and retry
# If LLM says "need more info" → go back and ask
```

**LangGraph = Cyclic Workflows**
```python
from langgraph.graph import StateGraph

# Define state (shared between nodes)
class State(TypedDict):
    messages: list
    retry_count: int

# Create graph
graph = StateGraph(State)

# Add nodes
graph.add_node("prompt", prompt_node)
graph.add_node("llm", llm_node)
graph.add_node("validate", validate_node)

# Add conditional edges (can loop!)
graph.add_conditional_edges(
    "validate",
    lambda state: "llm" if state["retry_count"] < 3 else "END"
)

# Compile
app = graph.compile()
```

---

### Core LangGraph Concepts

#### 1. **StateGraph** (The State Machine)
```python
from langgraph.graph import StateGraph
from typing import TypedDict

class AgentState(TypedDict):
    risk_score: int
    root_cause: str
    week_bucket: str
    citations: list

graph = StateGraph(AgentState)
```

**State** = Data passed between nodes (like Redux store in React)

---

#### 2. **Nodes** (Agent Functions)
```python
def risk_detection_node(state: AgentState) -> AgentState:
    """Calculate risk score"""
    risk_score = calculate_risk(state)
    return {"risk_score": risk_score}

def classify_cause_node(state: AgentState) -> AgentState:
    """Classify root cause with LLM"""
    root_cause = llm_classify(state["risk_score"])
    return {"root_cause": root_cause}

# Add to graph
graph.add_node("detect", risk_detection_node)
graph.add_node("classify", classify_cause_node)
```

---

#### 3. **Edges** (Workflow Flow)

**Simple Edge (Always goes there):**
```python
graph.add_edge("detect", "classify")
# Always: detect → classify
```

**Conditional Edge (Decision point):**
```python
def should_classify(state: AgentState) -> str:
    if state["risk_score"] > 70:
        return "classify"
    else:
        return "END"

graph.add_conditional_edges(
    "detect",
    should_classify
)
# If high risk → classify
# If low risk → END
```

---

#### 4. **Cycles** (Loops - Why You Need LangGraph!)

**Your Follow-Up Agent Example:**
```python
class FollowUpState(TypedDict):
    ticket_id: str
    response_received: bool
    retry_count: int

def ping_maintenance(state: FollowUpState) -> FollowUpState:
    """Ping maintenance team"""
    send_slack(f"Ticket {state['ticket_id']} needs attention")
    return {"retry_count": state["retry_count"] + 1}

def check_response(state: FollowUpState) -> FollowUpState:
    """Check if they responded"""
    response = check_slack_thread(state["ticket_id"])
    return {"response_received": bool(response)}

def should_retry(state: FollowUpState) -> str:
    if state["response_received"]:
        return "END"
    elif state["retry_count"] < 3:
        return "ping"  # LOOP BACK!
    else:
        return "escalate"

graph.add_node("ping", ping_maintenance)
graph.add_node("check", check_response)
graph.add_node("escalate", escalate_to_manager)

graph.add_edge("ping", "check")
graph.add_conditional_edges("check", should_retry)
# check → ping → check → ping → ... (LOOP!)
```

**This is a CYCLE - cannot be done with LangChain chains or Airflow DAGs!**

---

### LangGraph in Your Design

```
┌─────────────┐
│   START     │
└──────┬──────┘
       ↓
┌─────────────┐
│  DETECT     │
│  (Risk)     │
└──────┬──────┘
       ↓
   ┌───┴───┐
   │ High? │
   └───┬───┘
    Yes│  No→END
       ↓
┌─────────────┐
│  CLASSIFY   │
│  (Cause)    │
└──────┬──────┘
       ↓
┌─────────────┐
│ FOLLOW-UP   │◄─┐ LOOP!
└──────┬──────┘  │
       ↓         │
   Response? ────┘ No
       │ Yes
       ↓
┌─────────────┐
│ TRADE-OFF   │
└──────┬──────┘
       ↓
  Feasible?
     │ Yes
     ↓
┌─────────────┐
│   ACTION    │
└──────┬──────┘
       ↓
     END
```

---

## Part 3: LangSmith - Debugging & Monitoring

### What It Is
LangSmith is a **debugging and observability platform** for LLM applications (like Chrome DevTools but for AI).

### The Problem It Solves

**Without LangSmith:**
```python
# Your agent fails
result = agent.invoke({"question": "Why is tool down?"})
# Error: "Agent failed"

# You have NO IDEA:
# - Which node failed?
# - What was the state at that point?
# - What did the LLM return?
# - How long did each step take?
# - What were the intermediate results?

# You add print() everywhere... painful debugging!
```

**With LangSmith:**
- Every agent run is automatically traced
- See each node execution in a visual timeline
- Inspect state at each step
- See LLM prompts and responses
- Measure latency per step
- Track token usage and cost

---

### Core Features

#### 1. **Trace Visualization**
```
Trace ID: abc123-def456

Timeline:
├─ detect_risk (47ms)
│  Input: {lot_id: "ABC-123"}
│  Output: {risk_score: 87}
│
├─ classify_cause (1.2s)
│  │ LLM Prompt: "Given risk score 87..."
│  │ LLM Response: {"root_cause": "TOOL_DOWNTIME"}
│  └─ Output: {root_cause: "TOOL_DOWNTIME"}
│
├─ follow_up (340ms)
│  └─ Tool Call: create_cmms_ticket()
│     └─ Result: "Ticket CMMS-5678 created"
│
└─ Total: 1.59s
```

You can see EVERYTHING that happened!

---

#### 2. **Error Debugging**
```
Trace ID: xyz789

├─ detect_risk (45ms) ✅
├─ classify_cause (FAILED) ❌
│  Error: ValidationError: confidence must be 0-1, got 1.5
│  LLM Response: {"confidence": 1.5}  ← LLM hallucinated!
│  State at failure: {risk_score: 87, root_cause: null}
```

**Now you know EXACTLY what went wrong!**

---

#### 3. **Prompt/Response Inspection**
```
Agent: Cause_Classifier
LLM Model: gpt-4
Temperature: 0.1

Prompt (System):
"You are a root cause classifier..."

Prompt (User):
"Risk score: 87, Tool: Litho-3 DOWN..."

LLM Response:
{
  "root_cause": "TOOL_DOWNTIME",
  "confidence": 0.92,
  "evidence": [...]
}

Tokens: 450 input, 120 output
Cost: $0.023
Latency: 1.2s
```

**See exactly what the LLM saw and returned!**

---

#### 4. **Production Monitoring**
- Track success/failure rates
- Monitor average latency
- See token usage over time
- Alert if error rate spikes
- Compare performance between model versions

---

### LangSmith in Your Design

**Use Case 1: Debugging False Positives**
```
Planner: "This alert is wrong, lot is fine"

You open LangSmith → find trace:
├─ detect_risk: risk_score=85
│  └─ Data source: wip_snapshot from 2 hours ago (STALE!)
└─ Root cause: Stale data, not bad logic

Fix: Tighten freshness checks
```

**Use Case 2: Monitoring LLM Performance**
```
Dashboard shows:
- Cause Classifier confidence trending down (0.95 → 0.75)
- LLM changed from GPT-4 to GPT-3.5 accidentally
- Revert to GPT-4
```

**Use Case 3: Cost Tracking**
```
Monthly report:
- Risk Detection: $0 (no LLM, just Python)
- Cause Classifier: $450 (10K classifications × $0.045/call)
- Follow-Up: $120 (5K tool calls)
Total: $570/month
```

---

## Interview Talking Points

### Q: "What's the difference between LangChain and LangGraph?"

**A:** "LangChain is the toolkit—it gives me LLM wrappers, tool binding, and prompt templates. LangGraph is the orchestrator—it manages the agent workflow with state and conditional routing. Think of it like React (LangChain) vs Redux (LangGraph). I use LangChain to build individual agents, and LangGraph to connect them into a workflow. The key reason I need LangGraph is for cyclic workflows—my Follow-Up Agent pings maintenance, waits, and if there's no response, loops back and re-pings. LangChain chains can't loop, but LangGraph can."

---

### Q: "What is LangSmith and why do you need it?"

**A:** "LangSmith is the debugging and monitoring tool. When an agent fails or produces a false positive, LangSmith shows me the complete trace: which node failed, what the state was, what the LLM returned, and how long each step took. It's like Chrome DevTools for AI applications. In production, I use it to monitor latency, track costs, and catch issues like stale data or LLM hallucinations. Without it, debugging agent failures would be painful—I'd be adding print statements everywhere."

---

### Q: "Couldn't you build this without LangChain/LangGraph?"

**A:** "Technically yes, but I'd be reinventing the wheel. LangChain handles provider switching, retry logic, tool binding, and output parsing—all standard patterns. LangGraph gives me a state machine framework with visualization. If I built from scratch, I'd spend weeks building infrastructure instead of focusing on the manufacturing logic. Plus, LangChain/LangGraph have battle-tested error handling and a large community. For a production system, using a mature framework is the right choice."

---

## Summary Table

| Tool | Purpose | Your Use Case | Alternative |
|------|---------|---------------|-------------|
| **LangChain** | LLM app toolkit | Tool binding, Pydantic parsing, provider abstraction | Raw OpenAI/Anthropic SDK (more code) |
| **LangGraph** | Agent orchestration | 6-agent workflow with cycles (Follow-Up loops) | Custom state machine (more complex) |
| **LangSmith** | Debugging/monitoring | Trace failures, monitor latency, track costs | Print statements + logs (painful) |

---

## Code Example: Your 6-Agent System

```python
from langgraph.graph import StateGraph
from langchain.chat_models import ChatOpenAI
from langchain.tools import tool
from typing import TypedDict

# ===== DEFINE STATE =====
class AgentState(TypedDict):
    lot_id: str
    risk_score: int
    root_cause: str
    week_bucket: str
    citations: list
    ticket_id: str
    approval_status: str

# ===== DEFINE AGENTS (NODES) =====
def data_quality_agent(state: AgentState) -> AgentState:
    """Validate data freshness"""
    # Great Expectations checks here
    return state

def risk_detection_agent(state: AgentState) -> AgentState:
    """Calculate risk score (NOT LLM)"""
    risk_score = calculate_risk_score(state["lot_id"])
    return {"risk_score": risk_score}

def cause_classifier_agent(state: AgentState) -> AgentState:
    """Classify root cause with LLM + RAG"""
    llm = ChatOpenAI(model="gpt-4", temperature=0.1)
    # RAG retrieval + LLM classification
    root_cause = llm_classify(state["risk_score"])
    return {"root_cause": root_cause}

@tool
def create_cmms_ticket(tool_id: str) -> str:
    """Create CMMS ticket"""
    return cmms_api.create(tool_id)

def follow_up_agent(state: AgentState) -> AgentState:
    """Create ticket and ping maintenance"""
    ticket_id = create_cmms_ticket.invoke(state["root_cause"])
    return {"ticket_id": ticket_id}

def trade_off_engine(state: AgentState) -> AgentState:
    """OR-Tools optimization (NOT LLM)"""
    recommendation = or_tools_optimize(state)
    return {"recommendation": recommendation}

def action_executor(state: AgentState) -> AgentState:
    """Execute approved action"""
    mes_api.update_priority(state["lot_id"])
    return state

# ===== BUILD GRAPH =====
graph = StateGraph(AgentState)

# Add nodes
graph.add_node("data_quality", data_quality_agent)
graph.add_node("detect", risk_detection_agent)
graph.add_node("classify", cause_classifier_agent)
graph.add_node("follow_up", follow_up_agent)
graph.add_node("trade_off", trade_off_engine)
graph.add_node("action", action_executor)

# Add edges
graph.set_entry_point("data_quality")
graph.add_edge("data_quality", "detect")

# Conditional: only classify if high risk
def route_after_detect(state: AgentState) -> str:
    return "classify" if state["risk_score"] > 70 else "END"

graph.add_conditional_edges("detect", route_after_detect)

graph.add_edge("classify", "follow_up")
graph.add_edge("follow_up", "trade_off")

# Conditional: only act if feasible
def route_after_trade_off(state: AgentState) -> str:
    return "action" if state["recommendation"] != "INFEASIBLE" else "END"

graph.add_conditional_edges("trade_off", route_after_trade_off)

graph.add_edge("action", "END")

# ===== COMPILE AND RUN =====
app = graph.compile()

# Run with LangSmith tracing
result = app.invoke(
    {"lot_id": "ABC-123"},
    config={"callbacks": [langsmith_callback]}
)
```

---

## Key Takeaway

**LangChain** = Tools to build LLM apps  
**LangGraph** = Framework to orchestrate agents with loops  
**LangSmith** = Debugger to see what's happening

**For interview:** "I use LangChain for tool binding and Pydantic parsing, LangGraph for the cyclic agent workflow, and LangSmith for production monitoring and debugging."

You're ready! 🚀
