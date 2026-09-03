package data.workflowshader.graph;

import java.util.*;

/** Extension point for custom workflow nodes. Nodes are pure and contain no OpenGL state. */
public abstract class Node {
    private final String id, title;
    private final Map<String, Socket> inputs=new LinkedHashMap<String, Socket>(), outputs=new LinkedHashMap<String, Socket>();
    protected Node(String id, String title) { if(!id.matches("[A-Za-z_][A-Za-z0-9_]*")) throw new IllegalArgumentException("Invalid node id: "+id); this.id=id; this.title=title; }
    protected final void input(String name, ValueType type, String fallback) { inputs.put(name,new Socket(name,type,fallback)); }
    protected final void output(String name, ValueType type) { outputs.put(name,new Socket(name,type,null)); }
    public final String id() { return id; } public final String title() { return title; }
    public final Map<String,Socket> inputs() { return Collections.unmodifiableMap(inputs); } public final Map<String,Socket> outputs() { return Collections.unmodifiableMap(outputs); }
    public final Socket input(String name) { return inputs.get(name); } public final Socket output(String name) { return outputs.get(name); }
    public abstract Map<String,String> emit(NodeEmitContext inputs);
    /** GLSL function declarations required by this node, without version/IO declarations. */
    public String functions() { return ""; }
}
