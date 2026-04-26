package logistics;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;

public class DisruptionSimulator {

    public enum TimeOfDay {
        MORNING  ("Morning Rush", 1.8),
        AFTERNOON("Afternoon",    1.2),
        NIGHT    ("Night",        0.8),
        STORM    ("Storm",        2.5);

        private final String label;
        private final double congestionFactor;

        TimeOfDay(String label, double factor) {
            this.label            = label;
            this.congestionFactor = factor;
        }

        public double getCongestionFactor() { return congestionFactor; }
        public String getLabel()            { return label; }
    }

    private final Random rand;

    public DisruptionSimulator()          { this.rand = new Random(); }
    public DisruptionSimulator(long seed) { this.rand = new Random(seed); }

    public void randomBlock(LogisticsGraph graph, double probability) {
        int count = 0;
        Map<String, List<Edge>> adj = graph.getAdjacencyList();
        for (Map.Entry<String, List<Edge>> entry : adj.entrySet()) {
            String     fromNode = entry.getKey();
            List<Edge> edges    = entry.getValue();
            for (Edge e : edges) {
                if (rand.nextDouble() < probability) {
                    e.setBlocked(true);
                    System.out.printf("    [DISRUPTION] %s -> %s blocked%n",
                        fromNode, e.getDestination());
                    count++;
                }
            }
        }
        if (count == 0) System.out.println("    [DISRUPTION] No edges disrupted this tick.");
    }

    public void applyCongestion(LogisticsGraph graph, TimeOfDay timeOfDay) {
        for (List<Edge> edges : graph.getAdjacencyList().values()) {
            for (Edge e : edges) e.setCongestionFactor(timeOfDay.getCongestionFactor());
        }
        System.out.printf("    [CONGESTION] %s -- all edges x%.1f%n",
            timeOfDay.getLabel(), timeOfDay.getCongestionFactor());
    }

    public void applyVariableCongestion(LogisticsGraph graph, TimeOfDay timeOfDay) {
        double base = timeOfDay.getCongestionFactor();
        for (List<Edge> edges : graph.getAdjacencyList().values()) {
            for (Edge e : edges) {
                double variance = 0.8 + (rand.nextDouble() * 0.4);
                double factor   = Math.max(0.5, base * variance);
                e.setCongestionFactor(Math.round(factor * 10.0) / 10.0);
            }
        }
        System.out.printf("    [CONGESTION] %s -- variable congestion applied (base x%.1f)%n",
            timeOfDay.getLabel(), base);
    }

    public void runSimulation(LogisticsGraph graph, List<DeliveryRequest> requests,
                              int ticks, double disruptionProbability) {
        System.out.println("\n  ======= SIMULATION START =======");
        for (int tick = 1; tick <= ticks; tick++) {
            System.out.printf("%n  --- Tick %d ---%n", tick);
            System.out.println("  [Step 1] Applying random disruptions...");
            randomBlock(graph, disruptionProbability);
            System.out.println("  [Step 2] Computing routes by priority...");
            List<DeliveryRequest> sorted = new ArrayList<>(requests);
            sorted.sort(Comparator.comparingInt(DeliveryRequest::getPriority));
            for (DeliveryRequest req : sorted) {
                RouteResult result = graph.findShortestPath(req.getSource(), req.getDestination());
                System.out.printf("    %s => %s%n", req.getId(), result);
            }
            System.out.println("  [Step 3] Clearing disruptions for next tick...");
            graph.resetDisruptions();
        }
        System.out.println("\n  ======= SIMULATION END =========");
    }
}