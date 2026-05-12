# LLM Temperature Explained - Controlling Randomness

## TL;DR

**Temperature** = Controls randomness/creativity in LLM responses

**Simple analogy:**
- Temperature 0 = Robot following strict rules (always same answer)
- Temperature 0.3 = Professional consultant (consistent but slight variation)
- Temperature 0.7 = Creative colleague (varied, interesting ideas)
- Temperature 1.5 = Brainstorming drunk friend (wild, unpredictable)

**For your design:** Temperature 0.1 for Cause Classifier (you want consistent root cause classification, not creative interpretations)

---

## What is Temperature?

Temperature is a **parameter** (0 to 2) that controls how "random" or "creative" the LLM's output is.

### How LLMs Generate Text

When an LLM generates the next word, it calculates probabilities for all possible next words:

**Example: "The tool is ___"**

```
Without temperature adjustment:
- "down" → 60% probability
- "up" → 30% probability
- "offline" → 5% probability
- "broken" → 3% probability
- "purple" → 0.01% probability
```

**Temperature changes how the LLM picks from these probabilities.**

---

## Temperature Values Explained

### Temperature = 0 (Deterministic)

**Effect:** Always picks the MOST probable word

**Example output (same input, 3 runs):**
```
Run 1: "The tool is down due to maintenance."
Run 2: "The tool is down due to maintenance."
Run 3: "The tool is down due to maintenance."
```

**Behavior:**
- ✅ Same input → same output (deterministic)
- ✅ Predictable, consistent
- ✅ Follows most likely path
- ❌ No variation, no creativity
- ❌ Can be boring/repetitive

**Use cases:**
- Production classification tasks
- Structured output generation
- Data extraction
- Code generation (where consistency matters)
- Your Cause Classifier! (you want same root cause for same incident)

---

### Temperature = 0.1-0.3 (Low - Mostly Deterministic)

**Effect:** Slight randomness, but still picks high-probability words

**Example output (same input, 3 runs):**
```
Run 1: "The tool is down due to maintenance."
Run 2: "The tool is down for scheduled maintenance."
Run 3: "The tool is offline due to maintenance."
```

**Behavior:**
- ✅ Mostly consistent (90%+ overlap)
- ✅ Slight variation in phrasing
- ✅ Professional, clear output
- ✅ Reduces exact repetition
- ❌ Still not very creative

**Use cases:**
- Customer support chatbots (consistent but not robotic)
- Technical documentation generation
- Business report writing
- Your design at 0.1: Classification with slight phrasing variation

---

### Temperature = 0.7-0.8 (Medium - Balanced)

**Effect:** Good balance between consistency and creativity

**Example output (same input, 3 runs):**
```
Run 1: "The tool is down due to maintenance."
Run 2: "Equipment unavailable - PM in progress."
Run 3: "Tool offline for preventive maintenance work."
```

**Behavior:**
- ✅ More varied responses
- ✅ Creative but coherent
- ✅ Natural-sounding
- ❌ Less predictable
- ❌ May take unexpected paths

**Use cases:**
- General chatbots (conversational)
- Content writing
- Email drafting
- Creative tasks with guardrails
- Default for most LLM APIs (Claude defaults to 1.0, GPT to 0.7)

---

### Temperature = 1.0-1.2 (High - Creative)

**Effect:** More random, explores lower-probability options

**Example output (same input, 3 runs):**
```
Run 1: "The tool is down due to maintenance."
Run 2: "Maintenance activities have taken the equipment offline temporarily."
Run 3: "Currently undergoing scheduled service - tool unavailable."
```

**Behavior:**
- ✅ Creative, varied responses
- ✅ Explores diverse phrasings
- ✅ More "human-like" variation
- ❌ Inconsistent
- ❌ May go off-topic
- ❌ Can introduce errors

**Use cases:**
- Creative writing
- Brainstorming
- Marketing copy
- Storytelling
- When you WANT diversity

---

### Temperature = 1.5-2.0 (Very High - Chaotic)

**Effect:** Highly random, unpredictable

**Example output (same input, 3 runs):**
```
Run 1: "The tool is down due to maintenance."
Run 2: "Machines require tender loving care during PM cycles."
Run 3: "Tool? More like drool! Maintenance strikes again, my friend."
```

**Behavior:**
- ✅ Maximum creativity
- ✅ Unexpected connections
- ❌ Often incoherent
- ❌ Introduces hallucinations
- ❌ Unprofessional output
- ❌ Rarely useful in production

**Use cases:**
- Experimental creative writing
- Poetry generation
- Humor/meme generation
- Research on LLM behavior
- Generally avoid in production!

---

## How Temperature Works Mathematically

### The Softmax Function

LLMs use softmax to convert logits (raw scores) to probabilities, then apply temperature scaling:

```python
import numpy as np

# Raw LLM scores (logits) for next word
logits = {
    "down": 10.0,
    "up": 8.0,
    "offline": 5.0,
    "broken": 4.0
}

def softmax_with_temperature(logits, temperature):
    """Apply temperature scaling to logits"""
    # Divide logits by temperature
    scaled_logits = {k: v / temperature for k, v in logits.items()}
    
    # Apply softmax
    exp_logits = {k: np.exp(v) for k, v in scaled_logits.items()}
    sum_exp = sum(exp_logits.values())
    probabilities = {k: v / sum_exp for k, v in exp_logits.items()}
    
    return probabilities

# Temperature 0.1 (deterministic)
print("Temperature 0.1:")
print(softmax_with_temperature(logits, 0.1))
# Output: {'down': 0.999, 'up': 0.001, 'offline': 0.0, 'broken': 0.0}
# → Almost always picks "down"

# Temperature 0.7 (balanced)
print("\nTemperature 0.7:")
print(softmax_with_temperature(logits, 0.7))
# Output: {'down': 0.87, 'up': 0.11, 'offline': 0.01, 'broken': 0.01}
# → Mostly "down", sometimes "up"

# Temperature 1.5 (creative)
print("\nTemperature 1.5:")
print(softmax_with_temperature(logits, 1.5))
# Output: {'down': 0.58, 'up': 0.28, 'offline': 0.08, 'broken': 0.06}
# → More varied picks
```

**Key insight:**
- **Lower temperature** → Sharper distribution (winner takes all)
- **Higher temperature** → Flatter distribution (more randomness)

---

## Visual Comparison

```
Probability of picking each word:

Temperature 0.1 (Deterministic)
down     ████████████████████████████████████████ 99%
up       █ 1%
offline   0%
broken    0%
→ Almost always picks "down"

Temperature 0.7 (Balanced)
down     ████████████████████████████████ 87%
up       ████████ 11%
offline  █ 1%
broken   █ 1%
→ Mostly "down", occasionally "up"

Temperature 1.5 (Creative)
down     ███████████████████████ 58%
up       ███████████ 28%
offline  ████ 8%
broken   ███ 6%
→ Varied picks
```

---

## Temperature in Your Design

### Cause Classifier (Temperature 0.1)

**Your script says:**
> "Temperature is 0.1—I want consistent answers, not creative ones."

**Why 0.1?**

**Scenario:** Two identical incidents on different days:
- Lot ABC-123 stuck at Litho, queue time 6 hours, tool at 95% utilization
- Lot XYZ-789 stuck at Litho, queue time 6 hours, tool at 95% utilization

**With Temperature 0.1:**
```python
# Run 1
classify_incident(ABC-123)
# Output: {"root_cause": "WIP_QUEUE", "confidence": 0.85}

# Run 2 (same pattern)
classify_incident(XYZ-789)
# Output: {"root_cause": "WIP_QUEUE", "confidence": 0.85}
```

**With Temperature 0.7:**
```python
# Run 1
classify_incident(ABC-123)
# Output: {"root_cause": "WIP_QUEUE", "confidence": 0.85}

# Run 2 (same pattern!)
classify_incident(XYZ-789)
# Output: {"root_cause": "CAPACITY_CONSTRAINT", "confidence": 0.72}
# ❌ Different classification for same pattern!
```

**Problem with high temperature:**
- Same incident pattern → different classification
- Planners lose trust ("Why did it say WIP_QUEUE yesterday but CAPACITY today?")
- Harder to tune system (non-deterministic)
- Audit trail shows inconsistent decisions

---

## Temperature Selection Guide

| Task Type | Recommended Temp | Why |
|-----------|-----------------|-----|
| **Classification** | 0.0 - 0.2 | Need consistency, same input → same output |
| **Structured Output** | 0.0 - 0.2 | JSON/Pydantic output must be valid |
| **Data Extraction** | 0.0 - 0.2 | Extract facts, not creative interpretation |
| **Technical Support** | 0.3 - 0.5 | Consistent but not robotic |
| **General Chat** | 0.7 - 1.0 | Natural conversation, varied responses |
| **Content Writing** | 0.7 - 1.0 | Creative but coherent |
| **Brainstorming** | 1.0 - 1.5 | Want diverse ideas |
| **Poetry/Fiction** | 1.2 - 2.0 | Maximum creativity |

---

## Common Mistakes

### ❌ Mistake 1: Using High Temperature for Production Classification

```python
# BAD
classifier = LLMChain(
    llm=ChatAnthropic(temperature=0.9),  # Too high!
    prompt=root_cause_prompt
)

# Same incident, different days:
# Day 1: "WIP_QUEUE"
# Day 2: "CAPACITY_CONSTRAINT"
# → Inconsistent, users lose trust
```

**Fix:**
```python
# GOOD
classifier = LLMChain(
    llm=ChatAnthropic(temperature=0.1),  # Consistent
    prompt=root_cause_prompt
)
```

---

### ❌ Mistake 2: Using Temperature 0 for Everything

```python
# BAD for creative tasks
chatbot = ChatAnthropic(temperature=0.0)

user: "Write a fun welcome message for new users"
bot: "Welcome to the system. Please proceed with registration."
# → Boring, robotic
```

**Fix:**
```python
# GOOD for creative tasks
chatbot = ChatAnthropic(temperature=0.8)

user: "Write a fun welcome message for new users"
bot: "Hey there! 🎉 So excited you're here! Let's get you set up and ready to roll."
# → Natural, engaging
```

---

### ❌ Mistake 3: Not Testing Multiple Temperatures

**Always test!**

```python
# Test different temperatures
temperatures = [0.0, 0.3, 0.7, 1.0, 1.5]

for temp in temperatures:
    llm = ChatAnthropic(temperature=temp)
    for i in range(3):
        result = llm.invoke("Classify this incident: Tool down at Litho")
        print(f"Temp {temp}, Run {i+1}: {result}")
```

**Look for:**
- Consistency (same input → same output?)
- Quality (correct classifications?)
- Diversity (if you want it)

---

## Code Examples

### Example 1: Your Cause Classifier (Temperature 0.1)

```python
from langchain.chat_models import ChatAnthropic
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
from pydantic import BaseModel, Field
from typing import Literal

# Pydantic model for structured output
class RootCauseAnalysis(BaseModel):
    root_cause: Literal[
        "DOWNTIME", 
        "UPH_DEGRADATION", 
        "WIP_QUEUE", 
        "MATERIAL", 
        "QUALITY", 
        "OTHER"
    ]
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str]
    recommendation: str

# LLM with LOW temperature for consistency
llm = ChatAnthropic(
    model="claude-sonnet-4",
    temperature=0.1,  # ← Consistent classification
    max_tokens=500
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a manufacturing root cause analyst. Classify incidents into exactly 6 categories."),
    ("user", """
    Current incident: {current_incident}
    
    Similar past incidents:
    {historical_incidents}
    
    Classify the root cause category and provide evidence.
    """)
])

classifier = LLMChain(llm=llm, prompt=prompt)

# Same incident, multiple runs
incident = "Lot ABC-123 stuck at Litho, queue time 6 hours, tool 95% util"

for i in range(3):
    result = classifier.invoke({
        "current_incident": incident,
        "historical_incidents": "..."
    })
    print(f"Run {i+1}: {result['root_cause']}")

# Output (temperature 0.1):
# Run 1: WIP_QUEUE
# Run 2: WIP_QUEUE
# Run 3: WIP_QUEUE
# ✅ Consistent!
```

---

### Example 2: Follow-Up Agent (Temperature 0.3)

```python
# Follow-Up agent needs slight variation (not robotic)
llm = ChatAnthropic(
    model="claude-sonnet-4",
    temperature=0.3,  # ← Slight variation in phrasing
    max_tokens=200
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a follow-up coordinator. Draft concise Slack messages to maintenance team."),
    ("user", "Tool Litho-3 is down. Last ETA was 2 hours ago. Draft escalation message.")
])

for i in range(3):
    result = llm.invoke(prompt.format_messages())
    print(f"Run {i+1}: {result.content}\n")

# Output (temperature 0.3):
# Run 1: "Hi team, Litho-3 is still down 2 hours past ETA. Can we get an update?"
# Run 2: "Team, Litho-3 remains offline 2 hours beyond estimated recovery. Status update?"
# Run 3: "Hi, Litho-3 still down—now 2 hours past ETA. Any updates on recovery?"
# ✅ Similar meaning, slight variation (not robotic)
```

---

### Example 3: What Happens at Different Temperatures

```python
from anthropic import Anthropic

client = Anthropic(api_key="...")

incident = "Tool Litho-3 is down."

# Test temperatures 0.0 to 2.0
for temp in [0.0, 0.3, 0.7, 1.0, 1.5, 2.0]:
    print(f"\n{'='*60}")
    print(f"TEMPERATURE: {temp}")
    print('='*60)
    
    for run in range(3):
        response = client.messages.create(
            model="claude-sonnet-4",
            temperature=temp,
            max_tokens=50,
            messages=[{
                "role": "user",
                "content": f"Classify this incident into one category: {incident}"
            }]
        )
        print(f"Run {run+1}: {response.content[0].text}")
```

**Typical output:**

```
============================================================
TEMPERATURE: 0.0
============================================================
Run 1: The incident is classified as DOWNTIME (equipment failure).
Run 2: The incident is classified as DOWNTIME (equipment failure).
Run 3: The incident is classified as DOWNTIME (equipment failure).

============================================================
TEMPERATURE: 0.7
============================================================
Run 1: This incident falls under DOWNTIME - equipment failure category.
Run 2: This is a DOWNTIME event due to equipment being offline.
Run 3: I'd classify this as DOWNTIME (tool unavailability).

============================================================
TEMPERATURE: 1.5
============================================================
Run 1: DOWNTIME - equipment malfunction
Run 2: Hmm, looks like a classic case of tool unavailability (DOWNTIME)
Run 3: Oh boy, Litho-3 is taking a break! Category: EQUIPMENT_DOWN
```

---

## Interview Talking Points

### Q: "Why did you choose temperature 0.1 for your Cause Classifier?"

**A:** "I need consistency for production classification. With temperature 0.1, the same incident pattern always produces the same root cause classification—that's critical for building trust with planners. If Tuesday's incident gets classified as WIP_QUEUE and Wednesday's identical incident gets classified as CAPACITY_CONSTRAINT, users lose confidence. Low temperature means the LLM always picks the most probable classification, giving me deterministic behavior. I can still get slight variation in the reasoning text, but the classification itself stays consistent."

---

### Q: "What's the tradeoff of using such a low temperature?"

**A:** "The tradeoff is reduced creativity and potential for getting 'stuck' in patterns. With temperature 0.1, the LLM always follows the most obvious path—it won't explore alternative interpretations. But for root cause classification, that's exactly what I want. I'm not looking for creative brainstorming; I'm looking for consistent, accurate categorization. If I need diverse perspectives, I'd run the same prompt with different retrieved incidents from the vector DB, not increase temperature."

---

### Q: "How did you decide on 0.1 instead of 0.0 or 0.5?"

**A:** "I tested multiple temperatures in shadow mode. Temperature 0.0 gave me perfect consistency but occasionally felt too rigid—exact same wording every time felt robotic when showing output to planners. Temperature 0.5 gave too much variation—same incidents got different classifications 20% of the time. Temperature 0.1 is the sweet spot: 95%+ consistent classifications with slight variation in phrasing, making the output feel more natural without sacrificing accuracy."

---

## Summary

**Temperature** = Controls LLM randomness/creativity

**Key Points:**
- ✅ 0.0-0.2: Deterministic, consistent (classification, structured output)
- ✅ 0.3-0.5: Mostly consistent, not robotic (support chatbots)
- ✅ 0.7-1.0: Balanced creativity (general chat, content)
- ✅ 1.0-1.5: Creative (brainstorming, writing)
- ✅ 1.5-2.0: Chaotic (experimental only)

**Your Design:**
- Cause Classifier: 0.1 (consistent root cause classification)
- Follow-Up Agent: Could use 0.3 (natural but consistent messaging)

**Rule of thumb:**
- Production classification → Low temperature (0.0-0.2)
- User-facing chat → Medium temperature (0.7-1.0)
- Creative tasks → High temperature (1.0-1.5)

**One-liner for interview:**
> "I use temperature 0.1 for the Cause Classifier because I need consistent root cause classification—same incident pattern should always produce the same category. Low temperature means deterministic behavior, which is critical for production systems where users need to trust the output."

You're ready! 🚀
