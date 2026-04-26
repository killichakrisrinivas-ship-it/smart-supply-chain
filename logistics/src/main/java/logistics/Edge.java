package logistics;

public class Edge {

    private final String destination;
    private final int    baseWeight;
    private double       congestionFactor;
    private boolean      blocked;

    public Edge(String destination, int baseWeight) {
        this.destination      = destination;
        this.baseWeight       = baseWeight;
        this.congestionFactor = 1.0;
        this.blocked          = false;
    }

    public String  getDestination()                   { return destination; }
    public int     getBaseWeight()                    { return baseWeight; }
    public boolean isBlocked()                        { return blocked; }
    public void    setBlocked(boolean blocked)        { this.blocked = blocked; }
    public double  getCongestionFactor()              { return congestionFactor; }
    public void    setCongestionFactor(double factor) { this.congestionFactor = factor; }

    public int getEffectiveWeight() {
        return (int) Math.ceil(baseWeight * congestionFactor);
    }

    @Override
    public String toString() {
        String tag = blocked
            ? " [BLOCKED]"
            : (congestionFactor != 1.0 ? String.format(" [x%.1f]", congestionFactor) : "");
        return String.format("-> %s (%dh base / %dh effective%s)",
            destination, baseWeight, getEffectiveWeight(), tag);
    }
}