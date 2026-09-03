package data.workflowshader;

import data.workflowshader.graph.*;
import data.workflowshader.nodes.*;
import data.workflowshader.runtime.QuadVertices;
import data.workflowshader.runtime.WorkflowShaderPlugin;
import com.fs.starfarer.api.combat.CombatEngineLayers;

/** Ready-to-use graphs and concise integration examples. */
public final class WorkflowExamples {
    private WorkflowExamples() { }

    /** A grayscale animated FBM material: uv + (time * 0.15), mapped to RGBA. */
    public static Graph animatedNoise() {
        Graph graph=new Graph();
        graph.add(Nodes.uv("uv")).add(Nodes.time("time")).add(Nodes.constant("speed",ValueType.FLOAT,"0.15"));
        graph.add(Nodes.multiply("scroll",ValueType.FLOAT)).add(Nodes.combine2("scroll_xy")).add(Nodes.add("moving_uv",ValueType.VEC2));
        graph.add(Nodes.fbm("noise")).add(Nodes.combine3("noise_rgb")).add(Nodes.combine4("color")).add(new OutputNode("output"));
        graph.connect("time","value","scroll","a").connect("speed","value","scroll","b");
        graph.connect("scroll","value","scroll_xy","x").connect("scroll","value","scroll_xy","y");
        graph.connect("uv","uv","moving_uv","a").connect("scroll_xy","value","moving_uv","b");
        graph.connect("moving_uv","value","noise","uv");
        graph.connect("noise","value","noise_rgb","x").connect("noise","value","noise_rgb","y").connect("noise","value","noise_rgb","z");
        graph.connect("noise_rgb","value","color","rgb").connect("noise","value","color","a").connect("color","value","output","color");
        return graph;
    }

    /** Construction now explicitly provides all four local vertices; no implicit rectangle is created. */
    public static WorkflowShaderPlugin createAnimatedNoisePlugin() {
        return new WorkflowShaderPlugin(animatedNoise(), "output",
                QuadVertices.centered(360f, 360f), CombatEngineLayers.BELOW_SHIPS_LAYER);
    }
}
