package data.workflowshader.compiler;

import data.workflowshader.graph.*;
import data.workflowshader.nodes.*;
import java.util.*;

/** Lowers typed graph values to a GLSL 4.30 fragment shader compatible with BoxUtil's UBO pipeline. */
public final class FragmentCompiler {
    public static final class Result { private final String source;private final Set<String> uniforms;Result(String s,Set<String> u){source=s;uniforms=Collections.unmodifiableSet(u);}public String source(){return source;}public Set<String> uniforms(){return uniforms;} }
    public Result compile(final Graph graph,String outputId) {
        if(!(graph.require(outputId) instanceof OutputNode))throw new IllegalArgumentException("Terminal must be an OutputNode: "+outputId);
        final Map<String,String> expressions=new LinkedHashMap<String,String>(); final Set<String> uniformDeclarations=new LinkedHashSet<String>(); final Set<String> functions=new LinkedHashSet<String>();
        for(Node node:graph.nodes()) emit(graph,node,expressions,uniformDeclarations,functions,new HashSet<String>());
        Graph.Link link=graph.incoming(outputId,"color"); String finalExpression=link==null?"vec4(0.0)":value(expressions,link.fromNode,link.fromSocket);
        StringBuilder source=new StringBuilder("#version 430\nin vec2 v_uv;\nout vec4 fragColor;\nuniform float u_time;\nuniform float u_viewportAlpha;\n");
        for(String declaration:uniformDeclarations)source.append(declaration).append('\n'); for(String function:functions)source.append(function);
        source.append("void main(){\n");int index=0;for(Map.Entry<String,String> entry:expressions.entrySet()){String[] key=entry.getKey().split("\\|",2);Node node=graph.require(key[0]);source.append("  ").append(node.output(key[1]).type().glsl()).append(" wf_").append(index).append(" = ").append(entry.getValue()).append(";\n");entry.setValue("wf_"+index++);}
        finalExpression=link==null?"vec4(0.0)":value(expressions,link.fromNode,link.fromSocket);source.append("  fragColor=").append(finalExpression).append(";\n  fragColor.a *= u_viewportAlpha;\n}\n");return new Result(source.toString(),uniformDeclarations);
    }
    private void emit(final Graph graph,final Node node,final Map<String,String> values,final Set<String> uniforms,final Set<String> functions,final Set<String> visiting) {
        if(node instanceof OutputNode||values.containsKey(key(node.id(),node.outputs().isEmpty()?"":node.outputs().keySet().iterator().next())))return;
        if(!visiting.add(node.id()))throw new IllegalArgumentException("Graph cycle detected at: "+node.id());
        for(Socket input:node.inputs().values()){Graph.Link link=graph.incoming(node.id(),input.name());if(link!=null)emit(graph,graph.require(link.fromNode),values,uniforms,functions,visiting);}
        if(node instanceof InputNode){InputNode input=(InputNode)node;uniforms.add("uniform "+input.output("value").type().glsl()+" "+input.uniform()+";");} if(!node.functions().isEmpty())functions.add(node.functions());
        Map<String,String> emitted=node.emit(new NodeEmitContext(){public String input(String name){Socket socket=node.input(name);Graph.Link link=graph.incoming(node.id(),name);return link==null?socket.defaultExpression():value(values,link.fromNode,link.fromSocket);}});for(Map.Entry<String,String> entry:emitted.entrySet())values.put(key(node.id(),entry.getKey()),entry.getValue());visiting.remove(node.id());
    }
    private static String value(Map<String,String> values,String node,String socket){String result=values.get(key(node,socket));if(result==null)throw new IllegalStateException("No emitted value: "+node+"."+socket);return result;} private static String key(String node,String socket){return node+"|"+socket;}
}
