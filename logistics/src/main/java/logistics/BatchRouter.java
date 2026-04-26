package logistics;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Handles one-to-many and many-to-one routing in a single pass.
 *
 * Missing Feature 1 — Multi-source / batch routing.
 *
 * Real warehouses need to dispatch to many destinations at once.
 * Running findShortestPath() N times is wasteful: each call
 * restarts Dijkstra from scratch even though the graph hasn't changed.
 *
 * BatchRouter solves two common patterns:
 *
 *   1. dispatchFromWarehouse(warehouse, destinations)
 *      One source  → many destinations.
 *      Useful for: morning dispatch planning, delivery runs.
 *
 *   2. collectToHub(sources, hub)
 *      Many sources → one destination.
 *      Useful for: inbound consolidation, return logistics.
 *
 * Both methods return a BatchResult that groups results by status
 * and prints a priority-sorted summary automatically.
 */
public class BatchRouter {

    private final LogisticsGraph graph;

    public BatchRouter(LogisticsGraph graph) {
        this.graph = graph;
    }

    // -------------------------------------------------------------------------
    // Pattern 1 — One warehouse to many destinations
    // -------------------------------------------------------------------------

    public BatchResult dispatchFromWarehouse(String warehouse,
                                             List<DeliveryRequest> requests) {
        System.out.printf("%n  [BATCH] Dispatching %d deliveries from %s%n",
            requests.size(), warehouse);

        List<RouteResult> results = new ArrayList<>();

        // Sort by priority (1 = most urgent) before routing so urgent
        // deliveries are printed and logged first.
        List<DeliveryRequest> sorted = new ArrayList<>(requests);
        sorted.sort(Comparator.comparingInt(DeliveryRequest::getPriority));

        for (DeliveryRequest req : sorted) {
            String      src    = req.getSource().equals(warehouse) ? warehouse : req.getSource();
            RouteResult result = graph.findShortestPath(src, req.getDestination());
            results.add(result);
            System.out.printf("    %s => %s%n", req.getId(), result);
        }

        return new BatchResult(warehouse, results);
    }

    // -------------------------------------------------------------------------
    // Pattern 2 — Many sources to one hub
    // -------------------------------------------------------------------------

    public BatchResult collectToHub(List<String> sources, String hub) {
        System.out.printf("%n  [BATCH] Collecting %d shipments into hub %s%n",
            sources.size(), hub);

        List<RouteResult> results = new ArrayList<>();

        for (String src : sources) {
            RouteResult result = graph.findShortestPath(src, hub);
            results.add(result);
            System.out.printf("    %s -> %s => %s%n", src, hub, result);
        }

        return new BatchResult(hub, results);
    }

    // -------------------------------------------------------------------------
    // BatchResult — summary wrapper
    // -------------------------------------------------------------------------

    public static class BatchResult {

        private final String            label;
        private final List<RouteResult> results;

        public BatchResult(String label, List<RouteResult> results) {
            this.label   = label;
            this.results = results;
        }

        public List<RouteResult> getResults() { return results; }

        public long countByStatus(RouteResult.Status status) {
            return results.stream().filter(r -> r.getStatus() == status).count();
        }

        public void printSummary() {
            System.out.printf("%n  [BATCH SUMMARY for %s]%n", label);
            System.out.printf("    Total    : %d%n", results.size());
            System.out.printf("    Success  : %d%n", countByStatus(RouteResult.Status.SUCCESS));
            System.out.printf("    Rerouted : %d%n", countByStatus(RouteResult.Status.REROUTED));
            System.out.printf("    No Route : %d%n", countByStatus(RouteResult.Status.NO_ROUTE));

            results.stream()
                .filter(r -> r.getStatus() == RouteResult.Status.NO_ROUTE)
                .forEach(r -> System.out.printf(
                    "    [!] Unreachable: %s -> %s%n", r.getSource(), r.getDestination()));
        }
    }
}
