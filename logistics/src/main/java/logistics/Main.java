package logistics;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Demo runner — structured for hackathon presentation.
 *
 * FIX (review): The Java engine and Node.js backend were completely
 * disconnected — "two systems that do not talk to each other."
 *
 * This version starts RoutingHttpServer on port 8080 BEFORE running the
 * demo, so the Node.js backend can call the real routing engine the moment
 * the JVM is up. If the server fails to bind (port in use) the demo still
 * runs in standalone mode.
 *
 * Flow:
 * Step 0 Start REST bridge (port 8080) — Node.js connects here
 * Step 1 Build and print the graph
 * Step 2 Normal routing tests
 * Step 3 AI: weather report -> congestion adjustment -> reroute
 * Step 4 AI: natural language input -> delivery requests -> routing
 * Step 5 AI: incident report -> edge blocked -> reroute
 * Step 6 Tick-based simulation
 */
public class Main {

    public static void main(String[] args) {

        // ── STEP 0: Start REST bridge ─────────────────────────────────────────
        // Build the graph first so it's ready before the server opens
        LogisticsGraph graph = buildNetwork();

        separator("STEP 0: Starting REST Bridge (Node.js integration)");

        String portEnv = System.getenv("PORT");
        int port = (portEnv != null && !portEnv.isEmpty()) ? Integer.parseInt(portEnv) : 8080;
        RoutingHttpServer bridge = new RoutingHttpServer(graph, port);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("  [BRIDGE] Shutting down REST bridge...");
            bridge.stop();
        }));

        try {
            bridge.start();
            System.out.println("  Node.js: await fetch('http://localhost:8080/route?from=A&to=D')");
        } catch (Exception e) {
            System.out.println("  [BRIDGE] Could not start REST bridge: " + e.getMessage());
            System.out.println("  [BRIDGE] Running in standalone demo mode.");
        }

        // ── STEP 1: Print graph ───────────────────────────────────────────────
        separator("STEP 1: Logistics Network");
        graph.printGraph();

        // ── STEP 2: Core routing tests ────────────────────────────────────────
        separator("STEP 2: Core Routing Tests");
        runRoutingTests(graph);

        // ── Steps 3-5 require Gemini ──────────────────────────────────────────
        GeminiService ai;
        try {
            ai = new GeminiService();
        } catch (IllegalStateException e) {
            System.out.println("\n" + e.getMessage());
            System.out.println("\n[DEMO] Set GEMINI_API_KEY to see AI features.");
            System.out.println("\n=== DEMO COMPLETE (routing + bridge active) ===");
            // Bridge stays alive even without Gemini so Node.js can still use routing
            keepAlive();
            return;
        }

        // ── STEP 3: AI disruption prediction ─────────────────────────────────
        separator("STEP 3: AI Disruption Prediction");
        demoDisruptionPrediction(graph, ai);

        // ── STEP 4: AI natural language delivery requests ─────────────────────
        separator("STEP 4: AI Natural Language Delivery Requests");
        demoNaturalLanguageRequests(graph, ai);

        // ── STEP 5: AI incident report -> edge block -> reroute ───────────────
        separator("STEP 5: AI Incident Report -> Auto Edge Block");
        demoIncidentEdgeBlock(graph, ai);

        // ── STEP 6: Tick-based simulation ─────────────────────────────────────
        separator("STEP 6: Tick-Based Disruption Simulation");
        demoTickSimulation(graph);

        System.out.println("\n=== DEMO COMPLETE — Bridge still running on :8080 ===");
        keepAlive();
    }

    // ── Keep the JVM alive so Node.js can keep calling the bridge ────────────

    private static void keepAlive() {
        System.out.println("  Press Ctrl+C to stop.");
        try {
            Thread.currentThread().join();
        } catch (InterruptedException ignored) {
        }
    }

    // =========================================================================
    // STEP 3 — AI reads weather report, engine adjusts congestion
    // =========================================================================

    private static void demoDisruptionPrediction(LogisticsGraph graph, GeminiService ai) {

        String report = "Heavy rainfall expected near City C tomorrow";
        System.out.println("  Input report : \"" + report + "\"");

        GeminiService.DisruptionPrediction prediction = ai.predictDisruption(report, graph.getNodeNames());

        System.out.println("\n  " + prediction);

        if (!prediction.affectedNode.equals("UNKNOWN")) {
            applyAiCongestionToNode(graph, prediction.affectedNode, prediction.congestionFactor);
        } else {
            System.out.println("  [ENGINE] Affected node unknown — no graph changes made.");
        }

        System.out.println("\n  Graph after AI congestion adjustment:");
        graph.printGraph();

        System.out.println("  Route A -> D under predicted congestion:");
        RouteResult result = graph.findShortestPath("A", "D");
        System.out.println("  " + result);
        System.out.println(result.toJson());

        graph.resetDisruptions();
    }

    private static void applyAiCongestionToNode(LogisticsGraph graph,
            String node, double factor) {
        List<Edge> edges = graph.getAdjacencyList().get(node);
        if (edges == null) {
            System.out.printf("  [WARNING] Node %s not found — no congestion applied%n", node);
            return;
        }
        for (Edge e : edges)
            e.setCongestionFactor(factor);
        System.out.printf("  [ENGINE] Congestion x%.1f applied to all edges leaving node %s%n",
                factor, node);
    }

    // =========================================================================
    // STEP 4 — AI parses natural language, engine routes
    // =========================================================================

    private static void demoNaturalLanguageRequests(LogisticsGraph graph, GeminiService ai) {

        String[] userInputs = {
                "Deliver medical supplies from Warehouse A to City D urgently",
                "Send a regular shipment from Distribution Center B to City E",
                "Emergency cargo needed at City D, starting from City C immediately"
        };

        List<DeliveryRequest> requests = new ArrayList<>();
        for (int i = 0; i < userInputs.length; i++) {
            String id = String.format("AI-%03d", i + 1);
            requests.add(ai.parseDeliveryRequest(userInputs[i], id, graph.getNodeNames()));
        }

        requests.sort(Comparator.comparingInt(DeliveryRequest::getPriority));

        System.out.println("\n  Routing all AI-parsed deliveries in priority order:");
        for (DeliveryRequest req : requests) {
            RouteResult result = graph.findShortestPath(req.getSource(), req.getDestination());
            System.out.printf("  %s | %s%n", req, result);
            System.out.println(result.toJson());
        }
    }

    // =========================================================================
    // STEP 5 — AI reads incident, engine blocks edge, reroutes
    // =========================================================================

    private static void demoIncidentEdgeBlock(LogisticsGraph graph, GeminiService ai) {

        String[] incidents = {
                "Bridge between B and D has collapsed due to flooding",
                "Major landslide has blocked the road from City C to City D"
        };

        for (String incident : incidents) {
            System.out.println("\n  Incident: \"" + incident + "\"");

            GeminiService.EdgeBlock block = ai.parseEdgeBlock(incident, graph.getNodeNames());
            System.out.println("  " + block);

            if (block.valid) {
                graph.blockBiEdge(block.from, block.to);
                System.out.println("  Recalculating best route A -> D...");
                RouteResult result = graph.findShortestPath("A", "D");
                System.out.println("  " + result);
                System.out.println(result.toJson());
            } else {
                System.out.println("  [ENGINE] Edge could not be identified. No changes made.");
            }
        }

        graph.resetDisruptions();
    }

    // =========================================================================
    // STEP 6 — Tick simulation
    // =========================================================================

    private static void demoTickSimulation(LogisticsGraph graph) {
        List<DeliveryRequest> deliveries = new ArrayList<>();
        deliveries.add(new DeliveryRequest("DEL-001", "A", "D", 1));
        deliveries.add(new DeliveryRequest("DEL-002", "A", "E", 2));
        deliveries.add(new DeliveryRequest("DEL-003", "B", "E", 3));

        DisruptionSimulator tickSim = new DisruptionSimulator(99L);
        tickSim.runSimulation(graph, deliveries, 3, 0.3);
    }

    // =========================================================================
    // Core routing tests
    // =========================================================================

    private static void runRoutingTests(LogisticsGraph graph) {

        System.out.println("--- TEST 1: Normal Route A -> D ---");
        RouteResult r1 = graph.findShortestPath("A", "D");
        System.out.println(r1);
        System.out.println(r1.toJson());

        System.out.println("\n--- TEST 2: Same route again (should be CACHE HIT) ---");
        RouteResult r1b = graph.findShortestPath("A", "D");
        System.out.println(r1b);

        System.out.println("\n--- TEST 3: Block B->D ---");
        graph.blockBiEdge("B", "D");
        RouteResult r2 = graph.findShortestPath("A", "D");
        System.out.println(r2);
        System.out.println(r2.toJson());
        graph.resetDisruptions();

        System.out.println("\n--- TEST 4: Block B->D AND C->D ---");
        graph.blockBiEdge("B", "D");
        graph.blockBiEdge("C", "D");
        RouteResult r3 = graph.findShortestPath("A", "D");
        System.out.println(r3);
        System.out.println(r3.toJson());
        graph.resetDisruptions();

        DisruptionSimulator sim = new DisruptionSimulator(42L);

        System.out.println("\n--- Morning Rush ---");
        sim.applyCongestion(graph, DisruptionSimulator.TimeOfDay.MORNING);
        System.out.println(graph.findShortestPath("A", "D"));
        graph.resetDisruptions();

        System.out.println("\n--- Night (fast) ---");
        sim.applyCongestion(graph, DisruptionSimulator.TimeOfDay.NIGHT);
        System.out.println(graph.findShortestPath("A", "D"));
        graph.resetDisruptions();

        System.out.println("\n--- Storm (variable congestion) ---");
        sim.applyVariableCongestion(graph, DisruptionSimulator.TimeOfDay.STORM);
        System.out.println(graph.findShortestPath("A", "D"));
        graph.resetDisruptions();
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private static void separator(String title) {
        System.out.println("\n============================================");
        System.out.println("  " + title);
        System.out.println("============================================");
    }

    private static LogisticsGraph buildNetwork() {
        LogisticsGraph graph = new LogisticsGraph();
        graph.addNode("A");
        graph.addNode("B");
        graph.addNode("C");
        graph.addNode("D");
        graph.addNode("E");
        graph.addBiEdge("A", "B", 5);
        graph.addBiEdge("A", "C", 6);
        graph.addBiEdge("B", "D", 3);
        graph.addBiEdge("C", "D", 2);
        graph.addBiEdge("C", "E", 4);
        return graph;
    }
}
