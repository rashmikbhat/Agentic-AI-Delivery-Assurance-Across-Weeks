# Kubernetes Explained - Container Orchestration Platform

## TL;DR

**Kubernetes (K8s)** = Auto-pilot for containers that handles scaling, healing, and deploying your apps

**Think of it like:**
- Docker = Shipping container (packages your app)
- Kubernetes = Port management system (decides which ship, how many containers, where they go)

---

## What Problem Does Kubernetes Solve?

### Without Kubernetes (Manual Container Management)

You have 6 agents in Docker containers:
```
Server 1: Risk_Detection container (running)
Server 2: Cause_Classifier container (crashed at 3am!)
Server 3: Follow_Up container (overloaded, need 3 more)
Server 4: Trade_Off container (running)
```

**Problems:**
- Agent crashes? You manually SSH and restart it
- Need more Follow-Up agents? Manually spin up containers
- Server dies? All containers on it are gone
- Rolling update? Stop each container, update, restart (downtime!)
- Load balancing? You manually configure nginx

**You're the operations team, working 24/7.** 😫

---

### With Kubernetes (Auto-Pilot)

```
Tell Kubernetes: "I want 3 Follow_Up agents, always running"

Kubernetes:
✅ Schedules containers across servers
✅ Restarts crashed containers automatically
✅ Scales to 5 agents when load increases
✅ Moves containers if a server dies
✅ Load balances traffic across replicas
✅ Rolling updates with zero downtime
```

**You're asleep. Kubernetes handles it.** 😴

---

## Core Kubernetes Concepts

### 1. **Cluster** (The Kingdom)

A **cluster** = group of servers (nodes) managed by Kubernetes

```
Kubernetes Cluster
├─ Control Plane (brain)
│  ├─ API Server (receives commands)
│  ├─ Scheduler (decides where to put containers)
│  └─ Controller Manager (watches state)
│
└─ Worker Nodes (muscle)
   ├─ Node 1 (server with 8 CPU, 32GB RAM)
   ├─ Node 2 (server with 8 CPU, 32GB RAM)
   └─ Node 3 (server with 8 CPU, 32GB RAM)
```

**In Your Design:**
- 3-node Kubernetes cluster
- Control Plane manages 6 agent deployments
- Worker nodes run the actual containers

---

### 2. **Pod** (The Smallest Unit)

A **Pod** = one or more containers running together

Think: Pod = shipping container (but the actual thing that runs)

```
Pod: cause-classifier-abc123
├─ Container: cause-classifier (main app)
├─ Container: sidecar-logging (collects logs)
└─ Shared: Network, Storage
```

**In Your Design:**
```
Pod: risk-detection-xyz789
└─ Container: risk-detection (Python app)

Pod: cause-classifier-abc123
└─ Container: cause-classifier (LLM agent)
```

**Key Points:**
- 1 Pod = 1 replica of an agent
- Pods are ephemeral (can die and restart)
- Each Pod gets an IP address

---

### 3. **Deployment** (The Blueprint)

A **Deployment** = desired state for your app

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: follow-up-agent
spec:
  replicas: 3  # I want 3 copies running
  selector:
    matchLabels:
      app: follow-up
  template:
    metadata:
      labels:
        app: follow-up
    spec:
      containers:
      - name: follow-up
        image: my-registry/follow-up:v1.2
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "1000m"
            memory: "2Gi"
```

**What Kubernetes Does:**
1. Creates 3 Pods from this template
2. Spreads them across nodes
3. If one crashes → restarts it
4. If node dies → recreates Pods elsewhere
5. If you change replicas to 5 → adds 2 more

**In Your Design:**
- 6 Deployments (one per agent)
- Risk_Detection: 2 replicas
- Cause_Classifier: 3 replicas (LLM calls, needs more)
- Follow_Up: 3 replicas (external API calls)
- Trade_Off: 2 replicas
- Action_Executor: 2 replicas
- Data_Quality: 1 replica

---

### 4. **Service** (Load Balancer)

A **Service** = stable endpoint to reach your Pods

**Problem:** Pods have dynamic IPs (they die and restart with new IPs)

**Solution:** Service gives a stable DNS name

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: cause-classifier
spec:
  selector:
    app: cause-classifier
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
```

**What This Does:**
```
cause-classifier.default.svc.cluster.local
    ↓ (load balances across)
├─ Pod 1: 10.0.1.5:8000
├─ Pod 2: 10.0.1.8:8000
└─ Pod 3: 10.0.1.12:8000
```

**In Your Design:**
- Each agent has a Service
- LangGraph calls `http://cause-classifier/classify`
- Kubernetes load balances to one of 3 Pods

---

### 5. **ConfigMap** (Configuration Storage)

A **ConfigMap** = key-value store for config (not secrets)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-config
data:
  KAFKA_BROKER: "kafka.default.svc.cluster.local:9092"
  POSTGRES_HOST: "postgres.default.svc.cluster.local"
  LOG_LEVEL: "INFO"
```

**Use in Deployment:**
```yaml
spec:
  containers:
  - name: risk-detection
    envFrom:
    - configMapRef:
        name: agent-config
```

**In Your Design:**
- ConfigMap for Kafka broker URLs
- ConfigMap for PostgreSQL connection strings
- ConfigMap for agent thresholds (risk_threshold=70)

---

### 6. **Secret** (Sensitive Data)

A **Secret** = like ConfigMap but for passwords, API keys

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
type: Opaque
data:
  OPENAI_API_KEY: c2stcHJvai1YWVo...  # base64 encoded
  SLACK_TOKEN: eG94Yi1wcm9qLTEyMzQ=
```

**Use in Deployment:**
```yaml
spec:
  containers:
  - name: cause-classifier
    env:
    - name: OPENAI_API_KEY
      valueFrom:
        secretKeyRef:
          name: api-keys
          key: OPENAI_API_KEY
```

**In Your Design:**
- Secret for LLM API keys
- Secret for CMMS credentials
- Secret for Slack tokens

---

### 7. **Namespace** (Virtual Clusters)

A **Namespace** = logical grouping within a cluster

```
Cluster
├─ Namespace: production
│  ├─ risk-detection (prod version)
│  ├─ cause-classifier (prod version)
│  └─ ...
│
├─ Namespace: staging
│  ├─ risk-detection (staging version)
│  └─ ...
│
└─ Namespace: dev
   └─ ...
```

**In Your Design:**
- `production` namespace for live agents
- `staging` namespace for testing changes
- `dev` namespace for local development

---

### 8. **Ingress** (External Access)

An **Ingress** = HTTP(S) router to expose services outside the cluster

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agent-dashboard
spec:
  rules:
  - host: agents.micron.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: dashboard
            port:
              number: 80
```

**What This Does:**
```
User → agents.micron.com → Ingress → dashboard Service → Dashboard Pod
```

**In Your Design:**
- Ingress for planner dashboard (https://delivery-assurance.micron.com)
- Ingress for monitoring UI

---

## Kubernetes vs Docker Alone

| Feature | Docker Alone | Kubernetes |
|---------|-------------|------------|
| **Run containers** | ✅ Yes | ✅ Yes |
| **Auto-restart crashed** | ❌ No (unless docker-compose restart) | ✅ Yes |
| **Scale replicas** | ❌ Manual (docker-compose scale) | ✅ Auto (HPA) |
| **Load balancing** | ❌ Need nginx | ✅ Built-in (Service) |
| **Rolling updates** | ❌ Downtime | ✅ Zero downtime |
| **Health checks** | ❌ Basic | ✅ Liveness/Readiness probes |
| **Multi-server** | ❌ Docker Swarm needed | ✅ Native |
| **Self-healing** | ❌ No | ✅ Yes |

---

## Advanced Kubernetes Features

### 1. **Horizontal Pod Autoscaler (HPA)**

Automatically scale Pods based on CPU/memory

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cause-classifier-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cause-classifier
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**What This Does:**
- Normally: 2 replicas
- CPU > 70%? → Scale up (max 10)
- CPU < 70%? → Scale down (min 2)

**In Your Design:**
- HPA for Cause_Classifier (LLM calls spike during shifts)
- HPA for Follow_Up (external API calls vary)

---

### 2. **Liveness and Readiness Probes**

**Liveness Probe** = "Is the container alive?"
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
```
If this fails → Kubernetes kills and restarts the Pod

**Readiness Probe** = "Is the container ready to serve traffic?"
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
```
If this fails → Kubernetes removes Pod from Service (no traffic sent)

**In Your Design:**
- Liveness: Agent responds to /health
- Readiness: Agent has loaded models and connected to Kafka

---

### 3. **Rolling Updates (Zero Downtime)**

Update your app without downtime:

```bash
# Before: risk-detection:v1.0 (3 replicas)
kubectl set image deployment/risk-detection risk-detection=risk-detection:v1.1
```

**What Happens:**
```
1. Start new Pod (v1.1) ───────────┐
2. Wait for readiness probe       │ (old Pods still serving traffic)
3. Old Pod removed from Service   │
4. Repeat for remaining Pods      │
5. All Pods now v1.1 ─────────────┘ (zero downtime!)
```

**Rollback if it fails:**
```bash
kubectl rollout undo deployment/risk-detection
```

**In Your Design:**
- Deploy new agent versions without downtime
- Rollback if Cause_Classifier v2.0 has issues

---

### 4. **StatefulSet** (For Databases)

**Deployment** = stateless (Pods are interchangeable)  
**StatefulSet** = stateful (Pods have stable identity)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 3
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

**Key Difference:**
- Pods have stable names: postgres-0, postgres-1, postgres-2
- Each Pod has its own persistent volume
- Used for databases, Kafka, etc.

**In Your Design:**
- StatefulSet for PostgreSQL (3 replicas with replication)
- StatefulSet for Kafka brokers

---

## Kubernetes in Your Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Kubernetes Cluster                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Namespace: production                                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Deployment: risk-detection (2 replicas)             │  │
│  │ ├─ Pod: risk-detection-abc123                       │  │
│  │ └─ Pod: risk-detection-xyz789                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Deployment: cause-classifier (3 replicas, HPA)      │  │
│  │ ├─ Pod: cause-classifier-aaa111                     │  │
│  │ ├─ Pod: cause-classifier-bbb222                     │  │
│  │ └─ Pod: cause-classifier-ccc333                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Deployment: follow-up (3 replicas)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ StatefulSet: postgres (3 replicas)                  │  │
│  │ ├─ postgres-0 (primary)                             │  │
│  │ ├─ postgres-1 (replica)                             │  │
│  │ └─ postgres-2 (replica)                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ StatefulSet: kafka (3 brokers)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ConfigMaps: agent-config, kafka-config                    │
│  Secrets: api-keys, db-passwords                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why Kubernetes for Your Design

1. **Auto-scaling** - Cause_Classifier scales from 2 to 10 replicas during peak hours
2. **Self-healing** - If Follow_Up agent crashes, K8s restarts it in <10 seconds
3. **Zero-downtime updates** - Deploy new agent versions without stopping production
4. **Resource efficiency** - Pack multiple agents on same server, K8s optimizes placement
5. **High availability** - If a server dies, Pods move to healthy servers
6. **Easy rollback** - If Cause_Classifier v2.0 has bugs, rollback to v1.5 in one command

---

## Interview Talking Points

### Q: "Why Kubernetes instead of just running Docker containers?"

**A:** "Docker containers run the agents, but Kubernetes orchestrates them. Without Kubernetes, if the Cause Classifier crashes at 3am, I'd have to manually SSH and restart it. With Kubernetes, it auto-restarts in seconds. Plus, during peak hours when lot volume spikes, Kubernetes auto-scales the Cause Classifier from 2 to 5 replicas based on CPU usage. I also get zero-downtime deployments—I can update an agent without stopping production. Kubernetes is the difference between babysitting containers and having an auto-pilot."

---

### Q: "Isn't Kubernetes overkill for 6 agents?"

**A:** "For a toy demo, yes. But in production, I need reliability and scalability. Manufacturing runs 24/7, and planners depend on this system. If an agent crashes, Kubernetes restarts it automatically. If we expand from one fab to five, Kubernetes handles the scaling without code changes. The alternative is writing custom monitoring, auto-restart scripts, and load balancing logic—essentially rebuilding parts of Kubernetes. Using a proven orchestrator saves time and reduces risk."

---

### Q: "What happens if Kubernetes itself goes down?"

**A:** "Kubernetes has a highly available control plane—typically 3 control plane nodes. If one fails, the others take over. For the worker nodes, Kubernetes spreads Pods across multiple servers. If a worker node dies, Kubernetes reschedules Pods to healthy nodes within seconds. The only way the entire system goes down is if all nodes fail simultaneously, which is protected against with proper cluster architecture (multiple availability zones, backups)."

---

### Q: "How do agents communicate in Kubernetes?"

**A:** "Agents communicate via Kafka for event streaming and via Services for direct calls. For example, the Risk Detection agent publishes alerts to Kafka, and the Cause Classifier subscribes. For synchronous calls, like the Trade-Off Engine querying the Risk Detection API, it calls the Service DNS name: `http://risk-detection.production.svc.cluster.local/api/risk`. Kubernetes load balances that request across the 2 replicas. This keeps agents decoupled and scalable."

---

### Q: "What about cost? Isn't Kubernetes expensive?"

**A:** "Kubernetes itself is open-source and free. The cost is the underlying infrastructure—servers or cloud VMs. But Kubernetes actually reduces cost by efficiently packing workloads. Instead of dedicating one server per agent (6 servers), Kubernetes packs all agents onto 3 servers, saving 50%. Plus, auto-scaling means I only pay for extra capacity during peak hours, not 24/7. Compared to manual container management or over-provisioned VMs, Kubernetes is cost-effective at scale."

---

### Q: "How do you monitor agents in Kubernetes?"

**A:** "Kubernetes exposes metrics via Prometheus—CPU, memory, request rates, error rates. I visualize these in Grafana dashboards. Kubernetes also has built-in logging: I ship container logs to an ELK stack (Elasticsearch, Logstash, Kibana) for centralized searching. For agent-specific observability, I use the tracing platform to see LLM calls, tool executions, and latency per agent. Kubernetes makes monitoring easier because all metrics and logs are standardized."

---

## Common Kubernetes Commands

### View Pods
```bash
kubectl get pods -n production
```

### View Deployments
```bash
kubectl get deployments -n production
```

### Scale a Deployment
```bash
kubectl scale deployment cause-classifier --replicas=5
```

### Update Image (Rolling Update)
```bash
kubectl set image deployment/risk-detection risk-detection=risk-detection:v1.2
```

### View Logs
```bash
kubectl logs -f risk-detection-abc123
```

### Exec into Pod
```bash
kubectl exec -it risk-detection-abc123 -- bash
```

### Describe Pod (Debugging)
```bash
kubectl describe pod risk-detection-abc123
```

### Rollback Deployment
```bash
kubectl rollout undo deployment/cause-classifier
```

### View Events (What Happened)
```bash
kubectl get events --sort-by=.metadata.creationTimestamp
```

---

## Kubernetes Alternatives

| Tool | Use Case | Comparison |
|------|---------|------------|
| **Docker Compose** | Single-server | ❌ No multi-server, no auto-scaling |
| **Docker Swarm** | Multi-server orchestration | ⚠️ Simpler but less powerful than K8s |
| **Nomad** | Multi-datacenter orchestration | ✅ Lighter than K8s, but smaller ecosystem |
| **AWS ECS** | AWS-only | ✅ Simpler if on AWS, but vendor lock-in |
| **Kubernetes** | Industry standard | ✅ Most powerful, portable, huge ecosystem |

**Why Kubernetes:** Industry standard, works anywhere (on-prem, AWS, Azure, GCP), huge community, battle-tested at scale.

---

## Real-World Analogy

### Kubernetes = Airport Control Tower

**Without Kubernetes (Manual):**
- You're the air traffic controller
- Plane crashes? You manually dispatch a replacement
- Too many passengers? You manually add more planes
- Plane needs maintenance? You coordinate the downtime

**With Kubernetes (Auto-Pilot):**
- Control tower monitors all planes
- Plane crashes? Automatically launches a replacement
- Traffic spike? Automatically adds more planes
- Maintenance? Rolls out new planes one at a time, no downtime

---

## Summary

**Kubernetes** = Container orchestration platform that auto-scales, self-heals, and manages your app deployments.

**Key Benefits:**
- ✅ Auto-restart crashed containers
- ✅ Auto-scale based on load
- ✅ Zero-downtime deployments
- ✅ Load balancing built-in
- ✅ Self-healing (moves Pods if server dies)
- ✅ Declarative (you say "I want 3 replicas," K8s makes it happen)

**In Your Design:**
- 6 agent Deployments with multiple replicas
- Auto-scaling for Cause_Classifier (LLM agent)
- StatefulSets for PostgreSQL and Kafka
- Services for inter-agent communication
- ConfigMaps/Secrets for configuration
- Rolling updates for zero-downtime deployments

**One-liner for interview:**
> "I use Kubernetes to orchestrate the 6-agent system because it gives me auto-scaling, self-healing, and zero-downtime deployments. Without it, I'd be manually restarting crashed agents and managing load balancing—Kubernetes handles all that automatically."

You're ready! 🚀
