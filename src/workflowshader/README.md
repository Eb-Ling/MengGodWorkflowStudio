# Workflow Shader Engine

`data.workflowshader` is a graph-to-GLSL 4.20 fragment-shader engine for Starsector combat effects.

It intentionally uses the same modern path as this mod's BoxUtil effects:

- `BUtilGlobalData` / `gameViewport` UBO for combat-world projection;
- a VAO/VBO quad, a `modelMatrix` uniform, and no matrix stack or immediate-mode calls;
- `ShaderCore.getMatrixUBOBinding()` to use BoxUtil's active viewport matrix;
- guarded OpenGL program, VAO and blending state restoration.

The packages are deliberately separated:

- `graph`: typed serializable-domain model, ports, connections and node contracts;
- `nodes`: built-in math, XY/vector, noise and I/O nodes;
- `compiler`: validation, topological graph lowering and GLSL generation;
- `runtime`: Starsector/BoxUtil renderer bridge and GPU resource lifecycle.

An editor can construct the same `Graph` objects, then later add JSON DTO/adapters without changing compilation or rendering.
