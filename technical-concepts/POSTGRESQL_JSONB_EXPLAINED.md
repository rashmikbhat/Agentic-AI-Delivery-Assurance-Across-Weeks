# PostgreSQL JSONB Explained - Flexible JSON Storage

## TL;DR

**JSONB** = JSON stored as binary in PostgreSQL (fast, queryable, indexable)

**Think of it like:**
- Regular columns = Fixed structure (must define schema upfront)
- JSONB = Flexible structure (like MongoDB, but in PostgreSQL)

---

## What Problem Does JSONB Solve?

### Without JSONB (Rigid Schema)

**Problem:** Audit log entries have different fields depending on the action

```sql
-- Traditional approach: separate table per action type

CREATE TABLE flag_lot_actions (
    action_id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ,
    agent TEXT,
    lot_id TEXT,
    risk_score INT,
    reason TEXT
);

CREATE TABLE create_ticket_actions (
    action_id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ,
    agent TEXT,
    ticket_id TEXT,
    tool_id TEXT,
    description TEXT
);

CREATE TABLE expedite_lot_actions (
    action_id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ,
    agent TEXT,
    lot_id TEXT,
    old_priority INT,
    new_priority INT,
    approved_by TEXT
);

-- 20+ tables for 20+ action types... nightmare to query!

-- "Show me all actions for lot ABC-123"
SELECT * FROM flag_lot_actions WHERE lot_id = 'ABC-123'
UNION ALL
SELECT * FROM expedite_lot_actions WHERE lot_id = 'ABC-123'
UNION ALL
... (must manually union 20+ tables)
```

**Problems:**
- ❌ Schema explosion (one table per action type)
- ❌ Hard to query across action types
- ❌ Can't add new action types without ALTER TABLE
- ❌ Complex JOIN logic for related actions

---

### With JSONB (Flexible Schema)

```sql
-- Single table with JSONB column
CREATE TABLE audit_log (
    action_id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    agent TEXT NOT NULL,
    action_type TEXT NOT NULL,
    
    -- JSONB: flexible details per action type
    details JSONB NOT NULL,
    
    -- Hash chaining
    current_hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL
);

-- Insert different action types
INSERT INTO audit_log (action_id, timestamp, agent, action_type, details, current_hash, previous_hash)
VALUES
    -- Flag Lot
    ('act_001', '2024-05-10 14:30:00Z', 'Risk_Detection', 'FLAG_LOT',
     '{"lot_id": "ABC-123", "risk_score": 87, "reason": "W1 OTIF risk detected"}',
     'a1b2c3d4...', '0000000000000000'),
    
    -- Create Ticket
    ('act_002', '2024-05-10 14:35:00Z', 'Follow_Up', 'CREATE_TICKET',
     '{"ticket_id": "CMMS-5678", "tool_id": "Litho-3", "description": "Tool down"}',
     'f7e8d9c0...', 'a1b2c3d4...'),
    
    -- Expedite Lot
    ('act_003', '2024-05-10 14:40:00Z', 'Action_Executor', 'EXPEDITE_LOT',
     '{"lot_id": "ABC-123", "old_priority": 3, "new_priority": 1, "approved_by": "planner@example.com"}',
     '9z8y7x6w...', 'f7e8d9c0...');

-- Query: "Show me all actions for lot ABC-123"
SELECT * FROM audit_log
WHERE details->>'lot_id' = 'ABC-123';  -- JSONB query!

-- Query: "Show me all actions with high risk (>80)"
SELECT * FROM audit_log
WHERE action_type = 'FLAG_LOT'
  AND (details->>'risk_score')::int > 80;

-- Query: "Show me all tickets created for Litho-3"
SELECT * FROM audit_log
WHERE action_type = 'CREATE_TICKET'
  AND details->>'tool_id' = 'Litho-3';
```

**Benefits:**
- ✅ Single table (not 20+)
- ✅ Flexible schema (each action type has different fields)
- ✅ Queryable (can filter/search JSON fields)
- ✅ Add new action types without ALTER TABLE
- ✅ Simple queries (no complex UNIONs)

---

## JSON vs JSONB (Why the "B"?)

| Feature | JSON (text) | JSONB (binary) |
|---------|------------|----------------|
| **Storage** | Text string | Binary format |
| **Parsing** | Parsed every time | Parsed once on insert |
| **Performance** | Slow for queries | Fast for queries |
| **Indexing** | ❌ No | ✅ Yes (GIN index) |
| **Whitespace** | Preserved | Removed |
| **Key Order** | Preserved | Not preserved |
| **Use Case** | Logging (rarely queried) | Queryable data |

**Key Difference:**
- `JSON` = stored as text, re-parsed every query (slow)
- `JSONB` = stored as binary, pre-parsed, indexed (fast)

**You always use JSONB for queryable data.**

---

## Core JSONB Operations

### 1. **Inserting JSONB**

```sql
-- Insert as JSON literal
INSERT INTO audit_log (details)
VALUES ('{"lot_id": "ABC-123", "risk_score": 87}');

-- Insert from Python dict
import json
details = {"lot_id": "ABC-123", "risk_score": 87}
cursor.execute(
    "INSERT INTO audit_log (details) VALUES (%s)",
    [json.dumps(details)]
)
```

---

### 2. **Querying JSONB**

#### Extract Value as Text (`->>`)
```sql
-- Get lot_id (returns text)
SELECT details->>'lot_id' FROM audit_log;
```

#### Extract Value as JSONB (`->`)
```sql
-- Get nested object (returns JSONB)
SELECT details->'evidence'->0 FROM audit_log;
```

#### Filter by JSONB Field
```sql
-- WHERE clause
SELECT * FROM audit_log
WHERE details->>'lot_id' = 'ABC-123';

-- Numeric comparison (must cast)
SELECT * FROM audit_log
WHERE (details->>'risk_score')::int > 80;
```

#### Check Key Existence (`?`)
```sql
-- Does details have key "approved_by"?
SELECT * FROM audit_log
WHERE details ? 'approved_by';
```

#### Contains (`@>`)
```sql
-- Does details contain {"lot_id": "ABC-123"}?
SELECT * FROM audit_log
WHERE details @> '{"lot_id": "ABC-123"}';
```

---

### 3. **Indexing JSONB (Critical for Performance)**

```sql
-- GIN index on entire JSONB column
CREATE INDEX idx_audit_log_details ON audit_log USING GIN (details);

-- Now queries are FAST
SELECT * FROM audit_log
WHERE details @> '{"lot_id": "ABC-123"}';  -- Uses index!

-- Index specific field (if frequently queried)
CREATE INDEX idx_audit_log_lot_id ON audit_log ((details->>'lot_id'));

SELECT * FROM audit_log
WHERE details->>'lot_id' = 'ABC-123';  -- Uses index!
```

**Without GIN index:** PostgreSQL scans every row (slow for millions of rows)  
**With GIN index:** PostgreSQL uses index (fast even for billions of rows)

---

### 4. **Updating JSONB**

```sql
-- Set a field
UPDATE audit_log
SET details = details || '{"status": "resolved"}'
WHERE action_id = 'act_001';

-- Remove a field
UPDATE audit_log
SET details = details - 'status'
WHERE action_id = 'act_001';

-- Update nested field
UPDATE audit_log
SET details = jsonb_set(details, '{evidence, 0, confidence}', '0.95')
WHERE action_id = 'act_001';
```

---

## JSONB in Your Design

### 1. **Audit Log Table**

```sql
CREATE TABLE audit_log (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    agent TEXT NOT NULL,
    action_type TEXT NOT NULL,
    
    -- Flexible action details (JSONB!)
    details JSONB NOT NULL,
    
    -- Hash chaining
    current_hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_audit_log_details ON audit_log USING GIN (details);
CREATE INDEX idx_audit_log_lot_id ON audit_log ((details->>'lot_id'));
CREATE INDEX idx_audit_log_timestamp ON audit_log (timestamp DESC);
```

---

### 2. **Different Action Types, Same Table**

```sql
-- FLAG_LOT
INSERT INTO audit_log (agent, action_type, details, current_hash, previous_hash)
VALUES (
    'Risk_Detection',
    'FLAG_LOT',
    '{
        "lot_id": "ABC-123",
        "risk_score": 87,
        "reason": "W1 OTIF risk detected",
        "week_bucket": "W1"
    }',
    'a1b2c3d4...',
    '0000000000000000'
);

-- CREATE_TICKET (different schema!)
INSERT INTO audit_log (agent, action_type, details, current_hash, previous_hash)
VALUES (
    'Follow_Up',
    'CREATE_TICKET',
    '{
        "ticket_id": "CMMS-5678",
        "tool_id": "Litho-3",
        "description": "Tool downtime detected",
        "severity": "HIGH",
        "assigned_to": "maintenance@example.com"
    }',
    'f7e8d9c0...',
    'a1b2c3d4...'
);

-- EXPEDITE_LOT (yet another schema!)
INSERT INTO audit_log (agent, action_type, details, current_hash, previous_hash)
VALUES (
    'Action_Executor',
    'EXPEDITE_LOT',
    '{
        "lot_id": "ABC-123",
        "old_priority": 3,
        "new_priority": 1,
        "approved_by": "planner@example.com",
        "justification": "Customer commit at risk"
    }',
    '9z8y7x6w...',
    'f7e8d9c0...'
);
```

**Key Point:** Each action type has a different schema, but they all fit in one table!

---

### 3. **Common Queries**

```sql
-- 1. All actions for a lot
SELECT action_type, timestamp, details
FROM audit_log
WHERE details->>'lot_id' = 'ABC-123'
ORDER BY timestamp DESC;

-- 2. All high-risk detections (risk_score > 80)
SELECT details->>'lot_id' AS lot_id,
       (details->>'risk_score')::int AS risk_score,
       details->>'reason' AS reason
FROM audit_log
WHERE action_type = 'FLAG_LOT'
  AND (details->>'risk_score')::int > 80;

-- 3. All tickets for Litho-3
SELECT details->>'ticket_id' AS ticket_id,
       details->>'description' AS description,
       timestamp
FROM audit_log
WHERE action_type = 'CREATE_TICKET'
  AND details->>'tool_id' = 'Litho-3';

-- 4. All expedited lots by a specific planner
SELECT details->>'lot_id' AS lot_id,
       details->>'old_priority' AS old_priority,
       details->>'new_priority' AS new_priority
FROM audit_log
WHERE action_type = 'EXPEDITE_LOT'
  AND details->>'approved_by' = 'planner@example.com';

-- 5. Audit trail for last 24 hours
SELECT action_type, agent, timestamp, details
FROM audit_log
WHERE timestamp > now() - interval '24 hours'
ORDER BY timestamp DESC;
```

---

### 4. **Hash Chaining with JSONB**

```python
import hashlib
import json
from datetime import datetime

def add_audit_entry(agent, action_type, details):
    # Get previous hash
    cursor.execute("SELECT current_hash FROM audit_log ORDER BY timestamp DESC LIMIT 1")
    result = cursor.fetchone()
    previous_hash = result[0] if result else "0" * 64
    
    # Create entry (without current_hash)
    entry = {
        "agent": agent,
        "action_type": action_type,
        "timestamp": datetime.now().isoformat(),
        "details": details,
        "previous_hash": previous_hash
    }
    
    # Calculate hash
    entry_json = json.dumps(entry, sort_keys=True)
    current_hash = hashlib.sha256(entry_json.encode()).hexdigest()
    
    # Insert with hash
    cursor.execute("""
        INSERT INTO audit_log (agent, action_type, details, current_hash, previous_hash)
        VALUES (%s, %s, %s, %s, %s)
    """, [agent, action_type, json.dumps(details), current_hash, previous_hash])
    
    return current_hash

# Usage
add_audit_entry(
    agent="Risk_Detection",
    action_type="FLAG_LOT",
    details={
        "lot_id": "ABC-123",
        "risk_score": 87,
        "reason": "W1 OTIF risk detected"
    }
)
```

---

## Why JSONB + Hash Chaining?

### 1. **Flexibility** (JSONB)
Different action types need different fields:
- FLAG_LOT needs: lot_id, risk_score, reason
- CREATE_TICKET needs: ticket_id, tool_id, description
- EXPEDITE_LOT needs: lot_id, old_priority, new_priority, approved_by

With JSONB, all fit in one table.

---

### 2. **Tamper Evidence** (Hash Chaining)
Each entry contains:
- `details` (JSONB) - action-specific data
- `current_hash` - SHA-256 of entire entry
- `previous_hash` - hash from previous entry

If someone changes `details`, the hash breaks the chain.

```sql
-- Verify chain integrity
SELECT
    action_id,
    action_type,
    details,
    current_hash,
    previous_hash,
    -- Next entry's previous_hash should match current_hash
    LEAD(previous_hash) OVER (ORDER BY timestamp) AS next_previous_hash,
    -- Check if chain is intact
    CASE
        WHEN LEAD(previous_hash) OVER (ORDER BY timestamp) = current_hash THEN 'OK'
        WHEN LEAD(previous_hash) OVER (ORDER BY timestamp) IS NULL THEN 'OK'  -- Last entry
        ELSE 'BROKEN'
    END AS chain_status
FROM audit_log
ORDER BY timestamp;
```

---

## Advanced JSONB Features

### 1. **Aggregating JSONB**

```sql
-- Collect all actions per lot into an array
SELECT
    details->>'lot_id' AS lot_id,
    jsonb_agg(
        jsonb_build_object(
            'action_type', action_type,
            'timestamp', timestamp,
            'agent', agent
        ) ORDER BY timestamp
    ) AS actions
FROM audit_log
WHERE details ? 'lot_id'
GROUP BY details->>'lot_id';
```

---

### 2. **JSONB_PATH_QUERY (SQL/JSON Path)**

```sql
-- Extract nested values with path expressions
SELECT details #> '{evidence, 0, observation}' AS first_evidence
FROM audit_log
WHERE action_type = 'CLASSIFY_CAUSE';

-- Filter with path expressions
SELECT * FROM audit_log
WHERE details @? '$.evidence[*] ? (@.confidence > 0.9)';
```

---

### 3. **JSONB Validation (Check Constraint)**

```sql
-- Ensure FLAG_LOT actions have required fields
ALTER TABLE audit_log
ADD CONSTRAINT check_flag_lot_schema
CHECK (
    action_type != 'FLAG_LOT' OR (
        details ? 'lot_id' AND
        details ? 'risk_score' AND
        details ? 'reason'
    )
);

-- Now inserts without required fields fail
INSERT INTO audit_log (action_type, details, current_hash, previous_hash)
VALUES ('FLAG_LOT', '{"lot_id": "ABC-123"}', 'hash1', 'hash2');
-- ERROR: violates check constraint "check_flag_lot_schema"
```

---

## Interview Talking Points

### Q: "What is JSONB and why do you use it?"

**A:** "JSONB is PostgreSQL's binary JSON storage format. I use it for the audit log because different action types have different schemas—a 'FLAG_LOT' action has lot_id and risk_score, but a 'CREATE_TICKET' action has ticket_id and tool_id. With JSONB, I store all action types in one table with flexible details, instead of creating 20+ separate tables. JSONB is queryable and indexable, so I can still filter by lot_id or risk_score even though they're inside JSON. It's the best of both worlds: flexibility of MongoDB with the reliability of PostgreSQL."

---

### Q: "Why not just use MongoDB?"

**A:** "I need ACID transactions for the audit log—if an action and its hash chain entry aren't both committed, neither should be. MongoDB doesn't have the same transactional guarantees as PostgreSQL. Plus, most of my data is relational (WIP snapshots, route masters), so PostgreSQL is the natural choice. JSONB lets me have a flexible audit log schema without sacrificing transactions or SQL query power."

---

### Q: "How do you query JSONB efficiently?"

**A:** "I use GIN indexes on the JSONB column. Without an index, PostgreSQL would scan every row. With a GIN index, queries like 'find all actions for lot ABC-123' use the index and return results in milliseconds, even with millions of audit entries. For frequently queried fields like lot_id, I create an index on just that JSON field: `CREATE INDEX idx_lot_id ON audit_log ((details->>'lot_id'))`. This makes those queries as fast as querying a regular column."

---

### Q: "What's the downside of JSONB?"

**A:** "The main downside is lack of schema enforcement—there's no built-in guarantee that FLAG_LOT actions have a lot_id field. I handle this with check constraints and application-level validation with Pydantic. Also, JSONB queries are slightly slower than regular column queries, but with proper indexing, the difference is negligible. The flexibility is worth the trade-off for the audit log use case where action schemas vary."

---

### Q: "Why combine JSONB with hash chaining?"

**A:** "JSONB gives me flexible schema, and hash chaining gives me tamper evidence. The audit log needs both: flexibility because different actions have different fields, and tamper evidence because quality audits might happen months later and I need to prove the log wasn't altered. I hash the entire JSONB payload along with metadata, so if someone changes even one field in the JSON, the hash breaks the chain. It's cryptographic proof that the audit trail is intact."

---

## JSONB Cheat Sheet

```sql
-- Extract text
details->>'lot_id'

-- Extract JSONB
details->'evidence'->0

-- Extract nested
details #> '{evidence, 0, observation}'

-- Check key exists
details ? 'lot_id'

-- Contains
details @> '{"lot_id": "ABC-123"}'

-- Cast to other types
(details->>'risk_score')::int

-- Build JSONB
jsonb_build_object('key', 'value')

-- Aggregate to array
jsonb_agg(details)

-- Merge JSONB
details || '{"new_key": "new_value"}'

-- Remove key
details - 'old_key'

-- Set nested value
jsonb_set(details, '{evidence, 0}', '"new value"')
```

---

## Real-World Analogy

### JSONB = Filing Cabinet with Flexible Folders

**Regular columns = Pre-labeled folders**
- "Invoices" folder only holds invoices
- "Contracts" folder only holds contracts
- If you get a new document type? → Add a new cabinet!

**JSONB = Flexible folders**
- One cabinet, any document type
- Each document can have different fields
- Still organized and searchable (GIN index)
- No need to add cabinets for new types

---

## Summary

**JSONB** = Binary JSON storage in PostgreSQL (fast, queryable, indexable, flexible)

**Key Benefits:**
- ✅ Flexible schema (different action types, one table)
- ✅ Queryable (filter by JSON fields)
- ✅ Indexable (GIN index for fast queries)
- ✅ ACID transactions (unlike MongoDB)
- ✅ SQL power (joins, aggregations, window functions)
- ✅ No schema explosion (not 20+ tables)

**In Your Design:**
- Audit log with flexible action schemas
- Each action type has different JSONB fields
- Combined with SHA-256 hash chaining for tamper evidence
- GIN indexes for fast lot_id and ticket_id queries
- Single table for all actions (not 20+ tables)

**One-liner for interview:**
> "I use JSONB for the audit log because different action types have different schemas—FLAG_LOT has lot_id and risk_score, but CREATE_TICKET has ticket_id and tool_id. JSONB lets me store all action types in one table with flexible details, while still being queryable and indexable. Combined with hash chaining, I get both flexibility and tamper evidence."

You're ready! 🚀
