package logistics;

public class DeliveryRequest {

    private final String id;
    private final String source;
    private final String destination;
    private final int    priority;

    public DeliveryRequest(String id, String source, String destination, int priority) {
        this.id          = id;
        this.source      = source;
        this.destination = destination;
        this.priority    = priority;
    }

    public String getId()          { return id; }
    public String getSource()      { return source; }
    public String getDestination() { return destination; }
    public int    getPriority()    { return priority; }

    @Override
    public String toString() {
        return String.format("%s (%s -> %s, priority %d)", id, source, destination, priority);
    }
}