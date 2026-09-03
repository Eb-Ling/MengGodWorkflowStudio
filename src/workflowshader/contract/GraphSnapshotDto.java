package data.workflowshader.contract;

import java.util.*;

/** Frontend-safe authoritative graph snapshot; intentionally independent from graph and OpenGL classes. */
public final class GraphSnapshotDto {
    public int schemaVersion;
    public String projectId;
    public long revision;
    public List<NodeDto> nodes = new ArrayList<NodeDto>();
    public List<LinkDto> links = new ArrayList<LinkDto>();
    public String outputNodeId;

    public static final class NodeDto {
        public String id, typeId, title;
        public float canvasX, canvasY;
        /** `AUTO` is editor-only. A type resolver must replace it with a concrete ValueType before compilation. */
        public String resolvedValueType;
        public Map<String, Object> properties = new LinkedHashMap<String, Object>();
    }
    public static final class LinkDto { public String fromNode, fromSocket, toNode, toSocket; }
}
