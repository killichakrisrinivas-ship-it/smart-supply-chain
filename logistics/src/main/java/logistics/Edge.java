package logistics;

public class Edge {

    private final String destination;
    private final int    baseWeight;
    private double       congestionFactor;
    private boolean      blocked;
    private int          fuelCost;
    private int          disruptionRisk;

    public Edge(String destination, int baseWeight) {
        this.destination      = destination;
        this.baseWeight       = baseWeight;
        this.congestionFactor = 1.0;
        this.blocked          = false;
        this.fuelCost         = 2; // Default baseline fuel
        this.disruptionRisk   = 0; // Default baseline risk
    }

    public String  getDestination()                   { return destination; }
    public int     getBaseWeight()                    { return baseWeight; }
    public boolean isBlocked()                        { return blocked; }
    public void    setBlocked(boolean blocked)        { this.blocked = blocked; }
    public double  getCongestionFactor()              { return congestionFactor; }
    public void    setCongestionFactor(double factor) { this.congestionFactor = factor; }
    public int     getFuelCost()                      { return fuelCost; }
    public void    setFuelCost(int cost)              { this.fuelCost = cost; }
    public int     getDisruptionRisk()                { return disruptionRisk; }
    public void    setDisruptionRisk(int risk)        { this.disruptionRisk = risk; }

    public int getEffectiveWeight() {
        return (int) Math.ceil(baseWeight * congestionFactor) + fuelCost + disruptionRisk;
    }

    @Override
    public String toString() {
        String tag = blocked
            ? " [BLOCKED]"
            : (congestionFactor != 1.0 ? String.format(" [x%.1f]", congestionFactor) : "");
        return String.format("-> %s (time:%dh fuel:%d risk:%d | effective:%dh%s)",
            destination, baseWeight, fuelCost, disruptionRisk, getEffectiveWeight(), tag);
    }
}