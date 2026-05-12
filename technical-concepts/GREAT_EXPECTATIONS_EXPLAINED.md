# Great Expectations Explained - Data Quality Testing Framework

## TL;DR

**Great Expectations** = Unit tests for data (instead of code)

**Think of it like:**
- Unit tests = Check if your code works
- Great Expectations = Check if your data is correct

---

## What Problem Does Great Expectations Solve?

### Without Great Expectations (Silent Data Corruption)

```python
# You query WIP data from MES
wip_df = kafka_consumer.read_wip_snapshot()

# Looks fine... but is it?
print(wip_df.head())
#   lot_id   current_step  quantity  timestamp
#   ABC-123  Lithography   25        2024-05-10T14:00:00Z
#   DEF-456  Etch          null      2024-05-10T14:05:00Z  ← NULL quantity!
#   GHI-789  Lithography   -5        2024-05-10T14:10:00Z  ← Negative quantity!
#   null     Deposition    30        2024-05-10T14:15:00Z  ← NULL lot_id!
#   XYZ-000  Lithography   50        2022-01-01T00:00:00Z  ← Stale (2 years old)!

# Your Risk Detection Agent processes this garbage data
risk_score = calculate_risk(wip_df)  # Produces nonsense!

# You only find out weeks later when planners complain:
# "Why did the system tell me to expedite a lot with -5 quantity?"
```

**Problems:**
- ❌ No validation before processing
- ❌ Garbage data → garbage insights
- ❌ Silent failures (code runs but produces wrong results)
- ❌ Manual data inspection (tedious, error-prone)
- ❌ Hard to debug data issues

---

### With Great Expectations (Data Validation Gate)

```python
import great_expectations as gx

# Create expectation suite (data contract)
context = gx.get_context()

# Define expectations (rules)
suite = context.add_expectation_suite("wip_snapshot_suite")

# 1. lot_id must not be null
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToNotBeNull(column="lot_id")
)

# 2. quantity must be positive
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="quantity",
        min_value=1,
        max_value=10000
    )
)

# 3. timestamp must be recent (within last 3 hours)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeRecent(
        column="timestamp",
        max_age_hours=3
    )
)

# Validate data BEFORE processing
results = context.run_checkpoint(
    checkpoint_name="wip_checkpoint",
    batch_request=batch_request
)

if not results.success:
    # Stop! Data is bad.
    send_alert("Data quality check FAILED")
    log_failures(results)
    return  # Don't process garbage

# Only process if data passes validation
risk_score = calculate_risk(wip_df)  # Guaranteed clean data!
```

**Benefits:**
- ✅ Catch data issues before they cause problems
- ✅ Automated validation (no manual inspection)
- ✅ Clear error reports ("lot_id is null in 3 rows")
- ✅ Data contracts (document expected schema)
- ✅ Fail fast (stop processing bad data)

---

## Core Great Expectations Concepts

### 1. **Expectations** (Data Tests)

An **Expectation** = assertion about your data

```python
# Expect column to exist
expect_column_to_exist("lot_id")

# Expect no null values
expect_column_values_to_not_be_null("lot_id")

# Expect values in a set
expect_column_values_to_be_in_set(
    "current_step",
    ["Lithography", "Etch", "Deposition", "CMP"]
)

# Expect values between range
expect_column_values_to_be_between(
    "quantity",
    min_value=1,
    max_value=10000
)

# Expect unique values
expect_column_values_to_be_unique("lot_id")

# Expect regex pattern
expect_column_values_to_match_regex(
    "lot_id",
    regex=r"^[A-Z]{3}-\d{3}$"
)

# Expect timestamp freshness
expect_column_max_to_be_recent(
    "timestamp",
    max_age_hours=3
)

# Expect row count
expect_table_row_count_to_be_between(
    min_value=100,
    max_value=100000
)
```

**Key Point:** Expectations = test cases for data

---

### 2. **Expectation Suite** (Collection of Tests)

```python
import great_expectations as gx

context = gx.get_context()

# Create suite
suite = context.add_expectation_suite("wip_snapshot_suite")

# Add expectations
suite.add_expectation(
    gx.expectations.ExpectColumnToExist(column="lot_id")
)

suite.add_expectation(
    gx.expectations.ExpectColumnValuesToNotBeNull(column="lot_id")
)

suite.add_expectation(
    gx.expectations.ExpectColumnValuesToMatchRegex(
        column="lot_id",
        regex=r"^[A-Z]{3}-\d{3}$"
    )
)

suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="quantity",
        min_value=1,
        max_value=10000
    )
)

# Save suite (reusable!)
context.save_expectation_suite(suite)
```

---

### 3. **Checkpoint** (Run Validation)

```python
# Create checkpoint
checkpoint = context.add_checkpoint(
    name="wip_checkpoint",
    expectation_suite_name="wip_snapshot_suite",
    batch_request={
        "datasource_name": "kafka_datasource",
        "data_connector_name": "default",
        "data_asset_name": "wip_snapshot"
    }
)

# Run validation
results = checkpoint.run()

# Check results
if results.success:
    print("✅ Data passed all checks!")
else:
    print("❌ Data failed validation:")
    for result in results.list_validation_results():
        if not result.success:
            print(f"  - {result.expectation_config}")
```

---

### 4. **Validation Results** (What Failed?)

```python
results = checkpoint.run()

# Overall success
print(results.success)  # True or False

# Details
for validation_result in results.list_validation_results():
    for expectation_result in validation_result.results:
        if not expectation_result.success:
            print(f"FAILED: {expectation_result.expectation_config.expectation_type}")
            print(f"  Column: {expectation_result.expectation_config.kwargs.get('column')}")
            print(f"  Details: {expectation_result.result}")
```

**Example Output:**
```
FAILED: expect_column_values_to_not_be_null
  Column: quantity
  Details: Found 3 null values in rows [42, 87, 156]

FAILED: expect_column_values_to_be_between
  Column: quantity
  Details: Found 2 values outside range [1, 10000]: [-5, 50000]
```

---

### 5. **Data Docs** (Automatic Documentation)

Great Expectations generates beautiful HTML reports:

```python
context.build_data_docs()
```

**What You Get:**
- Web UI showing all expectation suites
- Validation results with charts (pass/fail rates)
- Drill-down into specific failures
- Shareable with team (hosted or static HTML)

**Example:**
```
WIP Snapshot Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 15/18 expectations passed (83%)

Failed Expectations:
❌ expect_column_values_to_not_be_null (quantity)
   → 3 null values found
   
❌ expect_column_values_to_be_between (quantity)
   → 2 values out of range

❌ expect_column_max_to_be_recent (timestamp)
   → Latest timestamp is 5 hours old (threshold: 3 hours)
```

---

## Great Expectations in Your Design

### 1. **Data Quality Agent**

```python
import great_expectations as gx

class DataQualityAgent:
    def __init__(self):
        self.context = gx.get_context()
        self.setup_expectation_suites()
    
    def setup_expectation_suites(self):
        # WIP Snapshot Suite
        wip_suite = self.context.add_expectation_suite("wip_snapshot")
        
        wip_suite.add_expectation(
            gx.expectations.ExpectColumnToExist(column="lot_id")
        )
        wip_suite.add_expectation(
            gx.expectations.ExpectColumnValuesToNotBeNull(column="lot_id")
        )
        wip_suite.add_expectation(
            gx.expectations.ExpectColumnValuesToMatchRegex(
                column="lot_id",
                regex=r"^[A-Z0-9\-]{5,20}$"
            )
        )
        wip_suite.add_expectation(
            gx.expectations.ExpectColumnValuesToBeBetween(
                column="quantity",
                min_value=1,
                max_value=10000
            )
        )
        wip_suite.add_expectation(
            gx.expectations.ExpectColumnMaxToBeRecent(
                column="timestamp",
                max_age_hours=3  # W1 data must be fresh!
            )
        )
        
        # Equipment Status Suite
        equipment_suite = self.context.add_expectation_suite("equipment_status")
        
        equipment_suite.add_expectation(
            gx.expectations.ExpectColumnValuesToBeInSet(
                column="status",
                value_set=["UP", "DOWN", "PM", "IDLE"]
            )
        )
        
        # ERP Commit Suite (less strict, batch data)
        erp_suite = self.context.add_expectation_suite("erp_commits")
        
        erp_suite.add_expectation(
            gx.expectations.ExpectColumnMaxToBeRecent(
                column="timestamp",
                max_age_hours=72  # W3/W4 data updated 3x/week
            )
        )
    
    def validate(self, data_source: str, data: pd.DataFrame) -> bool:
        """Validate data before processing"""
        
        # Select appropriate suite
        suite_name = f"{data_source}_suite"
        
        # Run validation
        results = self.context.run_checkpoint(
            checkpoint_name=suite_name,
            batch_request={"dataframe": data}
        )
        
        if not results.success:
            # Log failures
            self.log_failures(results)
            
            # Send alert
            self.send_alert(f"Data quality check failed for {data_source}")
            
            # Return failure
            return False
        
        return True
    
    def log_failures(self, results):
        """Log validation failures to database"""
        for validation_result in results.list_validation_results():
            for expectation_result in validation_result.results:
                if not expectation_result.success:
                    db.save_data_quality_failure({
                        "timestamp": datetime.now(),
                        "expectation": expectation_result.expectation_config.expectation_type,
                        "details": expectation_result.result,
                        "data_source": validation_result.meta.get("data_source")
                    })
```

---

### 2. **Integration with Agent Workflow**

```python
from langgraph.graph import StateGraph
from typing import TypedDict

class AgentState(TypedDict):
    data_valid: bool
    risk_score: int
    root_cause: str

# Create workflow
graph = StateGraph(AgentState)

# Data Quality Agent (FIRST!)
def data_quality_node(state: AgentState) -> AgentState:
    """Validate data before processing"""
    
    # Fetch fresh data
    wip_data = kafka_consumer.read_wip_snapshot()
    equipment_data = kafka_consumer.read_equipment_status()
    
    # Validate
    dq_agent = DataQualityAgent()
    wip_valid = dq_agent.validate("wip_snapshot", wip_data)
    equipment_valid = dq_agent.validate("equipment_status", equipment_data)
    
    if not (wip_valid and equipment_valid):
        return {"data_valid": False}
    
    return {"data_valid": True}

# Risk Detection Agent
def risk_detection_node(state: AgentState) -> AgentState:
    if not state["data_valid"]:
        return state  # Skip if data is bad
    
    # Calculate risk (guaranteed clean data!)
    risk_score = calculate_risk()
    return {"risk_score": risk_score}

# Build graph
graph.add_node("data_quality", data_quality_node)
graph.add_node("risk_detection", risk_detection_node)

graph.set_entry_point("data_quality")

# Conditional: only proceed if data is valid
graph.add_conditional_edges(
    "data_quality",
    lambda state: "risk_detection" if state["data_valid"] else "END"
)

graph.add_edge("risk_detection", "END")

# Compile
app = graph.compile()
```

**Key Point:** Data Quality Agent is a **gate** - if data fails, workflow stops.

---

### 3. **Monitoring Data Quality Over Time**

```python
# Track data quality metrics
def monitor_data_quality():
    # Run daily validation
    results = checkpoint.run()
    
    # Save metrics
    db.save_data_quality_metrics({
        "timestamp": datetime.now(),
        "source": "wip_snapshot",
        "success_rate": results.statistics.get("success_percent"),
        "failed_expectations": results.statistics.get("failed_expectation_count"),
        "row_count": results.statistics.get("evaluated_row_count")
    })
    
    # Alert if success rate drops
    if results.statistics.get("success_percent") < 95:
        send_alert("Data quality degraded: {}%".format(
            results.statistics.get("success_percent")
        ))
```

**Dashboard:**
```
Data Quality Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WIP Snapshot
  Success Rate: 98% (last 7 days)
  Failed Checks: 12 (last 24 hours)
  Most Common Failure: timestamp_freshness (8)

Equipment Status
  Success Rate: 100% (last 7 days)
  Failed Checks: 0

ERP Commits
  Success Rate: 85% (last 7 days)
  Failed Checks: 45 (last 24 hours)
  Most Common Failure: missing_customer_id (42)
```

---

## Common Great Expectations Patterns

### Pattern 1: Freshness Checks (Time-Sensitive Data)

```python
# W1 data must be <3 hours old
suite.add_expectation(
    gx.expectations.ExpectColumnMaxToBeRecent(
        column="timestamp",
        max_age_hours=3
    )
)

# W3/W4 data can be older (batch updates 3x/week)
suite.add_expectation(
    gx.expectations.ExpectColumnMaxToBeRecent(
        column="timestamp",
        max_age_hours=72
    )
)
```

---

### Pattern 2: Referential Integrity

```python
# All lot_ids in wip_snapshot must exist in lot_master
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeInSet(
        column="lot_id",
        value_set=lot_master["lot_id"].tolist()
    )
)
```

---

### Pattern 3: Custom Expectations

```python
from great_expectations.expectations import Expectation

class ExpectLotQuantityConsistent(Expectation):
    """Custom expectation: quantity should match route step capacity"""
    
    def _validate(self, dataset):
        # Custom logic
        inconsistent_rows = []
        
        for idx, row in dataset.iterrows():
            step = row["current_step"]
            quantity = row["quantity"]
            max_capacity = route_master[step]["max_capacity"]
            
            if quantity > max_capacity:
                inconsistent_rows.append(idx)
        
        return {
            "success": len(inconsistent_rows) == 0,
            "result": {
                "unexpected_count": len(inconsistent_rows),
                "unexpected_indices": inconsistent_rows
            }
        }

# Use custom expectation
suite.add_expectation(ExpectLotQuantityConsistent())
```

---

## Great Expectations vs Alternatives

| Tool | Use Case | Comparison |
|------|---------|------------|
| **Manual checks** | if/else in code | ❌ Tedious, not reusable |
| **Pandas asserts** | assert statements | ⚠️ No reporting, ugly errors |
| **dbt tests** | SQL-based data tests | ✅ Great for SQL pipelines |
| **Great Expectations** | General data validation | ✅ Best for Python, flexible, great reports |

**Why Great Expectations:** Works with any data source (Kafka, databases, CSVs), generates beautiful reports, reusable expectation suites.

---

## Interview Talking Points

### Q: "What is Great Expectations?"

**A:** "Great Expectations is a data quality testing framework—it's like unit tests but for data instead of code. I use it in the Data Quality Agent to validate data before processing. For example, I have expectations that WIP data timestamps must be less than 3 hours old, quantity must be positive, and lot_id can't be null. If any expectation fails, the agent stops the workflow and alerts me. This prevents garbage data from propagating—if MES sends a lot with negative quantity, I catch it immediately instead of calculating a nonsense risk score."

---

### Q: "Why not just write if/else checks?"

**A:** "I could, but Great Expectations gives me reusable test suites, automatic reporting, and clear error messages. If I write `if quantity < 0: raise Exception`, I have to write that check everywhere. With Great Expectations, I define expectations once in a suite, and they're applied consistently across all data sources. Plus, Great Expectations generates Data Docs—HTML reports I can share with the data team showing exactly what failed and why. It's maintainable and scalable."

---

### Q: "What happens if data quality checks fail?"

**A:** "The Data Quality Agent is the first node in the LangGraph workflow. If validation fails, the workflow stops immediately—the Risk Detection Agent never runs. I log the failure to the database, send an alert to the data team (Slack or email), and display a 'DEGRADED MODE' banner on the dashboard so planners know data is stale or incomplete. This is better than silently processing bad data and producing wrong recommendations."

---

### Q: "How do you decide what expectations to write?"

**A:** "I start with basic checks: not null, correct data types, value ranges. Then I add domain-specific checks based on manufacturing logic—for example, lot quantity must match the route step capacity, or equipment status must be one of [UP, DOWN, PM, IDLE]. I also check data freshness: W1 data must be less than 3 hours old, but W3/W4 data can be up to 72 hours old since it's batch-updated. I iterate based on failures—if planners report bad data, I add an expectation to catch it next time."

---

### Q: "Is Great Expectations overkill for a 4-week MVP?"

**A:** "For a toy demo, maybe. But in production, data quality is critical. Manufacturing data comes from multiple sources (MES, ERP, equipment) that can fail in unpredictable ways. Without validation, I'd spend weeks debugging why the agent made a bad recommendation, only to find that MES sent a stale snapshot. Great Expectations catches that immediately. The setup cost is low—I write expectations once—and it prevents costly mistakes. It's cheap insurance for data-driven systems."

---

## Great Expectations Cheat Sheet

### Common Expectations

```python
# Column existence
expect_column_to_exist("lot_id")

# Nulls
expect_column_values_to_not_be_null("lot_id")

# Types
expect_column_values_to_be_of_type("quantity", "int")

# Ranges
expect_column_values_to_be_between("quantity", min_value=1, max_value=10000)

# Sets
expect_column_values_to_be_in_set("status", ["UP", "DOWN", "PM"])

# Unique
expect_column_values_to_be_unique("lot_id")

# Regex
expect_column_values_to_match_regex("lot_id", regex=r"^[A-Z]{3}-\d{3}$")

# Freshness
expect_column_max_to_be_recent("timestamp", max_age_hours=3)

# Row count
expect_table_row_count_to_be_between(min_value=100, max_value=100000)

# Column count
expect_table_column_count_to_equal(10)

# Custom SQL
expect_column_pair_values_to_be_equal("expected_quantity", "actual_quantity")
```

---

## Real-World Analogy

### Great Expectations = Airport Security

**Without Great Expectations:**
- Anyone can board the plane (no checks)
- Mid-flight, you discover someone has a weapon
- Disaster!

**With Great Expectations:**
- Everyone goes through security (validation)
- Invalid boarding pass? → Rejected
- Prohibited item? → Rejected
- Only clean passengers board the plane

**Data is the same:**
- Without validation, bad data enters your system
- With Great Expectations, bad data is rejected at the gate

---

## Summary

**Great Expectations** = Unit tests for data, ensuring data quality before processing

**Key Benefits:**
- ✅ Catch data issues early (before processing)
- ✅ Reusable expectation suites (not one-off checks)
- ✅ Beautiful reports (Data Docs)
- ✅ Clear error messages (what failed, where, why)
- ✅ Integration with workflows (LangGraph gate)
- ✅ Works with any data source (Kafka, databases, APIs)

**In Your Design:**
- Data Quality Agent validates all incoming data
- W1 freshness checks (<3 hours old)
- W3/W4 freshness checks (<72 hours old)
- Schema validation (not null, correct types, ranges)
- Custom business logic (lot quantity vs capacity)
- Workflow gate (stop if data fails)

**One-liner for interview:**
> "I use Great Expectations in the Data Quality Agent to validate data before processing—it's like unit tests for data. If WIP data is stale or has null values, the agent stops the workflow immediately instead of calculating a garbage risk score."

You're ready! 🚀
