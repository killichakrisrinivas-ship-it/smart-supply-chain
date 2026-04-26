# Smart Supply Chain Optimizer

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Node.js Backend (port 3000)         │
│  Express API  │  MongoDB  │  Gemini AI           │
│  Validation   │  Shipment │  Risk Assessment      │
│  HTML UI      │  Disruption│                     │
└───────────────┬─────────────────────────────────┘
                │  HTTP calls (REST bridge)
                │  GET /route?from=A&to=D
                │  POST /disruption
                │  GET /graph
                ▼
┌─────────────────────────────────────────────────┐
│           Java Routing Engine (port 8080)        │
│  LogisticsGraph  │  Dijkstra  │  RouteCache      │
│  RoutingHttpServer (REST bridge)                 │
│  DisruptionSimulator  │  BatchRouter             │
│  GeminiService (disruption prediction)           │
└─────────────────────────────────────────────────┘
                │
                ▼
         MongoDB (port 27017)
```

## How to Run

### 1. Start MongoDB
```bash
mongod
```

### 2. Start the Java Routing Engine
```bash
# From the java/ folder
javac logistics/*.java
java logistics.Main
```
This starts the REST bridge on **port 8080** and runs the demo.

### 3. Start the Node.js Backend
```bash
cd backend/
cp .env.example .env          # fill in GEMINI_API_KEY if you have one
npm install
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## What Was Fixed

### Fix 1 — Java ↔ Node.js Integration (critical)
**Before:** Two completely separate systems with no connection.  
**After:** `RoutingHttpServer.java` exposes a REST API on port 8080. The Node.js backend calls it via `algorithmUtils.js` for every route request. The Java Dijkstra engine now actually powers the Node.js responses.

### Fix 2 — Route Cache (fragile → version-aware)
**Before:** A single `boolean cacheValid` flag was cleared on every mutation. Under dynamic congestion/disruptions the hit rate was effectively zero.  
**After:** A `graphVersion` counter is bumped on every mutation. A cached route is valid only when its stored version matches the current version. Multiple routes computed at the same version are all reused correctly.

### Fix 3 — AI Integration (parser → value-add)
**Before:** AI was only used to parse text into route requests. The routing result itself was a hardcoded array.  
**After:** AI (`aiUtils.js`) asks Gemini to score risk and produce recommendations based on real disruption data. The route itself comes from the real Dijkstra engine. AI adds insight on top of the algorithm, not instead of it.

### Fix 4 — Disruptions actually affect routing
**Before:** Disruptions were saved in MongoDB but the routing engine never saw them.  
**After:** `disruptionService.js` calls `algorithmUtils.pushEdgeDisruption()` or `pushCongestion()` to update the live Java engine when a disruption is created. Route requests made after that automatically reroute.

### Fix 5 — Input validation enforced
**Before:** `validation.js` existed but was not applied to any routes. User input was rendered raw in HTML (XSS risk).  
**After:** `validateShipment` and `validateDisruption` middleware are applied on all relevant routes. All dynamic values are HTML-escaped with `esc()` before insertion in HTML responses.

### Fix 6 — Demo disruption endpoint
**After:** `POST /demo-disruption` lets a judge press a button to inject a disruption and immediately see rerouting — answering "show me the system respond to a disruption in real time."

---

## API Reference

### Node.js (port 3000)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/shipment | Create shipment |
| GET | /api/shipment/:id | Get shipment |
| GET | /api/route/:id | Get route (Java engine) |
| GET | /api/optimized-route/:id | Get optimized route (Java + AI) |
| POST | /api/disruption | Create disruption (updates Java engine) |
| GET | /api/graph | Live graph snapshot from Java engine |
| GET | /api/health | Health check |

### Java Bridge (port 8080)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Confirms engine is up |
| GET | /route?from=A&to=D | Dijkstra shortest path |
| GET | /graph | Full adjacency snapshot |
| POST | /disruption | Block/unblock an edge |
| POST | /disruption/congestion | Apply congestion to a node |
| POST | /reset | Clear all disruptions |

---

## Scaling Story 

Current: Single-JVM graph + Node.js API + MongoDB  
Next step:
- **Kafka** → stream real-time disruption events into the routing engine
- **Redis** → distributed route cache shared across multiple JVM instances
- **Graph service cluster** → horizontal scale the routing engine with consistent hashing per source node
- **WebSocket** → push reroute notifications to shipment dashboards in real time
