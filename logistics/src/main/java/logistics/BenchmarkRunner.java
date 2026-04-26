package logistics;

import java.util.List;

public class BenchmarkRunner {

    public static void runBenchmarks() {
        System.out.println("\n============================================");
        System.out.println("  STEP 7: High-Scale Benchmark Scenarios");
        System.out.println("============================================");

        LogisticsGraph graph = buildBenchmarkNetwork();

        System.out.println("\n[SCENARIO 1] Normal Conditions (Departure: 11:00)");
        RouteResult r1 = graph.findShortestPath("WH_01", "CUST_09", "11:00");
        printBenchmarkResult(r1);

        System.out.println("\n[SCENARIO 2] Morning Rush Hour (Departure: 08:30)");
        // The graph automatically applies 1.8x congestion internally when time is between 08:00 and 10:00
        RouteResult r2 = graph.findShortestPath("WH_01", "CUST_09", "08:30");
        printBenchmarkResult(r2);

        System.out.println("\n[SCENARIO 3] Midday Construction Risk (Departure: 13:00)");
        // The graph automatically applies risk +5 to all edges
        RouteResult r3 = graph.findShortestPath("WH_01", "CUST_09", "13:00");
        printBenchmarkResult(r3);

        System.out.println("\n[SCENARIO 4] Dynamic Disruption (Major Incident on Highway_A)");
        // Reset time effects, manually block an edge to simulate a real-time incident
        graph.resetDisruptions();
        graph.blockBiEdge("WH_01", "HUB_04");
        RouteResult r4 = graph.findShortestPath("WH_01", "CUST_09", "11:00");
        printBenchmarkResult(r4);
        graph.resetDisruptions();
    }

    private static LogisticsGraph buildBenchmarkNetwork() {
        LogisticsGraph graph = new LogisticsGraph();
        
        // 10 nodes
        String[] nodes = {"WH_01", "WH_02", "HUB_03", "HUB_04", "HUB_05", "DIST_06", "DIST_07", "CUST_08", "CUST_09", "CUST_10"};
        for (String node : nodes) {
            graph.addNode(node);
        }

        // 25 edges (some with custom fuel/risk values)
        addBi(graph, "WH_01", "WH_02", 4, 1, 0);
        addBi(graph, "WH_01", "HUB_03", 10, 3, 2);
        addBi(graph, "WH_01", "HUB_04", 8, 2, 0); // Fast highway
        addBi(graph, "WH_02", "HUB_04", 12, 4, 1);
        addBi(graph, "WH_02", "HUB_05", 15, 5, 2);
        addBi(graph, "HUB_03", "HUB_04", 5, 2, 1);
        addBi(graph, "HUB_03", "DIST_06", 20, 6, 0);
        addBi(graph, "HUB_04", "DIST_06", 18, 5, 3);
        addBi(graph, "HUB_04", "DIST_07", 22, 7, 0);
        addBi(graph, "HUB_05", "DIST_07", 14, 4, 1);
        addBi(graph, "DIST_06", "DIST_07", 6, 2, 0);
        addBi(graph, "DIST_06", "CUST_08", 8, 2, 1);
        addBi(graph, "DIST_06", "CUST_09", 15, 4, 0);
        addBi(graph, "DIST_07", "CUST_09", 10, 3, 0);
        addBi(graph, "DIST_07", "CUST_10", 12, 3, 2);
        
        System.out.println("  [BENCHMARK] Initialized complex graph with 10 Nodes and 30 bidirectional Edges.");
        return graph;
    }

    private static void addBi(LogisticsGraph graph, String a, String b, int time, int fuel, int risk) {
        graph.addBiEdge(a, b, time);
        // We have to set fuel and risk manually since addBiEdge uses defaults
        setEdgeProps(graph, a, b, fuel, risk);
        setEdgeProps(graph, b, a, fuel, risk);
    }

    private static void setEdgeProps(LogisticsGraph graph, String source, String dest, int fuel, int risk) {
        List<Edge> edges = graph.getAdjacencyList().get(source);
        if (edges != null) {
            for (Edge e : edges) {
                if (e.getDestination().equals(dest)) {
                    e.setFuelCost(fuel);
                    e.setDisruptionRisk(risk);
                }
            }
        }
    }

    private static void printBenchmarkResult(RouteResult r) {
        if (r.getStatus() == RouteResult.Status.NO_ROUTE) {
            System.out.println("  [RESULT] NO PATH FOUND");
        } else {
            System.out.printf("  [RESULT] Path: %s%n", String.join(" -> ", r.getRoute()));
            System.out.printf("           Cost: %d (Multi-factor effective weight)%n", r.getTotalTime());
        }
    }
}
