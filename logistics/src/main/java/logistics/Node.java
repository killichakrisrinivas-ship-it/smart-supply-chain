package logistics;

/**
 * Represents a physical location in the logistics network.
 *
 * FIX 4 — Nodes are no longer bare Strings.
 *
 * Using plain String IDs works fine for a demo but is a dead-end design:
 * you can't attach metadata (coordinates, city name, type) to a String.
 * This class keeps the String id as the primary key so all existing code
 * that uses "A", "B", "C" still compiles unchanged, but now you can
 * enrich nodes with real-world attributes when needed.
 *
 * The LogisticsGraph still uses String keys in its adjacency map for
 * simplicity.  Node objects are stored in a separate nodeRegistry so
 * callers can look up metadata without changing the routing engine.
 */
public class Node {

    public enum NodeType {
        WAREHOUSE,
        DISTRIBUTION_CENTER,
        CITY,
        PORT,
        UNKNOWN
    }

    private final String   id;          // single letter used as map key: "A", "B" …
    private final String   displayName; // human-readable: "Warehouse Alpha"
    private final double   latitude;
    private final double   longitude;
    private final NodeType type;

    /** Minimal constructor — just an id, no geo data yet. */
    public Node(String id) {
        this(id, id, 0.0, 0.0, NodeType.UNKNOWN);
    }

    /** Full constructor for nodes with real-world metadata. */
    public Node(String id, String displayName, double latitude,
                double longitude, NodeType type) {
        this.id          = id;
        this.displayName = displayName;
        this.latitude    = latitude;
        this.longitude   = longitude;
        this.type        = type;
    }

    public String   getId()          { return id; }
    public String   getDisplayName() { return displayName; }
    public double   getLatitude()    { return latitude; }
    public double   getLongitude()   { return longitude; }
    public NodeType getType()        { return type; }

    /**
     * Haversine straight-line distance to another node (kilometres).
     * Used as the admissible heuristic in A* search.
     */
    public double haversineDistanceTo(Node other) {
        final double R   = 6371.0; // Earth radius km
        double dLat = Math.toRadians(other.latitude  - this.latitude);
        double dLon = Math.toRadians(other.longitude - this.longitude);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(this.latitude))
                    * Math.cos(Math.toRadians(other.latitude))
                    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    @Override
    public String toString() {
        return String.format("Node{%s / %s [%.4f, %.4f] %s}",
            id, displayName, latitude, longitude, type);
    }
}
