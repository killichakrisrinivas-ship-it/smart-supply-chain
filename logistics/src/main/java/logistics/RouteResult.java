package logistics;

import java.util.List;

public class RouteResult {

    public enum Status {
        SUCCESS,   // fastest path found, no disruptions affected the route
        REROUTED,  // a disruption forced a longer/different path
        NO_ROUTE   // destination unreachable under current disruptions
    }

    private final String       source;
    private final String       destination;
    private final List<String> route;
    private final int          totalTime;
    private final Status       status;

    public RouteResult(String source, String destination,
                       List<String> route, int totalTime, Status status) {
        this.source      = source;
        this.destination = destination;
        this.route       = route;
        this.totalTime   = totalTime;
        this.status      = status;
    }

    public String       getSource()      { return source; }
    public String       getDestination() { return destination; }
    public List<String> getRoute()       { return route; }
    public int          getTotalTime()   { return totalTime; }
    public Status       getStatus()      { return status; }

    public String toJson() {
        if (status == Status.NO_ROUTE) {
            return String.format(
                "{\n  \"source\": \"%s\",\n  \"destination\": \"%s\","
                + "\n  \"route\": [],\n  \"time\": -1,\n  \"status\": \"no_route\"\n}",
                source, destination);
        }

        StringBuilder arr = new StringBuilder("[");
        for (int i = 0; i < route.size(); i++) {
            arr.append("\"").append(route.get(i)).append("\"");
            if (i < route.size() - 1) arr.append(", ");
        }
        arr.append("]");

        return String.format(
            "{\n  \"source\": \"%s\",\n  \"destination\": \"%s\","
            + "\n  \"route\": %s,\n  \"time\": %d,\n  \"status\": \"%s\"\n}",
            source, destination, arr, totalTime, status.name().toLowerCase());
    }

    @Override
    public String toString() {
        if (status == Status.NO_ROUTE) {
            return String.format("[NO_ROUTE] %s -> %s : no path available", source, destination);
        }
        return String.format("[%s] Route: %s  |  Total Time: %d hours",
            status, String.join(" -> ", route), totalTime);
    }
}
