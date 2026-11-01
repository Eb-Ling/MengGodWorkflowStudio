param([string]$base = "http://127.0.0.1:4175")
$ErrorActionPreference = "Stop"

function Invoke-WorkflowAction($action) {
    $request = @{ actions = @($action) } | ConvertTo-Json -Depth 20
    Invoke-RestMethod -Method Post -Uri "$base/v1/commands" -ContentType "application/json" -Body $request | Out-Null
}

function Invoke-WorkflowActionExpectFailure($action, $expectedText) {
    $request = @{ actions = @($action) } | ConvertTo-Json -Depth 20
    try {
        Invoke-RestMethod -Method Post -Uri "$base/v1/commands" -ContentType "application/json" -Body $request | Out-Null
        throw "Expected operation to fail, but it succeeded."
    } catch {
        $message = $_.ErrorDetails.Message
        if (-not $message) { $message = $_.Exception.Message }
        try { $message = ($message | ConvertFrom-Json).error } catch { }
        if ($message -notmatch [regex]::Escape($expectedText)) { throw "Unexpected rejection: $message" }
    }
}

function Import-Case($name, $className, $nodes, $links, $outputNodeId) {
    $workflow = @{
        schemaVersion = 1
        project = @{ id = "verify-$name"; title = "Export verify: $name"; className = $className; shaderDir = "data/shaders/generated" }
        graph = @{ schemaVersion = 1; projectId = "verify-$name"; revision = 0; outputNodeId = $outputNodeId; nodes = $nodes; links = $links }
        vertexTransform = @{ vertices = @(@(-80,-40),@(80,-40),@(-80,40),@(80,40)); tx = 0; ty = 0; sx = 1; sy = 1; rotation = 0 }
    }
    Invoke-WorkflowAction @{ type = "IMPORT_WORKFLOW_DATA"; payload = @{ workflow = $workflow } }
    Invoke-WorkflowAction @{ type = "EXPORT_RUNTIME"; payload = @{} }
    $state = Invoke-RestMethod "$base/v1/state"
    [pscustomobject]@{
        Name = $name
        Graph = $state.graph
        Java = $state.generatedSources.java.content
        Vertex = $state.generatedSources.vertex.content
        Fragment = $state.generatedSources.fragment.content
    }
}

function Node($id, $typeId, $x, $y, $properties = @{}) {
    @{ id = $id; typeId = $typeId; title = $id; canvasX = $x; canvasY = $y; properties = $properties }
}

function Link($fromNode, $fromSocket, $toNode, $toSocket) {
    @{ fromNode = $fromNode; fromSocket = $fromSocket; toNode = $toNode; toSocket = $toSocket }
}

$results = @()

# 1. Fixed RGBA color.
$results += Import-Case "solid" "VerifySolidPlugin" @(
    (Node "r" "math.constant" 10 10 @{ value = "0.2"; valueType = "FLOAT" }),
    (Node "g" "math.constant" 10 80 @{ value = "0.4"; valueType = "FLOAT" }),
    (Node "b" "math.constant" 10 150 @{ value = "0.8"; valueType = "FLOAT" }),
    (Node "a" "math.constant" 10 220 @{ value = "1.0"; valueType = "FLOAT" }),
    (Node "rgba" "vector.combine" 250 100 @{ valueType = "VEC4" }),
    (Node "out" "io.output" 500 100 @{})
) @(
    (Link "r" "value" "rgba" "x"), (Link "g" "value" "rgba" "y"),
    (Link "b" "value" "rgba" "z"), (Link "a" "value" "rgba" "w"),
    (Link "rgba" "value" "out" "color")
) "out"

# 2. vec3 + float public uniforms combined to a fragment color.
$results += Import-Case "uniforms" "VerifyUniformPlugin" @(
    (Node "color" "io.input" 10 10 @{ uniform = "u_color"; defaultValue = "0, 0, 0"; valueType = "VEC3" }),
    (Node "alpha" "io.input" 10 100 @{ uniform = "u_alpha"; defaultValue = "1"; valueType = "FLOAT" }),
    (Node "split" "vector.split" 240 10 @{ valueType = "VEC3" }),
    (Node "rgba" "vector.combine" 460 60 @{ valueType = "VEC4" }),
    (Node "out" "io.output" 700 60 @{})
) @(
    (Link "color" "value" "split" "value"), (Link "split" "x" "rgba" "x"),
    (Link "split" "y" "rgba" "y"), (Link "split" "z" "rgba" "z"),
    (Link "alpha" "value" "rgba" "w"), (Link "rgba" "value" "out" "color")
) "out"

# 3. Direct SpriteAPI-backed sampler2D input.
$results += Import-Case "texture" "VerifyTexturePlugin" @(
    (Node "tex" "input.texture" 10 10 @{ textureId = "shipSprite"; uniform = "u_shipTexture" }),
    (Node "uv" "input.uv" 10 140 @{}),
    (Node "sample" "texture.sample2d" 260 60 @{}),
    (Node "out" "io.output" 520 60 @{})
) @(
    (Link "tex" "texture" "sample" "texture"), (Link "uv" "uv" "sample" "uv"),
    (Link "sample" "rgba" "out" "color")
) "out"

# 4. Texture sampled then modulated by public vec4 tint.
$results += Import-Case "texture_tint" "VerifyTextureTintPlugin" @(
    (Node "tex" "input.texture" 10 10 @{ textureId = "effectSprite"; uniform = "u_effectTexture" }),
    (Node "uv" "input.uv" 10 140 @{}),
    (Node "sample" "texture.sample2d" 220 60 @{}),
    (Node "tint" "io.input" 220 190 @{ uniform = "u_tint"; defaultValue = "1, 1, 1, 1"; valueType = "VEC4" }),
    (Node "mul" "math.multiply" 470 90 @{ valueType = "VEC4" }),
    (Node "out" "io.output" 720 90 @{})
) @(
    (Link "tex" "texture" "sample" "texture"), (Link "uv" "uv" "sample" "uv"),
    (Link "sample" "rgba" "mul" "a"), (Link "tint" "value" "mul" "b"),
    (Link "mul" "value" "out" "color")
) "out"

# 4b. Java parameter IDs are independent of texture resource IDs.
$results += Import-Case "keyword_texture" "VerifyKeywordTexturePlugin" @(
    (Node "tex" "input.texture" 10 10 @{ textureId = "class"; uniform = "u_keywordTexture" }),
    (Node "uv" "input.uv" 10 140 @{}), (Node "sample" "texture.sample2d" 260 60 @{}), (Node "out" "io.output" 520 60 @{})
) @(
    (Link "tex" "texture" "sample" "texture"), (Link "uv" "uv" "sample" "uv"), (Link "sample" "rgba" "out" "color")
) "out"

# 5. Two SpriteAPI texture inputs, texture units 0/1, then GLSL vec4 mix.
$results += Import-Case "two_textures" "VerifyTwoTexturesPlugin" @(
    (Node "first" "input.texture" 10 10 @{ textureId = "firstSprite"; uniform = "u_firstTexture" }),
    (Node "second" "input.texture" 10 100 @{ textureId = "secondSprite"; uniform = "u_secondTexture" }),
    (Node "uv" "input.uv" 10 200 @{}),
    (Node "sampleFirst" "texture.sample2d" 270 10 @{}),
    (Node "sampleSecond" "texture.sample2d" 270 140 @{}),
    (Node "blend" "io.input" 500 250 @{ uniform = "u_blend"; defaultValue = "0.5"; valueType = "FLOAT" }),
    (Node "mix" "math.mix" 530 80 @{ valueType = "VEC4" }),
    (Node "out" "io.output" 790 80 @{})
) @(
    (Link "first" "texture" "sampleFirst" "texture"), (Link "second" "texture" "sampleSecond" "texture"),
    (Link "uv" "uv" "sampleFirst" "uv"), (Link "uv" "uv" "sampleSecond" "uv"),
    (Link "sampleFirst" "rgba" "mix" "a"), (Link "sampleSecond" "rgba" "mix" "b"),
    (Link "blend" "value" "mix" "t"), (Link "mix" "value" "out" "color")
) "out"

# 6. Custom GLSL function: bool and vec4 inputs with two out ports.
Invoke-WorkflowAction @{ type = "UPSERT_CUSTOM_NODE"; payload = @{ definition = @{
    title = "Select and luminance"; typeId = "custom.select_luminance";
    parameters = @(
        @{ id = "condition"; name = "condition"; type = "bool"; qualifier = "in" },
        @{ id = "whenTrue"; name = "whenTrue"; type = "vec4"; qualifier = "in" },
        @{ id = "whenFalse"; name = "whenFalse"; type = "vec4"; qualifier = "in" },
        @{ id = "color"; name = "color"; type = "vec4"; qualifier = "out" },
        @{ id = "luminance"; name = "luminance"; type = "float"; qualifier = "out" }
    );
    code = "color = condition ? whenTrue : whenFalse;`nluminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));"
} } }
$results += Import-Case "custom_multi_out" "VerifyCustomPlugin" @(
    (Node "condition" "io.input" 10 10 @{ uniform = "u_enabled"; defaultValue = "true"; valueType = "BOOL" }),
    (Node "yes" "io.input" 10 100 @{ uniform = "u_yes"; defaultValue = "1, 0, 0, 1"; valueType = "VEC4" }),
    (Node "no" "io.input" 10 200 @{ uniform = "u_no"; defaultValue = "0, 0, 1, 1"; valueType = "VEC4" }),
    (Node "custom" "custom.select_luminance" 300 100 @{}),
    (Node "out" "io.output" 620 100 @{})
) @(
    (Link "condition" "value" "custom" "condition"), (Link "yes" "value" "custom" "whenTrue"),
    (Link "no" "value" "custom" "whenFalse"), (Link "custom" "color" "out" "color")
) "out"

# 7. Custom GLSL inout port must create an input and an output connection surface.
Invoke-WorkflowAction @{ type = "UPSERT_CUSTOM_NODE"; payload = @{ definition = @{
    title = "Gain inout"; typeId = "custom.gain_inout";
    parameters = @(
        @{ id = "value"; name = "value"; type = "float"; qualifier = "inout" },
        @{ id = "gain"; name = "gain"; type = "float"; qualifier = "in" }
    );
    code = "value *= gain;"
} } }
$results += Import-Case "custom_inout" "VerifyInOutPlugin" @(
    (Node "base" "io.input" 10 10 @{ uniform = "u_base"; defaultValue = "0.25"; valueType = "FLOAT" }),
    (Node "gain" "io.input" 10 100 @{ uniform = "u_gain"; defaultValue = "2"; valueType = "FLOAT" }),
    (Node "custom" "custom.gain_inout" 280 50 @{}),
    (Node "rgba" "vector.combine" 520 50 @{ valueType = "VEC4" }),
    (Node "out" "io.output" 760 50 @{})
) @(
    (Link "base" "value" "custom" "value"), (Link "gain" "value" "custom" "gain"),
    (Link "custom" "value" "rgba" "x"), (Link "custom" "value" "rgba" "y"),
    (Link "custom" "value" "rgba" "z"), (Link "custom" "value" "rgba" "w"),
    (Link "rgba" "value" "out" "color")
) "out"

# 8. The public Java constructor intentionally rejects unrepresentable GLSL uniform types.
$unsupported = @{
    schemaVersion = 1
    project = @{ id = "verify-unsupported"; title = "Unsupported type"; className = "VerifyUnsupportedPlugin"; shaderDir = "data/shaders/generated" }
    graph = @{ schemaVersion = 1; projectId = "verify-unsupported"; revision = 0; outputNodeId = "out"; nodes = @(
        (Node "matrix" "io.input" 10 10 @{ uniform = "u_matrix"; defaultValue = "1, 0, 0, 1"; valueType = "MAT4" }),
        (Node "color" "math.constant" 10 100 @{ value = "1, 1, 1, 1"; valueType = "VEC4" }),
        (Node "out" "io.output" 200 100 @{})
    ); links = @((Link "color" "value" "out" "color")) }
}
Invoke-WorkflowAction @{ type = "IMPORT_WORKFLOW_DATA"; payload = @{ workflow = $unsupported } }
Invoke-WorkflowActionExpectFailure @{ type = "EXPORT_RUNTIME"; payload = @{} } "公共 uniform 参数不支持"

# 9. Same uniform name for a texture and ordinary input is rejected before source emission.
$collision = @{
    schemaVersion = 1
    project = @{ id = "verify-collision"; title = "Uniform collision"; className = "VerifyCollisionPlugin"; shaderDir = "data/shaders/generated" }
    graph = @{ schemaVersion = 1; projectId = "verify-collision"; revision = 0; outputNodeId = "out"; nodes = @(
        (Node "texture" "input.texture" 10 10 @{ textureId = "sprite"; uniform = "u_shared" }),
        (Node "scalar" "io.input" 10 100 @{ uniform = "u_shared"; defaultValue = "0"; valueType = "FLOAT" }),
        (Node "uv" "input.uv" 10 200 @{}), (Node "sample" "texture.sample2d" 220 50 @{}), (Node "out" "io.output" 450 50 @{})
    ); links = @((Link "texture" "texture" "sample" "texture"), (Link "uv" "uv" "sample" "uv"), (Link "sample" "rgba" "out" "color")) }
}
Invoke-WorkflowAction @{ type = "IMPORT_WORKFLOW_DATA"; payload = @{ workflow = $collision } }
Invoke-WorkflowActionExpectFailure @{ type = "EXPORT_RUNTIME"; payload = @{} } "跨节点参数声明冲突"

# 10. u_time belongs to the runtime clock and cannot be redeclared by a user input.
$reserved = @{
    schemaVersion = 1
    project = @{ id = "verify-reserved"; title = "Reserved uniform"; className = "VerifyReservedPlugin"; shaderDir = "data/shaders/generated" }
    graph = @{ schemaVersion = 1; projectId = "verify-reserved"; revision = 0; outputNodeId = "out"; nodes = @(
        (Node "time" "io.input" 10 10 @{ uniform = "u_time"; defaultValue = "0"; valueType = "FLOAT" }),
        (Node "color" "math.constant" 10 100 @{ value = "1, 1, 1, 1"; valueType = "VEC4" }),
        (Node "out" "io.output" 200 100 @{})
    ); links = @((Link "color" "value" "out" "color")) }
}
Invoke-WorkflowAction @{ type = "IMPORT_WORKFLOW_DATA"; payload = @{ workflow = $reserved } }
Invoke-WorkflowActionExpectFailure @{ type = "EXPORT_RUNTIME"; payload = @{} } "运行时保留"

# 11. A Java keyword cannot be used as the generated Plugin class name.
$badClass = @{
    schemaVersion = 1
    project = @{ id = "verify-class"; title = "Bad Java class"; className = "class"; shaderDir = "data/shaders/generated" }
    graph = @{ schemaVersion = 1; projectId = "verify-class"; revision = 0; outputNodeId = "out"; nodes = @(
        (Node "color" "math.constant" 10 100 @{ value = "1, 1, 1, 1"; valueType = "VEC4" }), (Node "out" "io.output" 200 100 @{})
    ); links = @((Link "color" "value" "out" "color")) }
}
Invoke-WorkflowAction @{ type = "IMPORT_WORKFLOW_DATA"; payload = @{ workflow = $badClass } }
Invoke-WorkflowActionExpectFailure @{ type = "EXPORT_RUNTIME"; payload = @{} } "Java 类名无效"

# 12. If branches write variables; only variable outputs may leave the control frame.
$results += Import-Case "if_variables" "VerifyIfPlugin" @(
    (Node "condition" "io.input" 10 20 @{ uniform = "u_condition"; defaultValue = "true"; valueType = "BOOL" }),
    (Node "if" "logic.if" 300 10 @{ trueWidth = 430; trueHeight = 300; falseWidth = 430; falseHeight = 300 }),
    (Node "trueValue" "math.constant" 380 100 @{ value = "1"; valueType = "FLOAT" }),
    (Node "trueVariable" "logic.variable" 560 100 @{ valueType = "FLOAT"; initialValue = "0"; name = "trueValue" }),
    (Node "falseValue" "math.constant" 800 100 @{ value = "0.25"; valueType = "FLOAT" }),
    (Node "falseVariable" "logic.variable" 980 100 @{ valueType = "FLOAT"; initialValue = "0"; name = "falseValue" }),
    (Node "rgba" "vector.combine" 1260 100 @{ valueType = "VEC4" }), (Node "out" "io.output" 1510 100 @{})
) @(
    (Link "condition" "value" "if" "condition"), (Link "trueValue" "value" "trueVariable" "value"),
    (Link "falseValue" "value" "falseVariable" "value"),
    (Link "trueVariable" "value" "rgba" "x"), (Link "trueVariable" "value" "rgba" "y"),
    (Link "falseVariable" "value" "rgba" "z"), (Link "falseVariable" "value" "rgba" "w"),
    (Link "rgba" "value" "out" "color")
) "out"

# 13. For exposes i only inside its frame and writes the result through a variable.
$results += Import-Case "for_variables" "VerifyForPlugin" @(
    (Node "count" "io.input" 10 20 @{ uniform = "u_count"; defaultValue = "3"; valueType = "FLOAT" }),
    (Node "loop" "logic.for" 300 10 @{ width = 430; height = 300 }),
    (Node "multiplier" "math.constant" 380 100 @{ value = "0.2"; valueType = "FLOAT" }),
    (Node "scale" "math.multiply" 510 100 @{ valueType = "FLOAT" }),
    (Node "variable" "logic.variable" 650 100 @{ valueType = "FLOAT"; initialValue = "0"; name = "loopValue" }),
    (Node "rgba" "vector.combine" 900 100 @{ valueType = "VEC4" }), (Node "out" "io.output" 1150 100 @{})
) @(
    (Link "count" "value" "loop" "count"), (Link "loop" "i" "scale" "a"),
    (Link "multiplier" "value" "scale" "b"), (Link "scale" "value" "variable" "value"),
    (Link "variable" "value" "rgba" "x"), (Link "variable" "value" "rgba" "y"),
    (Link "variable" "value" "rgba" "z"), (Link "variable" "value" "rgba" "w"),
    (Link "rgba" "value" "out" "color")
) "out"

$results | ForEach-Object {
    $javaOk =  $_.Java.Contains("extends WorkflowBatch") -and $_.Java.Contains("bindSharedParameters")
    $pairOk =  $_.Vertex.Contains("gl_InstanceID") -and $_.Vertex.Contains("WorkflowParameters") -and $_.Fragment.Contains("void main()") -and $_.Fragment.Contains("fragColor =")
    $textureOk = if ($_.Name.Contains("texture")) { $_.Fragment.Contains("uniform sampler2D") -and $_.Fragment.Contains("vec4 vec4_1 = sampleTexture") -and $_.Java.Contains("SpriteAPI") -and  $_.Java.Contains("bindTexture") } else { $true }
    $uniformOk = if ($_.Name -eq "uniforms") { $_.Java.Contains("Vector3f color") -and $_.Java.Contains("GL20.glUniform3f") -and $_.Fragment.Contains("uniform vec3 u_color") } else { $true }
    $customOk = if ($_.Name -eq "custom_multi_out") { $_.Fragment.Contains("void wf_custom_custom_select_luminance") -and $_.Fragment.Contains("vec4 wf_custom_vec4_1") -and $_.Fragment.Contains("float wf_custom_float_1") -and -not $_.Fragment.Contains("float wf_custom_vec4_1") -and $_.Java.Contains("boolean enabled") } elseif ($_.Name -eq "custom_inout") { $_.Fragment.Contains("void wf_custom_custom_gain_inout") -and $_.Fragment.Contains("float wf_custom_float_1 = u_base") } else { $true }
    $multiTextureOk = if ($_.Name -eq "two_textures") { $_.Java.Contains('bindTexture("u_secondTexture",1') -and $_.Fragment.Contains("uniform sampler2D u_firstTexture") -and $_.Fragment.Contains("uniform sampler2D u_secondTexture") } else { $true }
    $keywordOk = if ($_.Name -eq "keyword_texture") { $_.Java.Contains("SpriteAPI keywordTexture") -and -not $_.Java.Contains("SpriteAPI class)") } else { $true }
    $controlFlowOk = if ($_.Name -eq "if_variables") { $_.Fragment.Contains("float wf_var_trueVariable = 0.0000;") -and $_.Fragment.Contains("if (u_condition)") -and $_.Fragment.Contains("wf_var_trueVariable = float_1;") -and $_.Fragment.Contains("wf_var_falseVariable = float_2;") } elseif ($_.Name -eq "for_variables") { $_.Fragment.Contains("for (int wf_loop_i_loop = 0;") -and $_.Fragment.Contains("float(wf_loop_i_loop)") -and $_.Fragment.Contains("wf_var_variable = float_2;") } else { $true }
    if (-not ($javaOk -and $pairOk -and $textureOk -and $uniformOk -and $customOk -and $multiTextureOk -and $keywordOk -and $controlFlowOk)) { throw "Generated source validation failed for $($_.Name)." }
    [pscustomobject]@{ Name = $_.Name; JavaChars = $_.Java.Length; VertexChars = $_.Vertex.Length; FragmentChars = $_.Fragment.Length; JavaPipeline = $javaOk; ShaderPair = $pairOk; TextureBindings = $textureOk; UniformBindings = $uniformOk; CustomBindings = $customOk; MultiTextureBindings = $multiTextureOk; JavaKeywordSafety = $keywordOk; ControlFlow = $controlFlowOk }
} | Format-Table -AutoSize

$results | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 "build/workflow-export-verification-results.json"
