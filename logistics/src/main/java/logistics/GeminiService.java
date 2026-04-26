package logistics;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AI gateway between plain-text real-world inputs and the logistics engine.
 *
 * Fixes applied from review:
 *   1. extractField() is now case-insensitive — handles "FROM:", "From:", "from:"
 *   2. cleanNodeValue() strips noise like "Node C", "City C", "C." -> "C"
 *   3. Node list is passed dynamically from LogisticsGraph.getNodeNames()
 *      so adding new nodes never breaks the prompts
 *   4. All three prompts now explicitly say "single uppercase letter only"
 *      to reduce AI formatting variance
 */
public class GeminiService {

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=";

    private final String     apiKey;
    private final HttpClient client;

    public GeminiService() {
        this.apiKey = System.getenv("GEMINI_API_KEY");
        this.client = HttpClient.newHttpClient();

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                "[GeminiService] GEMINI_API_KEY environment variable is not set.\n" +
                "  Windows  : set GEMINI_API_KEY=your_key_here\n" +
                "  Mac/Linux: export GEMINI_API_KEY=your_key_here"
            );
        }
    }

    // =========================================================================
    // FEATURE 1 — Weather / news report -> disruption prediction
    // =========================================================================

    public DisruptionPrediction predictDisruption(String report, String availableNodes) {
        System.out.println("\n  [AI] Analysing report: \"" + report + "\"");

        String prompt =
            "You are a logistics risk analyser. A user gives you a weather or news report.\n" +
            "Extract the risk to road or transport networks.\n\n" +
            "Available network nodes: " + availableNodes + "\n\n" +
            "Respond in EXACTLY this format. Each field on its own line. No extra text:\n" +
            "RISK_LEVEL: <LOW|MEDIUM|HIGH|CRITICAL>\n" +
            "CONGESTION_FACTOR: <decimal number between 1.0 and 4.0>\n" +
            "AFFECTED_NODE: <one single uppercase letter from the available nodes, or UNKNOWN>\n" +
            "REASON: <one short sentence>\n\n" +
            "Important: AFFECTED_NODE must be a single letter only. Not 'City C', not 'Node C'. Just 'C'.\n\n" +
            "Report: " + report;

        String raw = callGemini(prompt);
        System.out.println("  [AI RAW RESPONSE]\n" + raw);
        return parseDisruptionPrediction(raw);
    }

    public static class DisruptionPrediction {
        public final String riskLevel;
        public final double congestionFactor;
        public final String affectedNode;
        public final String reason;

        public DisruptionPrediction(String riskLevel, double congestionFactor,
                                    String affectedNode, String reason) {
            this.riskLevel        = riskLevel;
            this.congestionFactor = congestionFactor;
            this.affectedNode     = affectedNode;
            this.reason           = reason;
        }

        @Override
        public String toString() {
            return String.format(
                "[AI PREDICTION] Risk: %s | Congestion x%.1f | Node: %s | %s",
                riskLevel, congestionFactor, affectedNode, reason);
        }
    }

    private DisruptionPrediction parseDisruptionPrediction(String raw) {
        String riskLevel     = extractField(raw, "RISK_LEVEL",        "MEDIUM");
        String congestionStr = extractField(raw, "CONGESTION_FACTOR", "1.5");
        String affectedNode  = cleanNodeValue(extractField(raw, "AFFECTED_NODE", "UNKNOWN"));
        String reason        = extractField(raw, "REASON",            "Unknown cause");

        double congestionFactor = 1.5;
        try {
            congestionFactor = Double.parseDouble(congestionStr.trim());
        } catch (NumberFormatException ignored) {}

        return new DisruptionPrediction(riskLevel.trim(), congestionFactor, affectedNode, reason.trim());
    }

    // =========================================================================
    // FEATURE 2 — Natural language delivery request -> DeliveryRequest
    // =========================================================================

    public DeliveryRequest parseDeliveryRequest(String input, String requestId,
                                                 String availableNodes) {
        System.out.println("\n  [AI] Parsing delivery request: \"" + input + "\"");

        String prompt =
            "You are a logistics dispatcher. Extract delivery details from the user message.\n\n" +
            "Available network nodes: " + availableNodes + "\n" +
            "Each letter represents a location (e.g. A = Warehouse A, D = City D).\n\n" +
            "Respond in EXACTLY this format. Each field on its own line. No extra text:\n" +
            "SOURCE: <single uppercase letter from available nodes>\n" +
            "DESTINATION: <single uppercase letter from available nodes>\n" +
            "PRIORITY: <integer 1 to 4, where 1=urgent/emergency and 4=low>\n" +
            "SUMMARY: <one short sentence describing the delivery>\n\n" +
            "Important: SOURCE and DESTINATION must be a single letter only.\n\n" +
            "User message: " + input;

        String raw = callGemini(prompt);
        System.out.println("  [AI RAW RESPONSE]\n" + raw);
        return parseDeliveryFields(raw, requestId, input);
    }

    private DeliveryRequest parseDeliveryFields(String raw, String id, String original) {
        String source      = cleanNodeValue(extractField(raw, "SOURCE",      "A"));
        String destination = cleanNodeValue(extractField(raw, "DESTINATION", "D"));
        String priorityStr = extractField(raw, "PRIORITY", "3").trim();
        String summary     = extractField(raw, "SUMMARY",  original).trim();

        int priority = 3;
        try {
            priority = Integer.parseInt(priorityStr);
        } catch (NumberFormatException ignored) {}
        priority = Math.max(1, Math.min(4, priority));

        System.out.printf("  [AI] Extracted => source=%s, dest=%s, priority=%d, summary=%s%n",
            source, destination, priority, summary);

        return new DeliveryRequest(id, source, destination, priority);
    }

    // =========================================================================
    // FEATURE 3 — Incident report -> edge block
    // =========================================================================

    public EdgeBlock parseEdgeBlock(String incidentReport, String availableNodes) {
        System.out.println("\n  [AI] Parsing incident: \"" + incidentReport + "\"");

        String prompt =
            "You are a logistics network manager. An incident report describes a road or route failure.\n\n" +
            "Available network nodes: " + availableNodes + "\n\n" +
            "Respond in EXACTLY this format. Each field on its own line. No extra text:\n" +
            "FROM: <single uppercase letter from available nodes, or UNKNOWN>\n" +
            "TO: <single uppercase letter from available nodes, or UNKNOWN>\n" +
            "CONFIDENCE: <LOW|MEDIUM|HIGH>\n" +
            "REASON: <one short sentence>\n\n" +
            "Important: FROM and TO must be a single letter only. Not 'City B'. Just 'B'.\n\n" +
            "Incident report: " + incidentReport;

        String raw = callGemini(prompt);
        System.out.println("  [AI RAW RESPONSE]\n" + raw);
        return parseEdgeBlockFields(raw);
    }

    public static class EdgeBlock {
        public final String  from;
        public final String  to;
        public final String  confidence;
        public final String  reason;
        public final boolean valid;

        public EdgeBlock(String from, String to, String confidence, String reason) {
            this.from       = from;
            this.to         = to;
            this.confidence = confidence;
            this.reason     = reason;
            this.valid      = !from.equals("UNKNOWN") && !to.equals("UNKNOWN")
                              && from.length() == 1   && to.length() == 1;
        }

        @Override
        public String toString() {
            if (!valid) return "[AI EDGE BLOCK] Could not identify a specific edge from this report.";
            return String.format("[AI EDGE BLOCK] Block %s -> %s | Confidence: %s | %s",
                from, to, confidence, reason);
        }
    }

    private EdgeBlock parseEdgeBlockFields(String raw) {
        String from       = cleanNodeValue(extractField(raw, "FROM",       "UNKNOWN"));
        String to         = cleanNodeValue(extractField(raw, "TO",         "UNKNOWN"));
        String confidence = extractField(raw, "CONFIDENCE", "LOW").trim();
        String reason     = extractField(raw, "REASON",     "Unknown").trim();
        return new EdgeBlock(from, to, confidence, reason);
    }

    // =========================================================================
    // Shared HTTP helper
    // =========================================================================

    private String callGemini(String prompt) {
        String escaped = prompt
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");

        String body = "{"
            + "\"contents\": [{"
            + "  \"parts\": [{\"text\": \"" + escaped + "\"}]"
            + "}]"
            + "}";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_URL + apiKey))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

            HttpResponse<String> response =
                client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                System.err.println("  [GeminiService] HTTP " + response.statusCode()
                    + " -- " + response.body());
                return "";
            }

            return extractTextFromGeminiResponse(response.body());

        } catch (Exception e) {
            System.err.println("  [GeminiService] Request failed: " + e.getMessage());
            return "";
        }
    }

    private String extractTextFromGeminiResponse(String json) {
        String marker = "\"text\":";
        int start = json.indexOf(marker);
        if (start == -1) return "";

        start = json.indexOf("\"", start + marker.length()) + 1;
        int end = start;

        while (end < json.length()) {
            char c = json.charAt(end);
            if (c == '\\') { end += 2; continue; }
            if (c == '"')  break;
            end++;
        }

        return json.substring(start, end)
            .replace("\\n", "\n")
            .replace("\\\"", "\"")
            .replace("\\\\", "\\");
    }

    // =========================================================================
    // Parsing helpers — fixed per review
    // =========================================================================

    /**
     * Case-insensitive field extractor.
     * Handles "FROM:", "From:", "from:" equally.
     * Strips inline comments after a # character.
     */
    private String extractField(String text, String key, String fallback) {
        for (String line : text.split("\n")) {
            String trimmed = line.trim();
            // Case-insensitive prefix match
            if (trimmed.toLowerCase().startsWith(key.toLowerCase() + ":")) {
                String value = trimmed.substring(key.length() + 1).trim();
                // Strip anything after # (inline AI comments)
                int hashIdx = value.indexOf('#');
                if (hashIdx != -1) value = value.substring(0, hashIdx).trim();
                if (!value.isEmpty()) return value;
            }
        }
        return fallback;
    }

    /**
     * Cleans a node value returned by Gemini into a single uppercase letter.
     *
     * Handles all the variations the review warned about:
     *   "City C"  -> "C"
     *   "Node C"  -> "C"
     *   "C."      -> "C"
     *   " C "     -> "C"
     *   "c"       -> "C"
     *   "UNKNOWN" -> "UNKNOWN"
     */
    private String cleanNodeValue(String raw) {
        if (raw == null) return "UNKNOWN";
        String cleaned = raw.trim();

        // Preserve UNKNOWN sentinel
        if (cleaned.equalsIgnoreCase("UNKNOWN")) return "UNKNOWN";

        // Remove common prefixes: "City ", "Node ", "Warehouse ", "Center "
        cleaned = cleaned.replaceAll("(?i)^(city|node|warehouse|distribution center|center)\\s+", "");

        // Strip trailing punctuation: periods, commas, colons
        cleaned = cleaned.replaceAll("[.,;:]+$", "").trim();

        // If result is a single letter, uppercase it
        if (cleaned.length() == 1 && Character.isLetter(cleaned.charAt(0))) {
            return cleaned.toUpperCase();
        }

        // Last resort: find the first uppercase letter in the string using regex
        Matcher matcher = Pattern.compile("[A-Z]").matcher(cleaned.toUpperCase());
        if (matcher.find()) return String.valueOf(matcher.group());

        return "UNKNOWN";
    }
}