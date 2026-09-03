package data.workflowshader.contract;

import java.util.*;

/** Versioned command envelope. Application code validates its payload before modifying a domain graph. */
public final class GraphCommand {
    public String commandId, type;
    public long expectedRevision;
    public Map<String, Object> payload = new LinkedHashMap<String, Object>();
}
