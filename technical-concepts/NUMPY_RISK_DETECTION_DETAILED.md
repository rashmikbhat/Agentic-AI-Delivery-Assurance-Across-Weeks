# NumPy Risk Detection - Deep Dive

## TL;DR

**NumPy** = Python library for fast array operations (matrix math)

**Why NumPy for Risk Detection?**
- Calculates risk for 200 lots in **50 milliseconds** (vs LLM: 6.7 minutes)
- Vectorized operations = process all lots at once instead of looping
- Deterministic = same inputs always give same output
- Explainable = can show exact calculation breakdown

**Core Concept**: Calculate `risk_score = weighted_sum(5_factors)` for all 200 lots in parallel

---

## What is NumPy?

### Simple Analogy

**Without NumPy (Regular Python Loop):**
```
You have 200 homework assignments to grade.
You grade them ONE at a TIME:
- Assignment 1: Read, calculate score, write grade
- Assignment 2: Read, calculate score, write grade
- Assignment 3: Read, calculate score, write grade
... 200 times

Time: 200 × 2 seconds = 400 seconds = 6.7 minutes
```

**With NumPy (Vectorized):**
```
You have 200 homework assignments to grade.
You grade ALL of them AT ONCE using a formula:
- Stack all 200 assignments
- Apply scoring formula to ALL simultaneously
- Get all 200 grades in one operation

Time: 50 milliseconds (8000× faster!)
```

### Technical Explanation

**NumPy** = Numerical Python library that:
- Stores data in **arrays** (like Excel columns)
- Operates on **entire arrays** at once (not one-by-one)
- Uses **C code** under the hood (Python is slow, C is fast)
- Optimized for **CPU vectorization** (modern CPUs can do multiple operations simultaneously)

---

## How Risk Detection Uses NumPy

### The Five Risk Factors (Recap)

For each lot, we calculate:

1. **OTIF Gap Score** = How far behind schedule? (from ML prediction)
2. **WIP Position Score** = How far through the process? (% complete)
3. **Capacity Score** = How busy is the next tool? (utilization %)
4. **Product Mix Score** = How much competition for capacity? (UPH-weighted)
5. **Cross-Week Score** = Would expediting harm W2-W4? (capacity check)

**Risk Score = (Factor 1 + Factor 2 + Factor 3 + Factor 4 + Factor 5) × Week Multiplier**

---

## Step-by-Step: Calculating Risk for 200 Lots

### Step 1: Get Data into NumPy Arrays

**Input Data** (from database):

```python
import numpy as np
import pandas as pd

# Fetch 200 lots from database
lots_df = pd.read_sql("""
    SELECT 
        lot_id,
        due_date,
        current_step,
        total_steps,
        next_tool_group,
        next_tool_utilization,
        product_family,
        uph,
        week_bucket
    FROM wip_snapshot
    WHERE week_bucket IN ('W1', 'W2')
""", conn)

# Convert to NumPy arrays (this is the key!)
lot_ids = lots_df['lot_id'].values  # Shape: (200,)
due_dates = lots_df['due_date'].values
current_steps = lots_df['current_step'].values
total_steps = lots_df['total_steps'].values
utilizations = lots_df['next_tool_utilization'].values
uphs = lots_df['uph'].values
```

**What just happened?**
- `.values` converts Pandas columns to NumPy arrays
- NumPy arrays are **fixed-type** (all integers or all floats)
- Stored in **contiguous memory** (fast access)

**Result:**
```python
lot_ids = ['ABC-123', 'DEF-456', 'GHI-789', ..., 'XYZ-200']  # 200 lot IDs
current_steps = [15, 8, 22, ..., 12]  # 200 numbers
total_steps = [25, 30, 28, ..., 25]  # 200 numbers
utilizations = [0.95, 0.82, 0.91, ..., 0.88]  # 200 decimals
```

---

### Step 2: Calculate Factor 1 - OTIF Gap (Using ML Model)

**Use ML model to predict time needed for ALL 200 lots at once:**

```python
# Extract features for ML model (already NumPy arrays)
lot_features = lots_df[['DESIGN_ID', 'STEP_ID', 'NUMBER_OF_DIE_IN_PKG', 
                         'DESIGN_mean', 'STEP_mean', 'POSITION_EARLY', 
                         'POSITION_MIDDLE', 'POSITION_LATE']].values

# ML model predicts for ALL 200 lots in one call
# Shape: (200, 8 features) → (200, 1 prediction)
time_needed_hours = completion_model.predict(lot_features)
# Result: [40.2, 35.8, 52.1, ..., 28.3]  # 200 predictions

# Calculate time available (vectorized date math)
now = pd.Timestamp.now()
time_available_hours = (due_dates - now).total_seconds() / 3600
# Result: [30.5, 48.2, 25.3, ..., 45.7]  # 200 values

# Calculate gap for ALL lots at once (NumPy subtraction)
gap_hours = time_needed_hours - time_available_hours
# Result: [9.7, -12.4, 26.8, ..., -17.4]  # 200 values
# Positive = behind, Negative = ahead

# Convert to score (NumPy operations on entire array)
otif_scores = np.maximum(0, gap_hours / 10) * 10
# Result: [9.7, 0.0, 26.8, ..., 0.0]  # 200 scores
```

**Key Point**: 
- Did NOT loop through 200 lots
- One `.predict()` call for all 200 lots
- NumPy operations (`-`, `/`, `*`) work on entire arrays

**Time**: ~10 milliseconds (ML inference) + ~1 millisecond (NumPy math)

---

### Step 3: Calculate Factor 2 - WIP Position

**Calculate % complete for all lots:**

```python
# Vectorized division (NumPy does 200 divisions at once)
position_pct = current_steps / total_steps
# Result: [0.60, 0.27, 0.79, ..., 0.48]  # 200 percentages

# Scale to score (multiply entire array by 30)
position_scores = position_pct * 30
# Result: [18.0, 8.1, 23.7, ..., 14.4]  # 200 scores
```

**What NumPy Did Under the Hood:**

```c
// NumPy's C implementation (pseudo-code)
for (int i = 0; i < 200; i++) {
    position_scores[i] = (current_steps[i] / total_steps[i]) * 30;
}
```

But this C loop runs at **CPU speed** (billions of operations/second), not Python speed.

**Time**: <1 millisecond

---

### Step 4: Calculate Factor 3 - Capacity Constraint

**Use tool utilization data (already in NumPy array):**

```python
# utilizations = [0.95, 0.82, 0.91, ..., 0.88]  # Already NumPy array

# Scale to score (multiply by 20)
capacity_scores = utilizations * 20
# Result: [19.0, 16.4, 18.2, ..., 17.6]  # 200 scores
```

**Time**: <1 millisecond

---

### Step 5: Calculate Factor 4 - Product Mix Competition (UPH-Weighted)

**This is more complex - needs capacity demand calculation:**

```python
# Group lots by tool_group and week
capacity_data = pd.read_sql("""
    SELECT 
        tool_group,
        week_bucket,
        SUM(units_needed / uph) as total_demand_hours,
        MAX(available_capacity) as available_hours
    FROM capacity_vs_demand
    WHERE week_bucket IN ('W1', 'W2')
    GROUP BY tool_group, week_bucket
""", conn)

# Merge back to lots (adds columns: total_demand_hours, available_hours)
lots_df = lots_df.merge(
    capacity_data, 
    on=['next_tool_group', 'week_bucket'], 
    how='left'
)

# Now convert to NumPy arrays
total_demand = lots_df['total_demand_hours'].values
available_capacity = lots_df['available_hours'].values

# Calculate capacity shortage (vectorized)
capacity_shortage = np.maximum(0, total_demand - available_capacity)
# Result: [5.2, 0.0, 12.8, ..., 3.1]  # 200 values

# Base mix score
mix_scores = np.minimum(capacity_shortage / available_capacity, 1.0) * 15
# Result: [3.9, 0.0, 9.6, ..., 2.3]  # 200 scores

# Penalty for "heavy consumer" products (low UPH)
# Get average UPH per tool group
avg_uphs = lots_df.groupby('next_tool_group')['uph'].transform('mean').values

# Apply penalty (vectorized conditional)
is_heavy_consumer = uphs < avg_uphs  # Boolean array: [True, False, True, ...]
penalty_multiplier = np.where(is_heavy_consumer, 1.3, 1.0)  # [1.3, 1.0, 1.3, ...]

mix_scores = mix_scores * penalty_multiplier
# Result: [5.07, 0.0, 12.48, ..., 2.99]  # 200 scores with penalty applied
```

**NumPy Magic Here:**
- `np.maximum()` = element-wise maximum (compares each element)
- `np.minimum()` = element-wise minimum
- `np.where()` = vectorized if-else (applies condition to entire array)

**Time**: ~2 milliseconds

---

### Step 6: Calculate Factor 5 - Cross-Week Risk

**Check if expediting would steal W2-W4 capacity:**

```python
# Get units short for each lot (how much needs expediting)
units_short = lots_df['units_short'].values

# Calculate capacity needed if expedited (vectorized division)
expedite_capacity_needed = units_short / uphs
# Result: [25.0, 0.0, 50.0, ..., 15.0]  # Hours needed per lot

# Get reserved capacity for W2 (by tool group)
reserved_w2 = lots_df['reserved_w2_capacity'].values  # From capacity table

# Calculate cross-week score (vectorized conditionals)
cross_week_scores = np.zeros(200)  # Start with zeros

# High risk: would consume >50% of W2 reserve
high_risk_mask = expedite_capacity_needed > (reserved_w2 * 0.5)
cross_week_scores[high_risk_mask] = 15

# Medium risk: would consume >25% of W2 reserve
medium_risk_mask = (expedite_capacity_needed > (reserved_w2 * 0.25)) & ~high_risk_mask
cross_week_scores[medium_risk_mask] = 8

# Result: [15, 0, 15, 8, 0, ..., 8]  # 200 scores
```

**NumPy Boolean Indexing:**
- `high_risk_mask` = array of True/False for all 200 lots
- `cross_week_scores[high_risk_mask] = 15` assigns 15 to ALL True positions at once
- No loop needed!

**Time**: ~1 millisecond

---

### Step 7: Combine All Factors (The Final Weighted Sum)

**Add all five factor arrays together:**

```python
# All five arrays have shape (200,)
risk_scores = (
    otif_scores +          # [9.7, 0.0, 26.8, ...]
    position_scores +      # [18.0, 8.1, 23.7, ...]
    capacity_scores +      # [19.0, 16.4, 18.2, ...]
    mix_scores +           # [5.07, 0.0, 12.48, ...]
    cross_week_scores      # [15, 0, 15, ...]
)
# Result: [66.77, 24.5, 96.28, ..., 45.23]  # 200 total scores

# Apply week urgency multiplier (vectorized)
week_multipliers = np.where(
    lots_df['week_bucket'].values == 'W1', 
    1.5,  # W1 gets 1.5× urgency
    1.0   # W2 stays 1.0×
)
risk_scores = risk_scores * week_multipliers
# Result: [100.16, 24.5, 144.42, ..., 45.23]  # 200 scores with multiplier

# Cap at 100 (vectorized)
risk_scores = np.minimum(risk_scores, 100)
# Result: [100.0, 24.5, 100.0, ..., 45.23]  # 200 final scores
```

**Total Time for ALL 200 lots: ~50 milliseconds**

**Breakdown:**
- ML prediction: ~10ms
- Factor 1 (OTIF gap): ~1ms
- Factor 2 (WIP position): <1ms
- Factor 3 (Capacity): <1ms
- Factor 4 (Product mix): ~2ms
- Factor 5 (Cross-week): ~1ms
- Final sum + multiplier: <1ms
- Database queries: ~30ms

---

## Why Is NumPy So Fast?

### 1. Vectorization (SIMD)

**SIMD** = Single Instruction, Multiple Data

Modern CPUs have **vector registers** that can hold multiple numbers (e.g., 8 floats).

**Example: Adding two arrays**

```python
a = [1, 2, 3, 4, 5, 6, 7, 8]
b = [10, 20, 30, 40, 50, 60, 70, 80]
c = a + b  # Result: [11, 22, 33, 44, 55, 66, 77, 88]
```

**Regular Python loop (slow):**
```python
for i in range(8):
    c[i] = a[i] + b[i]  # 8 separate ADD instructions
```

**NumPy with SIMD (fast):**
```c
// Load 8 numbers into CPU vector register
vec_a = load_vector(a)  // [1, 2, 3, 4, 5, 6, 7, 8]
vec_b = load_vector(b)  // [10, 20, 30, 40, 50, 60, 70, 80]

// ONE instruction adds ALL 8 pairs simultaneously
vec_c = vector_add(vec_a, vec_b)  // [11, 22, 33, 44, 55, 66, 77, 88]
```

**8× faster** because CPU does 8 additions in parallel!

---

### 2. Contiguous Memory Layout

**Python List (slow):**
```
Memory:  [ptr] → [obj1] → [obj2] → [obj3] → ...
         │       │        │        │
         │       └─ int   └─ int   └─ int
         └─ list object

Each access:
1. Follow pointer to list
2. Follow pointer to object
3. Extract integer value
4. Repeat 200 times
```

**NumPy Array (fast):**
```
Memory:  [1, 2, 3, 4, 5, 6, 7, 8, ...]  ← All numbers in one block

Each access:
1. Jump to start address
2. Read ALL numbers in one go (CPU cache friendly)
```

**Why this matters:**
- CPU cache is **fast** (nanoseconds)
- RAM is **slow** (100× slower)
- NumPy keeps data in cache → fast
- Python list jumps around RAM → slow

---

### 3. No Python Interpreter Overhead

**Python Loop (slow):**
```python
for i in range(200):
    risk_scores[i] = (otif[i] + wip[i] + cap[i]) * 1.5

# Python interpreter does for EACH iteration:
1. Check if i < 200 (Python comparison)
2. Call __getitem__ on otif (Python method call)
3. Call __add__ on integers (Python method call)
4. Call __mul__ on result (Python method call)
5. Call __setitem__ on risk_scores (Python method call)
6. Increment i (Python operation)
7. Jump back to loop start

Total overhead: ~200 microseconds PER iteration = 40 milliseconds for 200 iterations
```

**NumPy (fast):**
```python
risk_scores = (otif + wip + cap) * 1.5

# NumPy does:
1. Call C function once (1 microsecond)
2. C loop runs at CPU speed (50 microseconds for 200 elements)

Total overhead: 51 microseconds (800× faster!)
```

---

## Complete Code Example

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

def calculate_risk_scores_vectorized(lots_df, completion_model, capacity_data):
    """
    Calculate risk scores for ALL lots using vectorized NumPy operations.
    
    Args:
        lots_df: DataFrame with 200 lots (lot_id, due_date, current_step, etc.)
        completion_model: Trained RandomForest model for time prediction
        capacity_data: DataFrame with capacity info per tool_group/week
    
    Returns:
        risk_scores: NumPy array of shape (200,) with risk scores 0-100
        breakdown: Dict with component scores for explainability
    """
    
    # ===== STEP 1: Convert to NumPy arrays =====
    lot_ids = lots_df['lot_id'].values
    due_dates = lots_df['due_date'].values
    current_steps = lots_df['current_step'].values.astype(float)
    total_steps = lots_df['total_steps'].values.astype(float)
    utilizations = lots_df['next_tool_utilization'].values
    uphs = lots_df['uph'].values.astype(float)
    week_buckets = lots_df['week_bucket'].values
    units_short = lots_df['units_short'].values.astype(float)
    
    # ===== STEP 2: Factor 1 - OTIF Gap (ML prediction) =====
    lot_features = lots_df[[
        'DESIGN_ID', 'STEP_ID', 'NUMBER_OF_DIE_IN_PKG',
        'DESIGN_mean', 'STEP_mean', 'POSITION_EARLY',
        'POSITION_MIDDLE', 'POSITION_LATE'
    ]].values
    
    # ML model predicts for all 200 lots at once
    time_needed_hours = completion_model.predict(lot_features)
    
    # Vectorized date math
    now = pd.Timestamp.now()
    time_available_hours = (due_dates - now).total_seconds() / 3600
    gap_hours = time_needed_hours - time_available_hours
    
    # Convert to score
    otif_scores = np.maximum(0, gap_hours / 10) * 10
    
    # ===== STEP 3: Factor 2 - WIP Position =====
    position_pct = current_steps / total_steps
    position_scores = position_pct * 30
    
    # ===== STEP 4: Factor 3 - Capacity Constraint =====
    capacity_scores = utilizations * 20
    
    # ===== STEP 5: Factor 4 - Product Mix Competition =====
    # Merge capacity data
    lots_with_capacity = lots_df.merge(
        capacity_data[['tool_group', 'week_bucket', 'total_demand_hours', 'available_hours']],
        left_on=['next_tool_group', 'week_bucket'],
        right_on=['tool_group', 'week_bucket'],
        how='left'
    )
    
    total_demand = lots_with_capacity['total_demand_hours'].values
    available_capacity = lots_with_capacity['available_hours'].values
    
    # Calculate capacity shortage
    capacity_shortage = np.maximum(0, total_demand - available_capacity)
    mix_scores = np.minimum(capacity_shortage / available_capacity, 1.0) * 15
    
    # Penalty for heavy consumers (low UPH)
    avg_uphs = lots_with_capacity.groupby('next_tool_group')['uph'].transform('mean').values
    is_heavy_consumer = uphs < avg_uphs
    penalty_multiplier = np.where(is_heavy_consumer, 1.3, 1.0)
    mix_scores = mix_scores * penalty_multiplier
    
    # ===== STEP 6: Factor 5 - Cross-Week Risk =====
    expedite_capacity_needed = units_short / uphs
    reserved_w2 = lots_with_capacity['reserved_w2_capacity'].values
    
    cross_week_scores = np.zeros(len(lots_df))
    high_risk_mask = expedite_capacity_needed > (reserved_w2 * 0.5)
    medium_risk_mask = (expedite_capacity_needed > (reserved_w2 * 0.25)) & ~high_risk_mask
    
    cross_week_scores[high_risk_mask] = 15
    cross_week_scores[medium_risk_mask] = 8
    
    # ===== STEP 7: Combine All Factors =====
    risk_scores = (
        otif_scores +
        position_scores +
        capacity_scores +
        mix_scores +
        cross_week_scores
    )
    
    # Apply week urgency multiplier
    week_multipliers = np.where(week_buckets == 'W1', 1.5, 1.0)
    risk_scores = risk_scores * week_multipliers
    
    # Cap at 100
    risk_scores = np.minimum(risk_scores, 100)
    
    # Return scores and breakdown for explainability
    breakdown = {
        'lot_id': lot_ids,
        'risk_score': risk_scores,
        'otif_score': otif_scores,
        'position_score': position_scores,
        'capacity_score': capacity_scores,
        'mix_score': mix_scores,
        'cross_week_score': cross_week_scores,
        'week_multiplier': week_multipliers
    }
    
    return risk_scores, breakdown


# ===== USAGE EXAMPLE =====
import time

# Fetch 200 lots
lots_df = get_lots_from_database()  # Your DB query

# Fetch capacity data
capacity_data = get_capacity_data()  # Your DB query

# Load ML model
completion_model = load_completion_model()  # Your trained model

# Calculate risk scores (FAST!)
start = time.time()
risk_scores, breakdown = calculate_risk_scores_vectorized(
    lots_df, 
    completion_model, 
    capacity_data
)
elapsed_ms = (time.time() - start) * 1000

print(f"Calculated risk for {len(lots_df)} lots in {elapsed_ms:.1f} ms")
# Output: Calculated risk for 200 lots in 52.3 ms

# Filter high-risk lots
high_risk_mask = risk_scores > 70
high_risk_lots = lots_df[high_risk_mask]

print(f"Found {len(high_risk_lots)} high-risk lots")
# Output: Found 8 high-risk lots

# Show breakdown for explainability
for i in np.where(high_risk_mask)[0]:
    print(f"\nLot {breakdown['lot_id'][i]}: Risk Score = {breakdown['risk_score'][i]:.1f}")
    print(f"  OTIF Gap: {breakdown['otif_score'][i]:.1f}")
    print(f"  WIP Position: {breakdown['position_score'][i]:.1f}")
    print(f"  Capacity: {breakdown['capacity_score'][i]:.1f}")
    print(f"  Product Mix: {breakdown['mix_score'][i]:.1f}")
    print(f"  Cross-Week: {breakdown['cross_week_score'][i]:.1f}")
    print(f"  Week Multiplier: {breakdown['week_multiplier'][i]:.1f}×")
```

**Output:**
```
Calculated risk for 200 lots in 52.3 ms
Found 8 high-risk lots

Lot ABC-123: Risk Score = 100.0
  OTIF Gap: 9.7
  WIP Position: 18.0
  Capacity: 19.0
  Product Mix: 5.1
  Cross-Week: 15.0
  Week Multiplier: 1.5×

Lot GHI-789: Risk Score = 88.5
  OTIF Gap: 26.8
  WIP Position: 23.7
  Capacity: 18.2
  Product Mix: 0.0
  Cross-Week: 0.0
  Week Multiplier: 1.0×

...
```

---

## Comparison: NumPy vs LLM

| Aspect | NumPy Risk Detection | LLM Risk Detection |
|--------|---------------------|-------------------|
| **Speed** | 50ms for 200 lots | 400 seconds (6.7 min) for 200 lots |
| **Cost** | $0 (runs on existing server) | $6 per refresh ($2,160/month) |
| **Deterministic** | ✅ Same input → same output | ❌ Temperature > 0 → varies |
| **Explainable** | ✅ Show exact math breakdown | ❌ Black box reasoning |
| **Scalability** | ✅ Linear (400 lots = 100ms) | ❌ Linear but expensive |
| **Production Ready** | ✅ No API dependency | ❌ LLM provider downtime risk |
| **Math Accuracy** | ✅ Perfect (0.95 × 20 = 19.0) | ❌ Can make mistakes |

---

## Interview Talking Points

### Q: "Why NumPy instead of an LLM for risk detection?"

**A:** "Three reasons: speed, cost, and explainability. I have 200 lots refreshing every 2 hours. NumPy calculates a weighted sum of five risk factors using vectorized operations—it processes all 200 lots in parallel in under 100 milliseconds. An LLM would take 2 seconds per lot, so that's 6.7 minutes total, plus about $6 per refresh.

More importantly, NumPy is deterministic and explainable. When a planner asks 'why is this lot flagged?', I can show the exact breakdown: it's 10 hours behind schedule based on ML prediction, at 60% complete, the next tool is at 95% capacity, and expediting it would consume 50 hours of W2's reserved capacity. With an LLM, that's a black box.

I save the LLM for where it adds value—understanding WHY a lot is at risk through root cause analysis. But for scoring math, NumPy is the right tool."

---

### Q: "How do you ensure the NumPy calculations are correct?"

**A:** "I start in shadow mode for Week 1. I run Risk Detection alongside human judgment and compare which lots I flag versus what planners actually care about. If I'm getting false positives, I can tune the factor weights—maybe capacity constraint should be 25 points instead of 20. 

The advantage of NumPy over an LLM is I can inspect every calculation. If a lot gets a score of 88, I can print the exact breakdown showing it came from: OTIF gap 10 + WIP position 18 + capacity 19 + product mix 5 + cross-week 15, multiplied by 1.5 for W1 urgency. That's testable and debuggable in a way LLM reasoning isn't."

---

### Q: "What happens if your risk scoring formula is wrong?"

**A:** "That's why I measure precision and recall in shadow mode. Precision = of the lots I flag as high-risk, how many do planners actually care about? Recall = of the lots planners care about, how many did I catch?

If precision is low (too many false positives), I raise the threshold from 70 to 80. If recall is low (missing real issues), I check which factor is underweighted. Maybe cross-week impact should be 20 points instead of 15.

Once tuned, the formula is deterministic—same inputs always give the same score. I can version control it, A/B test changes, and roll back if something breaks. With an LLM, tuning is harder because the reasoning process is opaque."

---

### Q: "Can NumPy handle more complex logic?"

**A:** "NumPy is great for mathematical operations—weighted sums, matrix multiplication, element-wise comparisons. It's not great for complex reasoning like 'this lot is stuck because the maintenance team is waiting on a part from supplier X'.

That's why my design has both: NumPy for the triage layer (WHICH lots are at risk?) and LLM for the reasoning layer (WHY are they at risk?). NumPy filters 200 lots down to the 5-10 that are actually high-risk, then the LLM only analyzes those 5-10. Best of both worlds—speed and intelligence."

---

## Summary

**NumPy Risk Detection** = Fast, vectorized calculation of risk scores using weighted sums

**Key Points:**
- ✅ Processes 200 lots in 50 milliseconds (vs LLM: 6.7 minutes)
- ✅ Uses vectorization = CPU processes entire arrays at once
- ✅ 5 risk factors: OTIF gap (ML), WIP position, capacity, product mix, cross-week
- ✅ Deterministic and explainable = can show exact math
- ✅ No API cost, no downtime risk
- ✅ Perfect for triage/filtering layer before sending to LLM

**One-liner for interview:**
> "I use NumPy for risk detection because it calculates a weighted sum of five factors for all 200 lots in parallel in under 100 milliseconds. It's deterministic, explainable, and free—I save the LLM for where it adds value, which is understanding WHY a lot is at risk, not scoring math."
