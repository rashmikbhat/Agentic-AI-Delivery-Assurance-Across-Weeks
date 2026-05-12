# Risk Detection Agent Explained - Custom Python Scoring

## TL;DR

**Risk Detection** = Calculate a risk score (0-100) for each lot to predict if it will miss delivery

**Think of it like:**
- Smoke detector = Detects fire (doesn't tell you what caused it)
- Risk Detection = Detects delivery risk (doesn't tell you WHY - that's the Cause Classifier's job)

**Why NOT an LLM:**
- Speed: Must check 100s of lots in <100ms
- Cost: Checking every lot with LLM = $$$ per refresh
- Explainability: Must show exact calculation (not a black box)

---

## What Problem Does Risk Detection Solve?

### The Problem: Too Much Data, Need to Focus

Imagine your factory has:
- **500 lots** in WIP across W1-W4
- **50 tools** with varying status (up, down, degraded)
- **10 product families** competing for capacity
- **Data refreshing every 2 hours** for W1/W2

**You CAN'T:**
- ❌ Send all 500 lots to LLM for analysis (too slow, too expensive)
- ❌ Alert planners about every lot (alert fatigue)
- ❌ Wait 10 minutes to calculate risk (need real-time)

**You NEED:**
- ✅ Quickly identify which 5-10 lots are HIGH RISK
- ✅ Only analyze those with the Cause Classifier (LLM)
- ✅ Give planners a focused list, not 500 alerts

**Risk Detection = Filter/Triage Agent**

---

## What Does Risk Detection Actually Do?

### Simple Example

**Lot ABC-123:**
- Customer needs it by: Friday 5 PM (W1 delivery)
- Current step: Lithography (step 15 of 25)
- Time remaining: 30 hours
- Time needed to finish: 40 hours (based on route + current tool status)

**Calculation:**
```
Gap = Time needed - Time remaining
Gap = 40 hours - 30 hours = 10 hours BEHIND

Risk Score = 85 (HIGH RISK - likely to miss Friday delivery)
```

**Action:**
- Send to Cause Classifier LLM to understand WHY (tool down? queue? UPH degradation?)
- Alert planner: "Lot ABC-123 at RISK"

---

**Lot DEF-456:**
- Customer needs it by: Next week Monday (W2 delivery)
- Current step: Etch (step 5 of 25)
- Time remaining: 120 hours
- Time needed to finish: 80 hours

**Calculation:**
```
Gap = 80 hours - 120 hours = 40 hours AHEAD of schedule

Risk Score = 10 (LOW RISK - on track)
```

**Action:**
- No alert, no LLM analysis
- Just log it, check again in 2 hours

---

## The Five Risk Factors (Updated for Product Mix)

Risk Detection looks at 5 things:

### 1. OTIF Gap (Schedule Gap) - Uses YOUR ML Model!
**"How far behind or ahead is this lot?"**

```python
# Use YOUR Random Forest model from Lot Tracking Dashboard
time_needed = completion_model.predict(lot_features)  # 40 hours (ML prediction)
time_available = (lot.due_date - now).total_seconds() / 3600  # 30 hours
gap_hours = time_needed - time_available  # 10 hours BEHIND

otif_score = max(0, gap_hours / 10) * 10  # 10 points
```

**Why ML is better:** Your model already learns queue delays, tool degradation, and sequence patterns from 50K+ historical lots.

---

### 2. WIP Position (Progress in Route)
**"How far along in the manufacturing process?"**

```
Current step = 15 of 25 steps (60% complete)
Position score = 60% × 30 = 18 points

Why higher risk when further along?
- Less time to recover if something goes wrong
- More steps already committed
```

---

### 3. Capacity Constraint (Tool Availability)
**"Is the next tool busy or available?"**

```
Next tool group = Lithography
Capacity utilization = 95% (very busy)
Capacity score = 95% × 20 = 19 points

Why high utilization is risky?
- Long queue times
- Less flexibility to expedite
```

---

### 4. Product Mix Competition (NEW - Critical!)
**"How many competing lots AND what's their capacity impact?"**

```python
# OLD (too simple):
competing_lots = 12
mix_score = 12 / 10 × 10 = 12 points

# NEW (product mix aware):
# Different products consume capacity at different rates!
competing_products = get_competing_lots_at_bottleneck(
    tool_group='Lithography',
    week='W1'
)

# Product A: 5 lots × 2.0 hours/unit = 10 hours
# Product B: 4 lots × 1.5 hours/unit = 6 hours  
# Product C: 3 lots × 3.0 hours/unit = 9 hours
# Total demand = 25 hours

# Available capacity this week
available_capacity = 20 hours

# Capacity shortage
capacity_shortage = 25 - 20 = 5 hours OVER capacity

# Score based on shortage severity
mix_score = min(capacity_shortage / available_capacity, 1.0) * 20
# 5/20 = 0.25 → 0.25 × 20 = 5 points

# If THIS lot is Product C (3.0 hours/unit), it's especially at risk
# because it's the "heavy consumer" competing for scarce capacity
if lot.uph < average_uph:  # This product is slower
    mix_score *= 1.5  # Penalty for being capacity-intensive
```

**Why this matters (from case requirements):**
> "Fixing a W1 shortage for one product can consume shared bottleneck capacity and cause W2–W4 misses for other products."

Risk Detection must know:
- How much capacity does THIS lot need?
- How much capacity do COMPETING products need?
- Is there enough capacity for everyone?

---

### 5. Cross-Week Risk (NEW - Critical!)
**"Does fixing THIS lot in W1 harm W2-W4?"**

```python
# Check if expediting this lot would steal capacity from future weeks
def calculate_cross_week_risk(lot, week='W1'):
    # How much capacity would expediting consume?
    expedite_capacity_needed = lot.units_short / lot.uph
    
    # How much capacity is reserved for W2-W4?
    reserved_W2 = get_reserved_capacity(tool_group, 'W2')
    reserved_W3 = get_reserved_capacity(tool_group, 'W3')
    
    # Would expediting violate future commitments?
    if expedite_capacity_needed > reserved_W2:
        cross_week_score = 20  # HIGH RISK - would harm W2
    elif expedite_capacity_needed > reserved_W3:
        cross_week_score = 10  # MEDIUM RISK - would harm W3
    else:
        cross_week_score = 0  # SAFE
    
    return cross_week_score

cross_week_score = calculate_cross_week_risk(lot)
```

**Why this matters:**
- A lot might LOOK high-risk individually
- But expediting it would harm 5 other products in W2
- Risk Detection must flag this!

---

### Updated Total Risk Score

```python
Risk Score = (
    OTIF Gap (ML-based) +
    WIP Position + 
    Capacity Constraint + 
    Product Mix Competition (capacity-aware) +
    Cross-Week Risk
)

Risk Score = 10 + 18 + 19 + 5 + 10 = 62

# Week urgency multiplier
if week == 'W1':
    risk_score *= 1.5  # 62 × 1.5 = 93 (HIGH RISK)
```

**Key Changes:**
1. ✅ OTIF gap uses YOUR ML model (proven 92-94% accuracy)
2. ✅ Product Mix now considers capacity consumption rates (not just count)
3. ✅ NEW: Cross-week risk factor (prevents "fix W1, harm W2")


---

## Why Custom Python (Not LLM)?

### Speed Comparison

**Custom Python with NumPy:**
```python
# Calculate 200 lots at once (vectorized)
risk_scores = (
    otif_gaps * 10 +
    wip_positions * 10 +
    capacity_utils * 10 +
    mix_factors * 10
)
# Time: 50 milliseconds ✅
```

**LLM Approach:**
```python
for lot in 200_lots:
    prompt = f"Assess risk for lot {lot}..."
    risk = llm.invoke(prompt)
# Time: 200 × 2 seconds = 400 seconds = 6.7 minutes ❌
```

---

### Cost Comparison

**Custom Python:**
- Cost: $0 (runs on existing server)

**LLM:**
- Cost: 200 lots × $0.03 = $6 per refresh
- Refreshes: 12/day (every 2 hours)
- Monthly: $6 × 12 × 30 = $2,160/month

**Just for filtering!** Before even doing root cause analysis.

---

### Explainability

**Custom Python shows breakdown:**
```
Lot ABC-123: Risk Score = 88

Breakdown:
✓ OTIF Gap: 10 hours behind → +10 points
✓ WIP Position: 60% complete → +18 points  
✓ Capacity: Litho at 95% → +19 points
✓ Product Mix: 12 competing lots → +12 points
✓ Week Multiplier (W1): 1.5× → Total: 88
```

**LLM = Black box:**
```
Risk Score: 85
Reasoning: "Multiple risk factors indicate..."
(Can't show exact math)
```

---

## The Full Workflow

```
EVERY 2 HOURS (W1/W2):

Step 1: Risk Detection (Custom Python - 50ms)
├─ Get 200 lots from database
├─ Calculate risk scores for ALL
├─ Filter: risk_score > 70
└─ Result: 8 high-risk lots identified

Step 2: Cause Classifier (LLM - ONLY for 8 lots)
├─ For each high-risk lot:
├─ Retrieve similar incidents (Vector DB)
├─ Ask LLM: "What's the root cause?"
└─ Time: 8 × 2 seconds = 16 seconds

Step 3: Follow-Up Agent
└─ Create tickets, alerts for those 8 lots

TOTAL: 50ms + 16s ≈ 16 seconds ✅
```

**Without Risk Detection = Send all 200 to LLM:**
```
200 lots × 2 seconds = 400 seconds = 6.7 minutes ❌
Cost: 200 × $0.03 = $6 per refresh ❌
```

---

## Updated Code Example (Product Mix Aware)

```python
import numpy as np

def calculate_risk_score_with_mix(lot, completion_model, capacity_data):
    """
    Risk Detection with product mix and cross-week awareness
    Uses YOUR ML model + capacity constraints from case requirements
    """
    
    # Factor 1: Schedule gap (YOUR ML MODEL!)
    lot_features = extract_features(lot)  # From your Lot Tracking Dashboard
    time_needed = completion_model.predict([lot_features])[0]  # ML prediction
    time_available = (lot.due_date - pd.Timestamp.now()).total_seconds() / 3600
    gap_hours = time_needed - time_available
    otif_score = max(0, gap_hours / 10) * 10
    
    # Factor 2: WIP Position
    position_score = (lot.current_step / lot.total_steps) * 30
    
    # Factor 3: Capacity Constraint
    capacity_score = lot.next_tool_utilization * 20
    
    # Factor 4: Product Mix Competition (UPDATED - capacity-aware)
    tool_group = lot.next_tool_group
    week = lot.week_bucket
    
    # Get all competing products at this bottleneck
    competing = capacity_data.query(
        f"tool_group == '{tool_group}' and week_bucket == '{week}'"
    )
    
    # Calculate capacity demand vs supply
    total_demand_hours = (competing['units_needed'] / competing['uph']).sum()
    available_hours = competing['available_capacity'].iloc[0]
    capacity_shortage = max(0, total_demand_hours - available_hours)
    
    # Base mix score (how oversubscribed is the bottleneck?)
    mix_score = min(capacity_shortage / available_hours, 1.0) * 15
    
    # Penalty if THIS product is a "heavy consumer" (low UPH)
    avg_uph = competing['uph'].mean()
    if lot.uph < avg_uph:
        mix_score *= 1.3  # Slower products more at risk
    
    # Factor 5: Cross-Week Risk (NEW!)
    cross_week_score = 0
    if week == 'W1':
        # Check if expediting this lot would harm W2
        expedite_hours_needed = lot.units_short / lot.uph
        reserved_W2 = capacity_data.query(
            f"tool_group == '{tool_group}' and week_bucket == 'W2'"
        )['reserved_capacity'].iloc[0]
        
        if expedite_hours_needed > reserved_W2 * 0.5:
            cross_week_score = 15  # Would consume >50% of W2 reserve
        elif expedite_hours_needed > reserved_W2 * 0.25:
            cross_week_score = 8   # Would consume >25% of W2 reserve
    
    # Total Risk Score
    risk_score = (
        otif_score + 
        position_score + 
        capacity_score + 
        mix_score + 
        cross_week_score
    )
    
    # Week urgency multiplier
    if week == 'W1':
        risk_score *= 1.5
    
    return min(risk_score, 100)  # Cap at 100


# Example usage
risk_score = calculate_risk_score_with_mix(
    lot=lot_ABC_123,
    completion_model=your_random_forest_model,  # From Lot Tracking Dashboard
    capacity_data=capacity_vs_demand_df
)

# Output: 
# {
#   'risk_score': 88,
#   'breakdown': {
#     'otif_score': 10,      # ML predicted 10 hours behind
#     'position_score': 18,   # 60% complete
#     'capacity_score': 19,   # 95% utilized
#     'mix_score': 6.5,       # Bottleneck oversubscribed by 25%
#     'cross_week_score': 15, # Would harm W2 if expedited
#     'week_multiplier': 1.5
#   }
# }
```

---

## Interview Talking Points

### Q: "What does the Risk Detection Agent do?"

**A:** "Risk Detection is a triage agent that quickly calculates a risk score for every lot in W1 and W2. It combines my proven ML model from the Lot Tracking Dashboard—which predicts completion times with 92-94% accuracy—with capacity constraints and product mix analysis.

It looks at five factors: schedule gap using ML predictions, WIP position, capacity utilization, product mix competition accounting for different UPH rates, and cross-week risk to prevent 'fix W1 but harm W2' scenarios. For example, if Product A consumes capacity at 2 hours per unit and Product B at 1.5 hours, and they're both competing for the same bottleneck, Risk Detection calculates the capacity shortage and flags which lots are most at risk.

It runs in under 100 milliseconds for 200 lots and scores 0 to 100. Anything above 70 goes to the Cause Classifier LLM to understand WHY it's at risk. The key is it's product mix aware—it knows that expediting one lot can harm other products, which the case requirements explicitly call out."

---

### Q: "Why not just use an LLM for risk detection?"

**A:** "Three reasons: speed, cost, and explainability. I have 200 lots refreshing every 2 hours. An LLM takes 2 seconds per lot, so that's 6.7 minutes plus about $6 per refresh. Custom Python does all 200 lots in 50 milliseconds for free. More importantly, I need explainability—planners need to see exactly why a lot got a score of 88: it's 10 hours behind, at 60% complete, and the next tool is at 95% capacity. With an LLM, that's a black box. I save the LLM for where it adds value—understanding root causes, not scoring math."

---

### Q: "What if your risk scoring formula is wrong?"

**A:** "That's why I start in shadow mode. I run Risk Detection alongside human judgment for the first week, compare the high-risk lots I flagged versus what planners actually care about, and tune the weights. If I'm flagging too many false positives, I increase the threshold from 70 to 80. If I'm missing real issues, I adjust the OTIF gap weight. The advantage of custom Python is I can inspect every calculation and iterate quickly. Once tuned, it's deterministic—same inputs always give the same score."

---

## Comparison: Risk Detection vs Cause Classifier

| Aspect | Risk Detection | Cause Classifier |
|--------|----------------|------------------|
| **Purpose** | WHICH lots are at risk? | WHY are they at risk? |
| **Tech** | Custom Python (NumPy) | LLM + RAG |
| **Speed** | 50ms for 200 lots | 2 seconds per lot |
| **Cost** | $0 | ~$0.03 per call |
| **Input** | WIP + capacity data | Risk score + historical incidents |
| **Output** | Risk score (0-100) | Root cause + evidence |
| **Explainability** | Full breakdown | LLM reasoning |
| **When** | Every 2 hours, all lots | Only high-risk lots |

**They work together:**
- Risk Detection = Smoke detector (detects problem)
- Cause Classifier = Fire inspector (diagnoses cause)

---

## Summary

**Risk Detection Agent** = Fast triage to identify WHICH lots are at risk (NOT why)

**Key Points:**
- ✅ Custom Python (NumPy) - NOT an LLM
- ✅ Four factors: OTIF gap + WIP position + capacity + product mix
- ✅ Runs in <100ms for 200 lots (vs 6.7 minutes with LLM)
- ✅ Free (vs $2,160/month with LLM)
- ✅ Explainable (shows exact calculation)
- ✅ Filters to ~5-10 high-risk lots for LLM analysis
- ✅ Prevents alert fatigue

**In Your Design:**
- Risk Detection = Smoke detector (WHICH lots at risk?)
- Cause Classifier = Fire inspector (WHY at risk?)
- Risk Detection runs FIRST, Cause Classifier ONLY on flagged lots

**One-liner for interview:**
> "Risk Detection is custom Python that calculates a risk score for every lot based on schedule gap, process position, capacity, and competition. It runs in 50 milliseconds and filters 200 lots down to the 5-10 that are actually high-risk, so the LLM only analyzes those—not all 200. It's like a smoke detector that tells you there's a problem, then the LLM figures out why."

---

## Bonus: Your Production ML System (Lot Tracking Dashboard)

### You've Already Solved This Problem!

Your **Lot Tracking Dashboard** already uses ML for time-to-completion prediction:

**Model:** Random Forest Regressor  
**Accuracy:** 92-94% validation  
**Product Families:** HSC, NAND Flash, SSD (product-aware features)  
**Data:** 50,000+ historical records, 10,000+ lot sequences  

**Features Used:**
- Design complexity (historical performance by design)
- Step positioning (Early/Middle/Late in process)
- Sequence intelligence (learned step flow patterns)
- Die count (HSC/NAND) or Market Segment/Density (SSD)
- Statistical baselines (mean/std by design-step combinations)
- Process progress (estimated remaining steps and completion %)

**How It Works:**
```python
# From your model_trainer.py
model = RandomForestRegressor()
features = [
    'DESIGN_ID', 'STEP_ID', 'NUMBER_OF_DIE_IN_PKG',  
    'DESIGN_mean', 'STEP_mean', 'DIE_mean',
    'POSITION_EARLY', 'POSITION_MIDDLE', 'POSITION_LATE',
    # + sequence features
]
model.fit(X_train, y_train)  # y = HOURS_TO_COMPLETION

# Predict for new lots
predicted_hours = model.predict(lot_features)
```

### How This Applies to Risk Detection

**Your existing ML model provides the `time_needed` input:**

```python
# Step 1: Use YOUR ML model to predict time to completion
time_needed = your_completion_model.predict(lot_features)
# Returns: 40 hours (ML prediction)

# Step 2: Calculate time remaining (simple date math)
time_remaining = (lot.due_date - datetime.now()).total_seconds() / 3600
# Returns: 30 hours

# Step 3: Calculate gap
gap = time_needed - time_remaining
# Returns: 10 hours BEHIND

# Step 4: Risk Detection (custom Python)
risk_score = calculate_risk(gap, wip_position, capacity, product_mix)
# Returns: 88 (HIGH RISK)
```

**Combined Architecture:**

```
Historical Data (50K+ records)
    ↓
[Your Random Forest Model] → Predicts time_needed
    ↓
[Risk Detection Agent] → Calculates risk_score
    ↓
[Cause Classifier LLM] → Explains WHY at risk (only high-risk lots)
```

### Updated Interview Answer

**Q: "How do you calculate time needed for Risk Detection?"**

**A:** "Actually, I've already built this in production. I have a Lot Tracking Dashboard that uses a Random Forest model trained on 50,000+ historical lot completions to predict time to completion. It achieves 92-94% validation accuracy across multiple product families and uses 15+ intelligent features including design complexity, step positioning, and sequence learning from 10,000+ historical lot movements.

For this agentic AI design, I'd reuse that same ML model to predict time_needed for each lot. Then Risk Detection is simple Python math: gap equals time_needed minus time_remaining, and the risk score factors in the gap, WIP position, capacity, and product mix. The ML model handles the complex part—learning from historical patterns—and Risk Detection uses that prediction along with current capacity data to triage which lots need LLM analysis.

This is better than a route-based approach because my ML model learns real patterns like queue delays, tool degradation, and product mix effects. It's already in production and proven, so I'm not starting from scratch."

**Confidence booster:** You have a working ML system that solves the hardest part of this case!

You're ready! 🚀

