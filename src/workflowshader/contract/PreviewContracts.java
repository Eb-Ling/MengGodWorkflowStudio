package data.workflowshader.contract;

import java.util.*;

/** DTOs shared by every frontend and every pluggable preview-renderer implementation. */
public final class PreviewContracts {
    private PreviewContracts() { }
    public static final class Request { public String projectId,nodeId,outputSocket; public long revision; public int width=512,height=512; public Map<String,float[]> inputs=new LinkedHashMap<String,float[]>(); }
    public static final class Session { public String sessionId; public long revision; public int width,height; }
    public static final class Frame { public String sessionId,mimeType; public long revision,sequence; public byte[] encodedImage; }
    public static final class Metrics { public String sessionId; public float fps,compileMs,renderMs; public int passCount; }
}
