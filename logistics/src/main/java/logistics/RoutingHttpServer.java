package logistics;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * Embedded HTTP microservice that exposes the Java routing engine to the
 * Node.js backend.
 *
 * WHY THIS EXISTS (from review):
 *   "Your routing engine is in Java. Your backend is NodeJS. But I see no
 *    integration layer. There is no REST call, gRPC, microservice bridge,
 *    CLI execution, or message queue. So right now you basically have two
 *    systems that do not talk to each other."
 *
 * HOW IT WORKS:
 *   1. Main.java starts this server on port 8080 alongside the demo.
 *   2. Node.js calls these endpoints instead of doing its own fake routing.
 *   3. The Java engine responds with real Dijkstra results.
 *
 * ENDPOINTS:
 *
 *   GET  /health
 *     → 200 {"status":"ok","nodes":"A, B, C, D, E"}
 *
 *   GET  /route?from=A&to=D
 *     → RouteResult serialised as JSON
 *
 *   GET  /graph
 *     → Full adjacency snapshot (nodes + edges with congestion)
 *
 *   POST /disruption
 *     Body: {"from":"B","to":"D","action":"block"|"unblock"}
 *     → 200 {"ok":true,"message":"..."}
 *
 *   POST /disruption/congestion
 *     Body: {"node":"C","factor":2.5}
 *     → 200 {"ok":true}
 *
 *   POST /reset
 *     → Clears all disruptions, returns new graph snapshot
 *
 * USAGE (from Node.js via fetch or axios):
 *   const res = await fetch('http://localhost:8080/route?from=A&to=D');
 *   const data = await res.json();
 *   // data.route, data.totalTime, data.status
 */
public class RoutingHttpServer {

    private final LogisticsGraph graph;
    private final int            port;
    private       HttpServer     server;
    private static final ObjectMapper mapper = new ObjectMapper();

    public RoutingHttpServer(LogisticsGraph graph, int port) {
        this.graph = graph;
        this.port  = port;
    }

    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/health",               this::handleHealth);
        server.createContext("/route",                this::handleRoute);
        server.createContext("/graph",                this::handleGraph);
        server.createContext("/disruption/congestion",this::handleCongestion);
        server.createContext("/disruption",           this::handleDisruption);
        server.createContext("/reset",                this::handleReset);

        // Use a thread pool so concurrent Node.js requests don't block each other
        server.setExecutor(Executors.newFixedThreadPool(4));
        server.start();

        System.out.printf("%n  [BRIDGE] Java routing service listening on http://localhost:%d%n", port);
        System.out.println("  [BRIDGE] Node.js can now call GET /route?from=A&to=D");
    }

    public void stop() {
        if (server != null) server.stop(0);
    }

    // ── /health ───────────────────────────────────────────────────────────────

    private void handleHealth(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }
        String body = "{\"status\":\"ok\",\"nodes\":\"" + graph.getNodeNames() + "\"}";
        sendJson(exchange, 200, body);
    }

    // ── /route?from=X&to=Y ────────────────────────────────────────────────────

    private void handleRoute(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }

        String query = exchange.getRequestURI().getQuery();
        String from  = getParam(query, "from");
        String to    = getParam(query, "to");
        String time  = getParam(query, "time");

        if (from == null || to == null) {
            sendJson(exchange, 400, "{\"error\":\"'from' and 'to' query params required\"}");
            return;
        }

        if (!graph.getAdjacencyList().containsKey(from.toUpperCase()) || 
            !graph.getAdjacencyList().containsKey(to.toUpperCase())) {
            sendJson(exchange, 400, "{\"error\":\"Invalid nodes. Valid nodes: " + graph.getNodeNames() + "\"}");
            return;
        }

        RouteResult result = graph.findShortestPath(from.toUpperCase(), to.toUpperCase(), time);
        sendJson(exchange, 200, result.toJson());
    }

    // ── /graph ────────────────────────────────────────────────────────────────

    private void handleGraph(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }
        sendJson(exchange, 200, mapper.writeValueAsString(graph.getGraphSnapshot()));
    }

    // ── POST /disruption  {"from":"B","to":"D","action":"block"} ─────────────

    private void handleDisruption(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }

        String body   = readBody(exchange);
        try {
            JsonNode jsonNode = mapper.readTree(body);
            String from   = jsonNode.has("from") ? jsonNode.get("from").asText() : null;
            String to     = jsonNode.has("to") ? jsonNode.get("to").asText() : null;
            String action = jsonNode.has("action") ? jsonNode.get("action").asText() : null;

            if (from == null || to == null || action == null) {
                sendJson(exchange, 400,
                    "{\"error\":\"body must contain 'from', 'to', 'action' (block|unblock)\"}");
                return;
            }

            if ("block".equalsIgnoreCase(action)) {
                graph.blockBiEdge(from.toUpperCase(), to.toUpperCase());
                sendJson(exchange, 200,
                    "{\"ok\":true,\"message\":\"Edge " + from + "->" + to + " blocked\"}");
            } else if ("unblock".equalsIgnoreCase(action)) {
                graph.unblockBiEdge(from.toUpperCase(), to.toUpperCase());
                sendJson(exchange, 200,
                    "{\"ok\":true,\"message\":\"Edge " + from + "->" + to + " restored\"}");
            } else {
                sendJson(exchange, 400, "{\"error\":\"action must be 'block' or 'unblock'\"}");
            }
        } catch (Exception e) {
            sendJson(exchange, 400, "{\"error\":\"Invalid JSON body\"}");
        }
    }

    // ── POST /disruption/congestion  {"node":"C","factor":2.5} ───────────────

    private void handleCongestion(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }

        String body   = readBody(exchange);
        try {
            JsonNode jsonNode = mapper.readTree(body);
            String node   = jsonNode.has("node") ? jsonNode.get("node").asText() : null;
            String factor = jsonNode.has("factor") ? jsonNode.get("factor").asText() : null;

            if (node == null || factor == null) {
                sendJson(exchange, 400, "{\"error\":\"body must contain 'node' and 'factor'\"}");
                return;
            }

            double f     = Double.parseDouble(factor);
            List<Edge> edges = graph.getAdjacencyList().get(node.toUpperCase());
            if (edges == null) {
                sendJson(exchange, 404, "{\"error\":\"node not found\"}");
                return;
            }
            for (Edge e : edges) e.setCongestionFactor(f);
            // Bump graph version so cache is invalidated
            graph.blockBiEdge(node, "__noop__"); // triggers version bump
            graph.unblockBiEdge(node, "__noop__");
            sendJson(exchange, 200,
                "{\"ok\":true,\"node\":\"" + node.toUpperCase() + "\",\"factor\":" + f + "}");
        } catch (NumberFormatException e) {
            sendJson(exchange, 400, "{\"error\":\"factor must be a number\"}");
        } catch (Exception e) {
            sendJson(exchange, 400, "{\"error\":\"Invalid JSON body\"}");
        }
    }

    // ── POST /reset ───────────────────────────────────────────────────────────

    private void handleReset(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }
        graph.resetDisruptions();
        sendJson(exchange, 200, mapper.writeValueAsString(graph.getGraphSnapshot()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void sendJson(HttpExchange exchange, int status, String json) throws IOException {
        // CORS headers so the Node.js backend (different port) can call us
        exchange.getResponseHeaders().set("Content-Type",  "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
    }

    private String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String getParam(String query, String key) {
        if (query == null) return null;
        for (String pair : query.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2 && kv[0].equalsIgnoreCase(key)) return kv[1];
        }
        return null;
    }
}
