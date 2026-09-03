package data.workflowshader.nodes;

import data.workflowshader.graph.*;
import java.util.*;

/**
 * User-authored pure GLSL node. The editor must validate ports before constructing this node.
 * Expression placeholders use ${inputName}; helperSource is appended before main().
 */
public final class CustomGlslNode extends Node {
    private final String expression, helperSource;
    public CustomGlslNode(String id, String title, List<Socket> inputs, List<Socket> outputs, String expression, String helperSource) {
        super(id,title); if(outputs == null || outputs.size() != 1) throw new IllegalArgumentException("Custom node MVP requires exactly one output");
        for(Socket socket:inputs) input(socket.name(),socket.type(),socket.defaultExpression());
        for(Socket socket:outputs) output(socket.name(),socket.type());
        this.expression=expression; this.helperSource=helperSource == null ? "" : helperSource;
    }
    @Override public Map<String,String> emit(NodeEmitContext context) {
        String result=expression;
        for(String name:inputs().keySet()) result=result.replace("${"+name+"}",context.input(name));
        return Collections.singletonMap(outputs().keySet().iterator().next(),result);
    }
    @Override public String functions() { return helperSource; }
}
