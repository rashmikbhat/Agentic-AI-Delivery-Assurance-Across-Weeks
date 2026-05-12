# Pydantic Explained - Data Validation and Structured Output

## TL;DR

**Pydantic** = Type-safe data validation for Python (like TypeScript but for Python data)

**Think of it like:**
- Regular Python dict = Wild west (any data, no rules)
- Pydantic = Airport security (validates everything before it enters)

---

## What Problem Does Pydantic Solve?

### Without Pydantic (Unstructured LLM Output)

```python
# LLM returns text
llm_response = llm.invoke("Classify the root cause...")

# You get raw text (or JSON string)
response_text = """
{
  "root_cause": "TOOL_DOWNTIME",
  "confidence": "high",
  "evidence": "Tool Litho-3 down for 2 hours"
}
"""

# Parse JSON manually
import json
data = json.loads(response_text)

# Now the pain begins...
root_cause = data["root_cause"]  # What if key is misspelled?
confidence = data["confidence"]  # "high" is a string, not a number!
evidence = data["evidence"]      # What if this is a list, not string?

# You write validation manually
if not isinstance(confidence, float):
    if confidence == "high":
        confidence = 0.9
    elif confidence == "medium":
        confidence = 0.6
    # ... endless if/else

# What if LLM returns this?
{
  "rootCause": "TOOL_DOWNTIME",  # Wrong key name!
  "confidence": 1.5,              # Invalid value (>1.0)!
  "evidence": null                # Missing data!
}
# Your code crashes or produces garbage
```

**Problems:**
- ❌ No type checking (confidence is string, not float)
- ❌ No validation (confidence=1.5 is invalid)
- ❌ No required field checking (evidence missing)
- ❌ Manual parsing and error handling
- ❌ Inconsistent field names (rootCause vs root_cause)

---

### With Pydantic (Structured Output)

```python
from pydantic import BaseModel, Field, validator

class RootCauseAnalysis(BaseModel):
    root_cause: str = Field(
        description="Root cause category from [TOOL_DOWNTIME, SUPPLY_SHORTAGE, QUALITY_ISSUE]"
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score between 0 and 1"
    )
    evidence: list[str] = Field(
        min_items=1,
        description="List of supporting evidence"
    )
    
    @validator('root_cause')
    def validate_category(cls, v):
        allowed = ["TOOL_DOWNTIME", "SUPPLY_SHORTAGE", "QUALITY_ISSUE"]
        if v not in allowed:
            raise ValueError(f"root_cause must be one of {allowed}")
        return v

# Use with LLM
from langchain.output_parsers import PydanticOutputParser

parser = PydanticOutputParser(pydantic_object=RootCauseAnalysis)

# LLM prompt includes schema
prompt = f"""
Classify the root cause.

{parser.get_format_instructions()}
"""

response = llm.invoke(prompt)
result = parser.parse(response)  # Automatically validated!

# Now you have a type-safe object
print(result.confidence)  # Guaranteed to be float between 0-1
print(result.evidence)     # Guaranteed to be list of strings
```

**Benefits:**
- ✅ Type checking (confidence must be float)
- ✅ Validation (confidence must be 0-1)
- ✅ Required fields (evidence can't be missing)
- ✅ Automatic parsing and error messages
- ✅ Consistent field names (snake_case)
- ✅ IDE autocomplete (result.confidence, not result["confidence"])

---

## Core Pydantic Concepts

### 1. **BaseModel** (The Foundation)

```python
from pydantic import BaseModel

class Lot(BaseModel):
    lot_id: str
    current_step: str
    quantity: int
    priority: int

# Create instance
lot = Lot(
    lot_id="ABC-123",
    current_step="Lithography",
    quantity=25,
    priority=1
)

# Access fields
print(lot.lot_id)      # "ABC-123"
print(lot.quantity)    # 25

# Convert to dict
lot.dict()
# {'lot_id': 'ABC-123', 'current_step': 'Lithography', 'quantity': 25, 'priority': 1}

# Convert to JSON
lot.json()
# '{"lot_id": "ABC-123", "current_step": "Lithography", "quantity": 25, "priority": 1}'
```

**Key Point:** BaseModel = data class with automatic validation

---

### 2. **Field** (Constraints and Metadata)

```python
from pydantic import BaseModel, Field

class RiskScore(BaseModel):
    score: int = Field(
        ge=0, le=100,           # ge = greater or equal, le = less or equal
        description="Risk score from 0 to 100"
    )
    lot_id: str = Field(
        min_length=5, max_length=20,
        description="Lot identifier"
    )
    timestamp: str = Field(
        regex=r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z",
        description="ISO 8601 timestamp"
    )

# Valid
risk = RiskScore(
    score=85,
    lot_id="ABC-123",
    timestamp="2024-05-10T14:30:00Z"
)

# Invalid - raises ValidationError
risk = RiskScore(
    score=150,              # Error: score must be <= 100
    lot_id="AB",            # Error: lot_id too short
    timestamp="2024-05-10"  # Error: doesn't match regex
)
```

**Common Field Constraints:**
- `ge`, `le` - Greater/less than or equal
- `gt`, `lt` - Greater/less than (strict)
- `min_length`, `max_length` - String/list length
- `regex` - Pattern matching
- `min_items`, `max_items` - List length
- `description` - For LLM prompts and docs

---

### 3. **Validators** (Custom Logic)

```python
from pydantic import BaseModel, validator

class LotUpdate(BaseModel):
    lot_id: str
    current_step: str
    next_step: str
    
    @validator('lot_id')
    def lot_id_must_be_uppercase(cls, v):
        if not v.isupper():
            raise ValueError('lot_id must be uppercase')
        return v
    
    @validator('next_step')
    def validate_step_transition(cls, v, values):
        current = values.get('current_step')
        
        # Define valid transitions
        transitions = {
            'Lithography': ['Etch', 'Hold'],
            'Etch': ['Deposition', 'Hold'],
            'Deposition': ['CMP', 'Hold']
        }
        
        if current in transitions and v not in transitions[current]:
            raise ValueError(f'Invalid transition from {current} to {v}')
        
        return v

# Valid
update = LotUpdate(
    lot_id="ABC-123",
    current_step="Lithography",
    next_step="Etch"
)

# Invalid
update = LotUpdate(
    lot_id="abc-123",           # Error: not uppercase
    current_step="Lithography",
    next_step="Deposition"      # Error: invalid transition
)
```

**Key Point:** Validators = custom business logic validation

---

### 4. **Optional and Default Values**

```python
from pydantic import BaseModel, Field
from typing import Optional

class Alert(BaseModel):
    lot_id: str
    message: str
    severity: str = "MEDIUM"           # Default value
    acknowledged: bool = False          # Default value
    assigned_to: Optional[str] = None   # Optional (can be None)
    
# Required: lot_id, message
# Optional: severity (defaults to "MEDIUM"), acknowledged (defaults to False), assigned_to (can be None)

alert = Alert(
    lot_id="ABC-123",
    message="High risk detected"
)

print(alert.severity)      # "MEDIUM" (default)
print(alert.assigned_to)   # None (optional)
```

---

### 5. **Nested Models** (Complex Structures)

```python
from pydantic import BaseModel
from typing import List

class Evidence(BaseModel):
    source: str
    observation: str
    timestamp: str

class RootCauseAnalysis(BaseModel):
    root_cause: str
    confidence: float
    evidence: List[Evidence]  # List of Evidence objects

# Create nested structure
analysis = RootCauseAnalysis(
    root_cause="TOOL_DOWNTIME",
    confidence=0.92,
    evidence=[
        Evidence(
            source="equipment_status",
            observation="Litho-3 DOWN since 14:00",
            timestamp="2024-05-10T14:15:00Z"
        ),
        Evidence(
            source="wip_snapshot",
            observation="15 lots queued at Litho step",
            timestamp="2024-05-10T14:20:00Z"
        )
    ]
)

# Access nested data
print(analysis.evidence[0].observation)
# "Litho-3 DOWN since 14:00"
```

---

## Pydantic in Your Design

### 1. **Cause Classifier Output**

```python
from pydantic import BaseModel, Field
from typing import List, Literal

class RootCauseAnalysis(BaseModel):
    """Output schema for Cause Classifier agent"""
    
    root_cause: Literal["TOOL_DOWNTIME", "SUPPLY_SHORTAGE", "QUALITY_ISSUE", "CAPACITY_CONSTRAINT"] = Field(
        description="Root cause category"
    )
    
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score (0-1)"
    )
    
    reasoning: str = Field(
        min_length=20,
        description="Explanation of classification"
    )
    
    evidence: List[str] = Field(
        min_items=1,
        description="Supporting evidence from data"
    )
    
    suggested_action: str = Field(
        description="Recommended next step"
    )
    
    week_bucket: Literal["W1", "W2", "W3", "W4"] = Field(
        description="Which week horizon this affects"
    )

# Use with LangChain
from langchain.output_parsers import PydanticOutputParser

parser = PydanticOutputParser(pydantic_object=RootCauseAnalysis)

# LLM prompt
prompt = f"""
You are a root cause classifier for semiconductor manufacturing.

Context: Lot ABC-123 has risk score 87. Equipment Litho-3 is down.

Classify the root cause.

{parser.get_format_instructions()}
"""

response = llm.invoke(prompt)
result = parser.parse(response)

# Guaranteed structure
assert isinstance(result.confidence, float)
assert 0.0 <= result.confidence <= 1.0
assert result.root_cause in ["TOOL_DOWNTIME", "SUPPLY_SHORTAGE", "QUALITY_ISSUE", "CAPACITY_CONSTRAINT"]
```

---

### 2. **Trade-Off Engine Input**

```python
from pydantic import BaseModel, Field, validator
from typing import List

class TradeOffRequest(BaseModel):
    """Input schema for Trade-Off Engine"""
    
    lot_id: str = Field(regex=r"^[A-Z0-9\-]{5,20}$")
    current_step: str
    root_cause: str
    risk_score: int = Field(ge=0, le=100)
    
    alternatives: List[str] = Field(
        min_items=1,
        description="List of possible actions (expedite, defer, split, etc.)"
    )
    
    constraints: dict = Field(
        description="Constraints like max_cost, max_delay_days"
    )
    
    @validator('alternatives')
    def validate_alternatives(cls, v):
        allowed = ["EXPEDITE", "DEFER", "SPLIT_LOT", "REROUTE", "NO_ACTION"]
        for alt in v:
            if alt not in allowed:
                raise ValueError(f"Alternative {alt} not in {allowed}")
        return v

# Use in Trade-Off Engine
request = TradeOffRequest(
    lot_id="ABC-123",
    current_step="Lithography",
    root_cause="TOOL_DOWNTIME",
    risk_score=87,
    alternatives=["EXPEDITE", "REROUTE"],
    constraints={"max_cost": 50000, "max_delay_days": 2}
)

# Pass to OR-Tools optimizer
solution = or_tools_optimize(request)
```

---

### 3. **Action Executor Output**

```python
from pydantic import BaseModel, Field
from datetime import datetime

class ActionResult(BaseModel):
    """Output schema for Action Executor"""
    
    action_id: str
    action_type: str
    lot_id: str
    timestamp: datetime
    
    status: Literal["SUCCESS", "FAILED", "PARTIAL"] = Field(
        description="Execution status"
    )
    
    details: dict = Field(
        description="Action-specific details (e.g., new priority, rerouted step)"
    )
    
    rollback_possible: bool = Field(
        description="Whether this action can be undone"
    )
    
    audit_log_hash: str = Field(
        regex=r"^[a-f0-9]{64}$",
        description="SHA-256 hash for audit chain"
    )

# Create action result
result = ActionResult(
    action_id="act_001",
    action_type="EXPEDITE_LOT",
    lot_id="ABC-123",
    timestamp=datetime.now(),
    status="SUCCESS",
    details={"old_priority": 3, "new_priority": 1},
    rollback_possible=True,
    audit_log_hash="a1b2c3d4e5f6..." # 64 hex chars
)

# Save to database (validated structure)
db.save_action_result(result.dict())
```

---

## Pydantic + LangChain Integration

### How It Works

```python
from langchain.chat_models import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

# 1. Define schema
class RootCause(BaseModel):
    category: str = Field(description="Root cause category")
    confidence: float = Field(ge=0.0, le=1.0)

# 2. Create parser
parser = PydanticOutputParser(pydantic_object=RootCause)

# 3. Get format instructions (this is the magic!)
instructions = parser.get_format_instructions()
print(instructions)
```

**Output:**
```
The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {"properties": {"foo": {"title": "Foo", "description": "a list of strings", "type": "array", "items": {"type": "string"}}}, "required": ["foo"]}
the object {"foo": ["bar", "baz"]} is a well-formatted instance of the schema. The object {"properties": {"foo": ["bar", "baz"]}} is not well-formatted.

Here is the output schema:
{
  "properties": {
    "category": {
      "title": "Category",
      "description": "Root cause category",
      "type": "string"
    },
    "confidence": {
      "title": "Confidence",
      "description": "",
      "minimum": 0.0,
      "maximum": 1.0,
      "type": "number"
    }
  },
  "required": ["category", "confidence"]
}
```

**Key Point:** LLM sees the exact schema and produces JSON that matches!

---

### Full Example

```python
from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List

# Schema
class RootCauseAnalysis(BaseModel):
    root_cause: str = Field(description="Root cause category")
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: List[str] = Field(description="Supporting evidence")

# Parser
parser = PydanticOutputParser(pydantic_object=RootCauseAnalysis)

# Prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a root cause classifier."),
    ("human", "Risk score: {risk_score}. Tool status: {tool_status}. Classify the root cause.\n\n{format_instructions}")
])

# Chain
llm = ChatOpenAI(model="gpt-4", temperature=0.1)
chain = prompt | llm | parser

# Invoke
result = chain.invoke({
    "risk_score": 87,
    "tool_status": "Litho-3 DOWN",
    "format_instructions": parser.get_format_instructions()
})

# result is now a RootCauseAnalysis object!
print(type(result))  # <class 'RootCauseAnalysis'>
print(result.confidence)  # 0.92 (guaranteed float 0-1)
print(result.evidence)    # ["Litho-3 DOWN since 14:00", ...]
```

---

## Pydantic for Data Validation (Not Just LLM)

### API Request Validation

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI()

class CreateAlertRequest(BaseModel):
    lot_id: str = Field(regex=r"^[A-Z0-9\-]{5,20}$")
    message: str = Field(min_length=10, max_length=500)
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

@app.post("/alerts")
def create_alert(request: CreateAlertRequest):
    # request is automatically validated!
    # If invalid, FastAPI returns 422 error with details
    
    db.save_alert(request.dict())
    return {"status": "created"}
```

**Key Point:** FastAPI uses Pydantic for automatic request validation

---

### Config File Validation

```python
from pydantic import BaseSettings, Field

class AgentConfig(BaseSettings):
    kafka_broker: str = Field(env="KAFKA_BROKER")
    postgres_host: str = Field(env="POSTGRES_HOST")
    risk_threshold: int = Field(ge=0, le=100, default=70)
    llm_model: str = Field(default="gpt-4")
    llm_temperature: float = Field(ge=0.0, le=2.0, default=0.1)
    
    class Config:
        env_file = ".env"

# Load config (validates environment variables!)
config = AgentConfig()

# If KAFKA_BROKER is missing or RISK_THRESHOLD is invalid → raises error
```

---

## Interview Talking Points

### Q: "What is Pydantic and why do you use it?"

**A:** "Pydantic is a data validation library for Python. I use it for structured output from the LLM agents—specifically the Cause Classifier. Without Pydantic, the LLM returns unstructured JSON, and I'd have to manually check if the confidence score is a valid float between 0 and 1, or if required fields are missing. With Pydantic, I define a schema with constraints, and LangChain automatically validates the LLM output. If the LLM hallucinates and returns confidence=1.5, Pydantic raises a validation error immediately, so I can retry with a better prompt. It's type safety for LLM outputs."

---

### Q: "Couldn't you just parse JSON manually?"

**A:** "Technically yes, but I'd be reinventing the wheel. Pydantic handles type coercion, nested validation, regex patterns, and custom validators. If the LLM returns `confidence: "high"` instead of `0.9`, Pydantic's error message tells me exactly what went wrong, so I can fix the prompt. Manual parsing means writing hundreds of lines of if/else for every field. Plus, Pydantic integrates natively with LangChain and FastAPI, so it's the standard for production LLM apps."

---

### Q: "What if the LLM returns invalid data?"

**A:** "Pydantic raises a `ValidationError` with details about what failed. I catch that error and either retry with a refined prompt or log it as a failure. For example, if the Cause Classifier returns an unknown root cause category, Pydantic's validator rejects it, and I can retry with a prompt that lists the allowed categories explicitly. This makes the system robust to LLM hallucinations—I never get garbage data downstream."

---

### Q: "Is Pydantic specific to LLMs?"

**A:** "No, Pydantic is general-purpose data validation. In my design, I use it for LLM outputs, but also for API request validation (FastAPI), config file validation (environment variables), and database schemas. For example, the Action Executor validates that the audit_log_hash is exactly 64 hex characters before saving. Pydantic is like TypeScript for Python—it catches bugs at runtime instead of silently accepting bad data."

---

## Pydantic vs Alternatives

| Tool | Use Case | Comparison |
|------|---------|------------|
| **Manual validation** | Write if/else checks | ❌ Tedious, error-prone |
| **JSON Schema** | Schema-only validation | ⚠️ No Python types, less ergonomic |
| **Marshmallow** | Serialization + validation | ⚠️ More verbose than Pydantic |
| **Dataclasses** | Python 3.7+ data classes | ❌ No validation (just structure) |
| **Pydantic** | Type-safe validation | ✅ Best for Python, LLM apps |

**Why Pydantic:** Native LangChain support, FastAPI integration, excellent error messages, active community.

---

## Common Pydantic Patterns

### Pattern 1: Enum Validation
```python
from enum import Enum
from pydantic import BaseModel

class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class Alert(BaseModel):
    severity: Severity

# Now severity is type-checked at runtime
alert = Alert(severity="HIGH")  # OK
alert = Alert(severity="URGENT")  # Error!
```

---

### Pattern 2: Post-Validation
```python
from pydantic import BaseModel, root_validator

class TradeOffResult(BaseModel):
    recommended_action: str
    estimated_cost: float
    estimated_delay_days: int
    is_feasible: bool
    
    @root_validator
    def check_feasibility(cls, values):
        # If cost > $100k, mark as infeasible
        if values.get('estimated_cost', 0) > 100000:
            values['is_feasible'] = False
        return values
```

---

### Pattern 3: Field Aliases (Handle LLM Variations)
```python
from pydantic import BaseModel, Field

class RootCause(BaseModel):
    root_cause: str = Field(alias="rootCause")  # LLM might use camelCase
    confidence: float = Field(alias="conf")      # LLM might abbreviate

# Now Pydantic accepts either snake_case or camelCase
```

---

## Summary

**Pydantic** = Type-safe data validation for Python, critical for LLM structured output

**Key Benefits:**
- ✅ Type checking (confidence must be float)
- ✅ Validation (confidence must be 0-1)
- ✅ Required fields (evidence can't be missing)
- ✅ Custom validators (business logic)
- ✅ Automatic parsing (JSON → Python object)
- ✅ IDE autocomplete (result.confidence, not result["confidence"])
- ✅ Native LangChain support

**In Your Design:**
- Cause Classifier structured output (root cause, confidence, evidence)
- Trade-Off Engine input validation (constraints, alternatives)
- Action Executor output (audit log hash, status)
- API request validation (FastAPI endpoints)
- Config validation (environment variables)

**One-liner for interview:**
> "I use Pydantic for structured LLM output because it validates that the Cause Classifier returns the right schema—if the LLM hallucinates a confidence score of 1.5, Pydantic catches it immediately instead of letting bad data propagate downstream."

You're ready! 🚀
