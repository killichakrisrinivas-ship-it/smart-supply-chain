package logistics;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * Core routing graph with Dijkstra-based shortest path.
 *
 * Fix summary (from review):
 *   FIX-CACHE  Cache key is now version-aware.  Old design used a single
 *              boolean cacheValid that was cleared on every mutation, making
 *              cache hit rate ≈ 0 under dynamic congestion/disruptions.
 *              New design uses a graphVersion counter: a cached entry is valid
 *              only when its recorded version matches the current version.
 *              Multiple routes computed at the same version are all reused.
 *   FIX-SNAP   getGraphSnapshot() lets the embedded REST server expose the
 *              live graph state to the Node.js backend (integration bridge).
 */
public class LogisticsGraph {

    // ── Priority-queue entry (String, not int[]) ─────────────────────────────
    private static final class NodeEntry implements Comparable<NodeEntry> {
        final String node;
        final int    dist;

        NodeEntry(String node, int dist) { this.node = node; this.dist = dist; }

        @Override public int compareTo(NodeEntry o) { return Integer.compare(dist, o.dist); }
    }

    // ── Version-aware route cache ─────────────────────────────────────────────
    private static final class CachedRoute {
        final RouteResult result;
        final long        version;
        CachedRoute(RouteResult r, long v) { result = r; version = v; }
    }

    private final Map<String, CachedRoute> routeCache   = new HashMap<>();
    private       long                     graphVersion  = 0;

    private final Map<String, List<Edge>> adjacencyList;

    public LogisticsGraph() { this.adjacencyList = new LinkedHashMap<>(); }

    public Map<String, List<Edge>> getAdjacencyList() { return adjacencyList; }

    public String getNodeNames() { return String.join(", ", adjacencyList.keySet()); }

    // ── Mutation helpers — each bumps graphVersion ────────────────────────────

    public void addNode(String node) {
        adjacencyList.putIfAbsent(node, new ArrayList<>());
        graphVersion++;
    }

    public void addEdge(String source, String destination, int weight) {
        addNode(source);
        addNode(destination);
        adjacencyList.get(source).add(new Edge(destination, weight));
        graphVersion++;
    }

    public void addBiEdge(String source, String destination, int weight) {
        addEdge(source, destination, weight);
        addEdge(destination, source, weight);
    }

    public void blockEdge(String source, String destination) {
        List<Edge> edges = adjacencyList.get(source);
        if (edges == null) return;
        for (Edge e : edges) {
            if (e.getDestination().equals(destination)) {
                e.setBlocked(true);
                graphVersion++;
                System.out.printf("  [BLOCKED]  %s -> %s%n", source, destination);
                return;
            }
        }
        System.out.printf("  [WARNING]  Edge %s -> %s not found%n", source, destination);
    }

    public void unblockEdge(String source, String destination) {
        List<Edge> edges = adjacencyList.get(source);
        if (edges == null) return;
        for (Edge e : edges) {
            if (e.getDestination().equals(destination)) {
                e.setBlocked(false);
                graphVersion++;
                System.out.printf("  [RESTORED] %s -> %s%n", source, destination);
                return;
            }
        }
    }

    public void blockBiEdge(String a, String b) {
        blockEdge(a, b);
        blockEdge(b, a);
    }

    public void unblockBiEdge(String a, String b) {
        unblockEdge(a, b);
        unblockEdge(b, a);
    }

    public void resetDisruptions() {
        for (List<Edge> edges : adjacencyList.values())
            for (Edge e : edges) { e.setBlocked(false); e.setCongestionFactor(1.0); }
        graphVersion++;
        System.out.println("  [RESET] All disruptions and congestion cleared.");
    }

    // ── Dijkstra with version-aware cache ─────────────────────────────────────

    public RouteResult findShortestPath(String source, String destination) {
        return findShortestPath(source, destination, null);
    }

    public RouteResult findShortestPath(String source, String destination, String time) {

        if (!adjacencyList.containsKey(source) || !adjacencyList.containsKey(destination)) {
            return new RouteResult(source, destination,
                Collections.emptyList(), -1, RouteResult.Status.NO_ROUTE);
        }

        // Cache hit: valid only when stored graphVersion matches current one.
        // This means: congestion change → graphVersion bumps → cache misses
        // automatically, but all other pairs cached at the same version are still hit.
        String     cacheKey = source + "->" + destination + (time != null ? "->" + time : "");
        CachedRoute cached  = routeCache.get(cacheKey);
        if (cached != null && cached.version == graphVersion) {
            System.out.printf("  [CACHE HIT v%d] %s%n", graphVersion, cacheKey);
            return cached.result;
        }

        if (time != null) {
            applyTimeBasedDisruptions(time);
        }

        List<String> baselinePath = dijkstra(source, destination, true);
        List<String> currentPath  = dijkstra(source, destination, false);

        if (currentPath.isEmpty()) {
            RouteResult r = new RouteResult(source, destination,
                Collections.emptyList(), -1, RouteResult.Status.NO_ROUTE);
            routeCache.put(cacheKey, new CachedRoute(r, graphVersion));
            return r;
        }

        int totalTime = pathCost(currentPath, false);

        RouteResult.Status status = currentPath.equals(baselinePath)
            ? RouteResult.Status.SUCCESS
            : RouteResult.Status.REROUTED;

        RouteResult result = new RouteResult(source, destination, currentPath, totalTime, status);
        routeCache.put(cacheKey, new CachedRoute(result, graphVersion));
        return result;
    }

    private void applyTimeBasedDisruptions(String time) {
        // Very basic time string parsing (HH:MM or HH)
        int hour = 0;
        try {
            hour = Integer.parseInt(time.split(":")[0]);
        } catch (Exception e) {}

        if (hour >= 8 && hour <= 10) {
            System.out.println("  [TIME EFFECT] 08:00-10:00 Morning Congestion applied (1.8x)");
            for (List<Edge> edges : adjacencyList.values()) {
                for (Edge e : edges) { e.setCongestionFactor(1.8); }
            }
            graphVersion++;
        } else if (hour >= 12 && hour <= 14) {
            System.out.println("  [TIME EFFECT] 12:00-14:00 Midday Construction - Risk increased");
            for (List<Edge> edges : adjacencyList.values()) {
                for (Edge e : edges) { e.setDisruptionRisk(e.getDisruptionRisk() + 5); }
            }
            graphVersion++;
        } else if (hour >= 18 && hour <= 21) {
            System.out.println("  [TIME EFFECT] 18:00-21:00 Evening Traffic applied (1.5x)");
            for (List<Edge> edges : adjacencyList.values()) {
                for (Edge e : edges) { e.setCongestionFactor(1.5); }
            }
            graphVersion++;
        }
    }

    // ── Core Dijkstra ─────────────────────────────────────────────────────────

    private List<String> dijkstra(String source, String destination, boolean ignoreBlocks) {
        Map<String, Integer> dist   = new HashMap<>();
        Map<String, String>  parent = new HashMap<>();

        for (String node : adjacencyList.keySet()) dist.put(node, Integer.MAX_VALUE);
        dist.put(source, 0);

        PriorityQueue<NodeEntry> pq = new PriorityQueue<>();
        pq.offer(new NodeEntry(source, 0));
        Set<String> visited = new HashSet<>();

        while (!pq.isEmpty()) {
            NodeEntry current = pq.poll();
            if (visited.contains(current.node)) continue;
            visited.add(current.node);
            if (current.node.equals(destination)) break;

            for (Edge edge : adjacencyList.get(current.node)) {
                if (!ignoreBlocks && edge.isBlocked()) continue;
                String neighbor = edge.getDestination();
                int    weight   = ignoreBlocks ? edge.getBaseWeight() : edge.getEffectiveWeight();
                int    newDist  = current.dist + weight;
                if (newDist < dist.getOrDefault(neighbor, Integer.MAX_VALUE)) {
                    dist.put(neighbor, newDist);
                    parent.put(neighbor, current.node);
                    pq.offer(new NodeEntry(neighbor, newDist));
                }
            }
        }

        if (dist.getOrDefault(destination, Integer.MAX_VALUE) == Integer.MAX_VALUE)
            return Collections.emptyList();

        return reconstructPath(parent, source, destination);
    }

    private int pathCost(List<String> path, boolean ignoreBlocks) {
        int cost = 0;
        for (int i = 0; i < path.size() - 1; i++) {
            List<Edge> edges = adjacencyList.get(path.get(i));
            if (edges == null) return Integer.MAX_VALUE;
            for (Edge e : edges) {
                if (e.getDestination().equals(path.get(i + 1))) {
                    cost += ignoreBlocks ? e.getBaseWeight() : e.getEffectiveWeight();
                    break;
                }
            }
        }
        return cost;
    }

    private List<String> reconstructPath(Map<String, String> parent,
                                          String source, String destination) {
        LinkedList<String> path    = new LinkedList<>();
        String             current = destination;
        while (current != null) { path.addFirst(current); current = parent.get(current); }
        if (path.isEmpty() || !path.getFirst().equals(source)) return Collections.emptyList();
        return path;
    }

    // ── Graph snapshot — used by RoutingHttpServer to expose state to Node.js ─

    /**
     * Returns a plain Map representation of the current graph state.
     * RoutingHttpServer serialises this to JSON and serves it on GET /graph.
     * The Node.js backend fetches it to display topology and congestion.
     */
    public Map<String, Object> getGraphSnapshot() {
        Map<String, Object>       snapshot = new LinkedHashMap<>();
        List<Map<String, Object>> edges    = new ArrayList<>();

        snapshot.put("version", graphVersion);
        snapshot.put("nodes",   new ArrayList<>(adjacencyList.keySet()));

        for (Map.Entry<String, List<Edge>> entry : adjacencyList.entrySet()) {
            String fromNode = entry.getKey();
            for (Edge e : entry.getValue()) {
                Map<String, Object> em = new LinkedHashMap<>();
                em.put("from",            fromNode);
                em.put("to",              e.getDestination());
                em.put("baseWeight",      e.getBaseWeight());
                em.put("effectiveWeight", e.getEffectiveWeight());
                em.put("congestion",      e.getCongestionFactor());
                em.put("blocked",         e.isBlocked());
                edges.add(em);
            }
        }
        snapshot.put("edges", edges);
        return snapshot;
    }

    public void printGraph() {
        System.out.println("\n--- LOGISTICS NETWORK GRAPH (v" + graphVersion + ") ---");
        for (Map.Entry<String, List<Edge>> entry : adjacencyList.entrySet()) {
            System.out.print("  " + entry.getKey() + " : ");
            if (entry.getValue().isEmpty()) System.out.print("(terminal)");
            else for (Edge e : entry.getValue()) System.out.print(e + "  ");
            System.out.println();
        }
        System.out.println("--------------------------------------------\n");
    }
}
