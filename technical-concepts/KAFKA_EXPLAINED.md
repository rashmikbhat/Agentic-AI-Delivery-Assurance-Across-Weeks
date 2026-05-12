# Kafka Explained - Event Streaming Platform

## TL;DR

**Kafka** = Super-fast message highway for streaming data between systems

**Think of it like:**
- Email = Send one message to one person
- Kafka = Broadcast system where multiple subscribers listen to a stream

---

## What Problem Does Kafka Solve?

### Without Kafka (Point-to-Point Integration Hell)

```
MES ──┐
      ├──→ Your Agent System
ERP ──┤
      ├──→ Warehouse System
Equipment┤
      └──→ Analytics Dashboard
```

**Problems:**
- Every system talks directly to every other system
- N×N connections = integration nightmare
- If MES goes down, everything breaks
- Hard to add new systems

---

### With Kafka (Event Streaming Hub)

```
MES ──┐        ┌──→ Your Agent System
      ├──→ KAFKA ──→ Warehouse System
ERP ──┤        ├──→ Analytics Dashboard
      │        └──→ Any new system!
Equipment ────┘
```

**Benefits:**
- One connection per system
- Decoupled = MES doesn't know who's listening
- Easy to add new consumers
- Events are **stored** (replay history!)

---

## Core Kafka Concepts

### 1. **Topics** (Channels/Categories)

Think of topics as **TV channels**. Each topic is a stream of related messages.

```
Topic: "mes.wip.changes"
├─ Message 1: Lot ABC-123 moved to Litho-3
├─ Message 2: Lot DEF-456 started Step 5
├─ Message 3: Lot GHI-789 on hold
└─ Message 4: Lot ABC-123 completed Step 3
```

**In Your Design:**
- `mes.wip.changes` - Lot position updates
- `equipment.status` - Tool up/down events
- `erp.commits` - Customer commit data
- `quality.alerts` - Defect alerts

---

### 2. **Producers** (Data Senders)

Systems that **write** events to Kafka topics.

```python
from kafka import KafkaProducer

producer = KafkaProducer(bootstrap_servers='localhost:9092')

# MES sends lot position update
producer.send('mes.wip.changes', {
    "lot_id": "ABC-123",
    "current_step": "Lithography",
    "timestamp": "2024-05-10T14:30:00Z"
})
```

**In Your Design:**
- MES = Producer (sends WIP updates)
- Equipment = Producer (sends tool status)
- ERP = Producer (sends commit data)
- Quality system = Producer (sends defect alerts)

---

### 3. **Consumers** (Data Receivers)

Systems that **read** events from Kafka topics.

```python
from kafka import KafkaConsumer

consumer = KafkaConsumer(
    'mes.wip.changes',
    bootstrap_servers='localhost:9092'
)

# Your agent system reads lot updates
for message in consumer:
    lot_update = message.value
    # Process update
    update_wip_snapshot_table(lot_update)
```

**In Your Design:**
- Your Agent System = Consumer (reads all topics)
- Warehouse System = Consumer (reads WIP changes)
- Analytics = Consumer (reads everything)

---

### 4. **Partitions** (Parallelism)

Topics are split into **partitions** for parallel processing.

```
Topic: mes.wip.changes (3 partitions)

Partition 0: ├─ Lot A ─ Lot D ─ Lot G ─→
Partition 1: ├─ Lot B ─ Lot E ─ Lot H ─→
Partition 2: └─ Lot C ─ Lot F ─ Lot I ─→
```

**Benefits:**
- Process 3 lots in parallel
- Horizontal scaling

**Partition Key:**
```python
# Send all messages for same lot to same partition (ordering!)
producer.send(
    'mes.wip.changes',
    value=lot_update,
    key=lot_id  # Lot ABC-123 always → Partition 0
)
```

**Why:** Messages in **same partition** are guaranteed ordered. Lot ABC-123's events arrive in order.

---

### 5. **Consumer Groups** (Load Balancing)

Multiple consumers work together to process one topic.

```
Topic: mes.wip.changes (3 partitions)

Consumer Group: "agent-system"
├─ Consumer 1 reads Partition 0
├─ Consumer 2 reads Partition 1
└─ Consumer 3 reads Partition 2
```

**Benefits:**
- Parallel processing (3x faster!)
- If Consumer 1 dies, Kafka rebalances (Consumer 2 takes Partition 0)

---

### 6. **Offset** (Bookmark)

Each consumer tracks its position (offset) in the topic.

```
Topic: mes.wip.changes
├─ Message 0 ✅ (read)
├─ Message 1 ✅ (read)
├─ Message 2 ✅ (read)
├─ Message 3 ← Consumer is here (offset=3)
├─ Message 4 (unread)
└─ Message 5 (unread)
```

**Why This Matters:**
- Consumer crashes? No problem—restart at offset=3
- Want to replay history? Reset offset to 0
- Multiple consumers? Each tracks own offset

---

### 7. **Retention** (How Long to Keep Data)

Kafka **stores** messages for a configurable time (e.g., 7 days).

```
Day 1: Message A
Day 2: Message B
Day 3: Message C
...
Day 7: Message G
Day 8: Message A expires (deleted after 7 days)
```

**In Your Design:**
- W1 data: Keep 7 days (short-term)
- W2-W4 data: Keep 30 days (long-term)
- Audit events: Keep forever (write to database)

---

## Kafka Terms Cheat Sheet

| Term | Simple Explanation | Real-World Analogy |
|------|-------------------|-------------------|
| **Topic** | Category of messages | TV channel |
| **Producer** | Sender of messages | TV broadcaster |
| **Consumer** | Reader of messages | TV viewer |
| **Partition** | Subdivision of topic for parallelism | Multiple lanes on highway |
| **Offset** | Position in topic (bookmark) | Page number in book |
| **Consumer Group** | Team of consumers working together | Assembly line workers |
| **Broker** | Kafka server (stores messages) | Post office |
| **Cluster** | Multiple brokers working together | Multiple post offices |
| **Replication** | Copy of data for fault tolerance | Backup copy |

---

## Kafka in Your Design

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                        KAFKA                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Topic: mes.wip.changes                                 │
│  ├─ Lot ABC-123 at Litho-3 (timestamp: 14:25)         │
│  └─ Lot DEF-456 on hold (timestamp: 14:26)            │
│                                                         │
│  Topic: equipment.status                                │
│  ├─ Litho-3 DOWN (timestamp: 14:15)                   │
│  └─ Litho-3 UP (timestamp: 18:00)                     │
│                                                         │
│  Topic: erp.commits                                     │
│  └─ W1 commit: 5000 units DRAM-DDR5                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
                  YOUR AGENT SYSTEM
                  (Consumer Group)
                          ↓
                   PostgreSQL
              (wip_snapshot, tool_status)
```

### Why Kafka for Your Design

1. **Real-time W1 data** - Equipment events arrive in <100ms
2. **Decoupling** - MES doesn't need to know about your agent system
3. **Replay** - If agent crashes, replay last hour of events
4. **Scalability** - Add more consumers if data volume increases
5. **Multiple consumers** - Analytics team can also read same stream

---

## Advanced Kafka Terms

### 1. **Schema Registry** (Data Contract)

**Problem:** Producer sends bad data format
```json
{"lot_id": "ABC-123"}  ← Missing required field "current_step"
```

**Solution:** Schema Registry enforces schema
```json
// Avro Schema
{
  "type": "record",
  "name": "LotUpdate",
  "fields": [
    {"name": "lot_id", "type": "string"},
    {"name": "current_step", "type": "string"},  // REQUIRED
    {"name": "timestamp", "type": "long"}
  ]
}
```

If producer sends bad data → **rejected** before reaching Kafka!

**In Your Design:** "Avro format with Schema Registry" on Slide 2

---

### 2. **CDC (Change Data Capture)** with Debezium

**Problem:** How to get MES database changes into Kafka?

**Solution:** Debezium watches MES database and streams changes to Kafka.

```
MES Database (PostgreSQL)
├─ INSERT INTO lots (lot_id='ABC-123', step='Litho')
└─ UPDATE lots SET step='Etch' WHERE lot_id='ABC-123'
       ↓ Debezium CDC watches database
       ↓
Kafka Topic: mes.wip.changes
├─ {op: "INSERT", lot_id: "ABC-123", step: "Litho"}
└─ {op: "UPDATE", lot_id: "ABC-123", step: "Etch"}
```

**In Your Design:** "Debezium CDC → Kafka" on Slide 2

**Why CDC vs REST API?**
- REST API = poll every few seconds ("give me changes since last check")
- CDC = database pushes changes automatically as they happen
- CDC is more efficient and lower latency

---

### 3. **Avro** (Data Serialization Format)

**Problem:** How to encode data efficiently for Kafka?

**Options:**
- JSON: Human-readable but large and slow
- Avro: Binary format, compact and fast

**Example Comparison:**

```json
// JSON (82 bytes)
{
  "lot_id": "ABC-123",
  "current_step": "Lithography", 
  "timestamp": 1715356800
}

// Avro binary (23 bytes)
[encoded binary data with schema reference]
```

**Avro Benefits:**
1. **Compact**: 3-4× smaller than JSON (saves network bandwidth)
2. **Fast**: Binary parsing is faster than text parsing
3. **Schema evolution**: Can add new fields without breaking old consumers
4. **Type safety**: Schema enforces data types (no "timestamp" as string)

**How Avro Works with Schema Registry:**

```
Producer:
1. Define schema once in Schema Registry
   Schema ID: 123 → LotUpdate schema
   
2. Serialize data with schema ID
   [Schema ID: 123][Binary data...]
   
Consumer:
1. Read message, extract Schema ID: 123
2. Fetch schema from Schema Registry
3. Deserialize binary data using schema
```

**In Your Design:** "Avro format with Schema Registry" for MES data
- MES publishes lot updates in Avro (compact, fast)
- Schema Registry ensures all messages follow contract

---

### 4. **MQTT** (IoT Protocol for Equipment Events)

**MQTT** = Message Queuing Telemetry Transport (lightweight pub/sub protocol)

**Think of it like:**
- Kafka = Heavy-duty truck for bulk data
- MQTT = Sports car for quick messages from IoT devices

**Why MQTT for Equipment?**

Manufacturing equipment (PLCs, sensors) needs:
- **Lightweight**: Runs on low-power devices
- **Low latency**: Tool status changes need immediate notification
- **Reliable**: Handle network interruptions gracefully

**MQTT Architecture:**

```
Equipment Sensors (MQTT Publishers)
├─ Litho-3 PLC
├─ Etch-5 PLC  
└─ CMP-2 PLC
      ↓ MQTT messages
HiveMQ Broker (MQTT Server)
      ↓ Bridge to Kafka
Kafka Topic: equipment.status
      ↓
Your Agent System (Consumer)
```

**MQTT vs HTTP:**

| Aspect | MQTT | HTTP REST |
|--------|------|-----------|
| **Protocol** | Pub/Sub | Request/Response |
| **Overhead** | ~2 bytes header | ~300 bytes header |
| **Connection** | Persistent | One-time |
| **Latency** | <10ms | 50-100ms |
| **Battery** | Efficient | Drains faster |
| **Use case** | IoT sensors | Web APIs |

**MQTT Topics (similar to Kafka):**

```
equipment/litho/litho-3/status → "DOWN"
equipment/litho/litho-3/status → "UP"
equipment/etch/etch-5/utilization → 0.95
equipment/cmp/cmp-2/alarm → "PM_DUE"
```

**In Your Design:** "Equipment comes from MQTT into Kafka"
- Equipment PLCs publish status changes via MQTT
- MQTT broker bridges messages to Kafka
- Your agent system consumes from Kafka (one unified stream)

**Why bridge MQTT → Kafka?**
- Kafka provides retention (MQTT doesn't store history)
- Kafka enables replay (reprocess last hour of events)
- Kafka unifies all data streams (MES + Equipment + ERP in one place)

---

### 5. **Protobuf** (Protocol Buffers - Another Serialization Format)

**Protobuf** = Google's binary serialization format (alternative to Avro)

**Avro vs Protobuf:**

| Feature | Avro | Protobuf |
|---------|------|----------|
| **Creator** | Apache | Google |
| **Schema** | JSON-based | .proto files |
| **Compactness** | Very compact | Very compact |
| **Evolution** | Better (no field numbers) | Good (numbered fields) |
| **Speed** | Fast | Slightly faster |
| **Ecosystem** | Kafka standard | Google services |

**Example Protobuf Schema:**

```protobuf
// equipment_event.proto
message EquipmentEvent {
  string tool_id = 1;
  string status = 2;  // UP, DOWN, IDLE
  int64 timestamp = 3;
  float utilization = 4;
}
```

**In Your Design:** "Protobuf format" for equipment events
- Equipment events use Protobuf (slightly faster than Avro)
- MES uses Avro (better schema evolution for complex records)
- Both are binary formats (compact and fast)

**Why different formats?**
- **MES (Avro)**: Complex nested records (lot → route → steps), schema changes frequently
- **Equipment (Protobuf)**: Simple flat messages, speed critical, schema stable

---

### 6. **Kafka Connect** (Pre-Built Connectors)

Kafka Connect = Library of pre-built producers/consumers

```
Kafka Connect Sources (Producers):
├─ Debezium Source (CDC from database)
├─ MQTT Source (IoT devices)
├─ S3 Source (files from S3)
└─ REST API Source

Kafka Connect Sinks (Consumers):
├─ PostgreSQL Sink (write to database)
├─ S3 Sink (write to S3)
├─ Elasticsearch Sink
└─ Snowflake Sink
```

**In Your Design:** You could use Kafka Connect PostgreSQL Sink instead of writing custom consumer.

---

## Interview Talking Points

### Q: "Why Kafka instead of a database?"

**A:** "Kafka is for streaming data, not static data. My agent system needs real-time updates—when a tool goes down, I need to know within seconds, not minutes. With a database, I'd have to poll every 10 seconds ('SELECT * WHERE updated_at > last_check'), which is inefficient. Kafka pushes events to me immediately. Plus, Kafka decouples systems—MES doesn't need to know about my agent system. It just publishes to a topic, and anyone can subscribe."

---

### Q: "What happens if your consumer crashes?"

**A:** "Kafka tracks consumer offsets—where I left off in the topic. When my consumer restarts, it resumes from the last committed offset, so no data is lost. If I need to reprocess recent data, I can reset the offset to replay events. Kafka also replicates data across brokers, so even if a Kafka server fails, data is still available from replicas."

---

### Q: "Why not just use REST APIs?"

**A:** "REST APIs are pull-based—I'd have to poll MES every few seconds to check for updates. That's inefficient and delays. Kafka is push-based—events arrive immediately. Also, REST APIs don't store history. If my agent is down for 10 minutes, I lose those updates. Kafka retains events for days, so I can catch up when I restart."

---

### Q: "What if Kafka goes down?"

**A:** "I have a fallback: PostgreSQL CDC with a 30-second lag. I show a 'DEGRADED MODE' banner so planners know data is slightly behind. This is in my failure modes on Slide 1. For production, Kafka clusters have replication—data is copied across 3 brokers, so one broker failing doesn't bring down Kafka. But I still want a fallback for extreme cases."

---

## Common Kafka Patterns

### Pattern 1: Event-Driven Microservices
```
Order Service → Kafka (order.created) → Inventory Service
                                      → Shipping Service
                                      → Notification Service
```

### Pattern 2: Real-Time Analytics
```
Clickstream → Kafka → Stream Processing (Apache Flink) → Dashboard
```

### Pattern 3: Data Pipeline (Your Design!)
```
MES → Kafka → Consumer → PostgreSQL → Agent System
```

---

## Kafka vs Alternatives

| Feature | Kafka | RabbitMQ | AWS SQS | Database Polling |
|---------|-------|----------|---------|-----------------|
| **Speed** | Very fast | Fast | Moderate | Slow |
| **Retention** | Days/weeks | Temporary | 14 days | Forever |
| **Ordering** | Per partition | Per queue | FIFO queues | Manual |
| **Replay** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Throughput** | Millions/sec | Thousands/sec | High | Depends |
| **Use Case** | Event streaming | Task queues | Simple queues | Static data |

**Why Kafka for your design:** High throughput, retention, replay capability, real-time.

---

## Summary

**Kafka** = Event streaming platform that acts as a message highway between systems.

**Key Benefits:**
- ✅ Real-time (push, not poll)
- ✅ Decoupled (systems don't talk directly)
- ✅ Scalable (partitions + consumer groups)
- ✅ Reliable (replication + offset tracking)
- ✅ History (retention + replay)

**In Your Design:**
- MES/Equipment/ERP publish to Kafka topics
- Your agent system consumes from Kafka
- Real-time W1 data (<100ms for equipment events)
- 2-hour batch for W1/W2, 3x/week for W3/W4

**One-liner for interview:**
> "I use Kafka for event streaming because it gives me real-time data ingestion, decouples my agent system from source systems, and retains events so I can replay if my consumer crashes."

---

## Your Design: Complete Data Ingestion Flow

Let me tie everything together for your interview:

### MES Data (Lot Tracking)

```
MES PostgreSQL Database
    ↓ Debezium CDC (Change Data Capture)
Kafka Topic: mes.wip.changes
    ↓ Avro format (compact binary)
    ↓ Schema Registry (enforces LotUpdate schema)
    ↓ Consumer Group: agent-system
PostgreSQL wip_snapshot table
    ↓ Batch updates every 15-30 minutes
Risk Detection Agent (runs every 2 hours)
```

**Key technologies:**
- **CDC (Debezium)**: Automatically captures database changes
- **Avro**: Binary serialization (3-4× smaller than JSON)
- **Schema Registry**: Enforces data contract

**Interview answer:**
> "MES data comes via Debezium CDC streaming into Kafka. I use Avro format for compact binary serialization—about 3× smaller than JSON—with Schema Registry to enforce the data contract. This ensures all messages have required fields. Batch updates happen every 15-30 minutes, which is sufficient since Risk Detection only runs every 2 hours."

---

### Equipment Data (Tool Status)

```
Equipment PLCs (Programmable Logic Controllers)
    ↓ MQTT protocol (lightweight IoT)
HiveMQ Broker (MQTT server)
    ↓ MQTT → Kafka bridge
Kafka Topic: equipment.status
    ↓ Protobuf format (fast binary)
    ↓ Consumer Group: agent-system
PostgreSQL tool_status table
    ↓ Updates within minutes
    ↓ Critical events (tool down) → Immediate Slack alert
Risk Detection Agent OR Real-Time Alert
```

**Key technologies:**
- **MQTT**: Lightweight pub/sub protocol for IoT devices (<10ms latency)
- **HiveMQ**: MQTT broker that bridges to Kafka
- **Protobuf**: Google's binary format (slightly faster than Avro)

**Why two paths?**
1. **Data path**: Equipment events → Kafka → PostgreSQL → Risk Detection (every 2 hours)
2. **Alert path**: Critical events → Immediate Slack notification (seconds)

**Interview answer:**
> "Equipment data comes via MQTT—a lightweight IoT protocol perfect for PLCs with <10ms latency. I use HiveMQ broker to bridge MQTT messages into Kafka in Protobuf format, which is slightly faster than Avro for simple flat messages. Critically, I separate data ingestion from alerting: equipment events land in PostgreSQL for Risk Detection's 2-hour refresh, but critical events like tool down at a bottleneck trigger immediate Slack alerts to maintenance—that's the real-time path bypassing the agent entirely."

---

### ERP Data (Customer Commits)

```
ERP System (SAP, Oracle)
    ↓ Airflow DAG (scheduled batch)
    ↓ Dump to S3 (CSV export)
    ↓ Convert to Parquet (columnar format)
    ↓ Stream to Kafka
Kafka Topic: erp.commits
    ↓ Parquet format
    ↓ Consumer Group: agent-system
PostgreSQL capacity_vs_demand table
    ↓ Daily updates
Risk Detection Agent (uses for W1-W4 planning)
```

**Key technologies:**
- **Airflow**: Workflow orchestration for scheduled ETL
- **S3**: Object storage for staging data
- **Parquet**: Columnar storage format (efficient for analytics)

**Why daily?**
- ERP only updates customer commits once per day
- More frequent polling wastes API calls
- W3-W4 planning doesn't need hourly updates

**Interview answer:**
> "ERP data comes daily via Airflow DAG. ERP only updates once daily, so polling more frequently would waste API calls. Airflow dumps to S3, converts CSV to Parquet for efficient columnar storage, then streams to Kafka. This feeds the capacity vs demand table that Risk Detection uses for W1-W4 planning."

---

### Quality Data (Defects & Scrap)

```
Quality System (SPC, Yield Management)
    ↓ REST API (hourly batch + real-time webhooks)
Kafka Topic: quality.alerts
    ↓ JSON format (human-readable for debugging)
    ↓ Consumer Group: agent-system
PostgreSQL quality_events table
    ↓ Hourly batch updates
    ↓ Critical defects → Immediate Slack alert
Risk Detection Agent OR Real-Time Alert
```

**Key technologies:**
- **REST API**: Pull hourly batch, push critical alerts via webhooks
- **JSON**: Human-readable (easier to debug quality events)

**Why two paths again?**
1. **Batch path**: Hourly updates for trend analysis
2. **Alert path**: Scrap spike → Immediate Slack to quality engineers

**Interview answer:**
> "Quality data comes from REST API with hourly batch pulls plus immediate webhooks for critical defects. I use JSON format here—not Avro or Protobuf—because quality events often need human inspection and JSON is easier to debug. Like equipment, I have two paths: hourly batch for trend analysis, and immediate Slack alerts when scrap spikes above threshold."

---

## Technology Decision Summary

| Data Source | Protocol | Serialization | Why This Choice |
|------------|----------|---------------|-----------------|
| **MES** | CDC (Debezium) | Avro | Automatic capture, compact, schema evolution |
| **Equipment** | MQTT → Kafka | Protobuf | Lightweight IoT, fast binary, low latency |
| **ERP** | Airflow → S3 → Kafka | Parquet | Scheduled batch, columnar analytics |
| **Quality** | REST API → Kafka | JSON | Easy debugging, human-readable |

**Pattern:** All roads lead to Kafka → unified event stream → PostgreSQL → Agent System

---

## Interview Talking Points

### Q: "Why so many different formats? Why not just use JSON for everything?"

**A:** "I match serialization format to use case. Avro for MES because I have complex nested records and schema evolution—when engineering adds a new field to lot tracking, Avro handles it gracefully. Protobuf for equipment because those are simple flat messages where speed is critical—equipment events need sub-second processing. Parquet for ERP because it's columnar and optimized for analytics queries. JSON for quality because quality engineers need to inspect defect details and JSON is human-readable. Each choice is deliberate—not just 'use JSON everywhere.'"

---

### Q: "What's the difference between Kafka and MQTT?"

**A:** "MQTT is a lightweight pub/sub protocol designed for IoT devices—think equipment PLCs with limited CPU and intermittent network. It has tiny message overhead (<10ms latency) and handles disconnections gracefully. Kafka is a distributed event streaming platform designed for high throughput and retention. Equipment uses MQTT to publish status changes, then I bridge those messages into Kafka for storage, replay, and unified consumption. MQTT is the 'last mile' protocol; Kafka is the central data highway."

---

### Q: "Why CDC instead of polling the MES database?"

**A:** "CDC is push-based—Debezium watches the MES database transaction log and streams changes automatically. Polling is pull-based—I'd have to query 'SELECT * WHERE updated_at > last_check' every 10 seconds. That's inefficient, adds load to MES, and has higher latency. CDC gives me changes within seconds of commit with zero load on MES queries. Plus, CDC captures every change—polling might miss rapid updates between polls."

You're ready! 🚀
