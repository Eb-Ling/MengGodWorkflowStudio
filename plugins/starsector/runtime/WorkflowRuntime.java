package data.method;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.CombatEngineAPI;
import com.fs.starfarer.api.combat.CombatEngineLayers;
import com.fs.starfarer.api.combat.CombatEntityAPI;
import com.fs.starfarer.api.combat.CombatLayeredRenderingPlugin;
import com.fs.starfarer.api.combat.ViewportAPI;
import com.fs.starfarer.api.graphics.SpriteAPI;
import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.boxutil.BoxUtilModPlugin;
import org.boxutil.base.api.SimpleVAOAPI;
import org.boxutil.base.api.resource.TemporaryCleanupPlugin;
import org.boxutil.config.BoxConfigs;
import org.boxutil.define.struct.instance.Fixed2DStruct;
import org.boxutil.manager.CombatRenderingManager;
import org.boxutil.manager.ShaderCore;
import org.boxutil.units.standard.ShaderProgram;
import org.boxutil.util.ShaderUtil;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GL13;
import org.lwjgl.opengl.GL14;
import org.lwjgl.opengl.GL15;
import org.lwjgl.opengl.GL20;
import org.lwjgl.opengl.GL30;
import org.lwjgl.opengl.GL31;
import org.lwjgl.opengl.GL32;
import org.lwjgl.opengl.GL43;
import org.lwjgl.opengl.GLContext;
import org.lwjgl.util.vector.Vector2f;

/**
 * 工作流导出的公共运行时，一批实例共用着色器、材质和绘制图层。
 *
 * <p>将生成的特效通过 engine.addLayeredRenderingPlugin(effect) 注册一次。
 * 在战斗线程更新实例，调用 effect.markExpired() 结束整批特效。
 * 引擎和 BoxUtil 负责调用渲染与资源清理回调。
 */
public abstract class WorkflowRuntime implements CombatLayeredRenderingPlugin {
    /** 供生成的特效检查公共运行时接口版本。 */
    public static int apiVersion() {
        return 3;
    }

    /** 构造特效时检查接口，版本不匹配时提示重新导出。 */
    protected static void requireApiVersion(int required) {
        if (required != apiVersion()) {
            throw new IllegalStateException(
                "Workflow runtime API mismatch: required " + required + ", found " + apiVersion()
                    + "; re-export WorkflowRuntime.java and the effect together"
            );
        }
    }

    /** 检查有限数值，name 用于定位出错的节点或几何参数。 */
    protected static void requireFinite(float value, String name) {
        if (!Float.isFinite(value)) {
            throw new IllegalArgumentException(name + " must be finite");
        }
    }

    /** 每实例参数数组的长度必须与坐标列表一致。 */
    protected static void requireLength(Object values, int count, String name) {
        Objects.requireNonNull(values, name);
        if (java.lang.reflect.Array.getLength(values) != count) {
            throw new IllegalArgumentException(name + " length must equal positions.size() (" + count + ")");
        }
    }

    /** 坐标使用世界坐标，两个分量都必须是有限数值。 */
    protected static void requirePosition(Vector2f position) {
        Objects.requireNonNull(position, "position");
        requireFinite(position.x, "position.x");
        requireFinite(position.y, "position.y");
    }

    /** 批量入口逐个检查坐标，空列表表示暂时没有实例的批次。 */
    protected static void requirePositions(List<Vector2f> positions) {
        Objects.requireNonNull(positions, "positions");
        for (Vector2f position : positions) {
            requirePosition(position);
        }
    }

    /**
     * 单个实例的稳定句柄，通过生成类的 instance(index) 或 createInstance() 获取。
     * 修改坐标、角度或缩放后，下一次绘制会上传到 GPU。
     */
    public static final class Instance {
        /** 所属批次，移除时释放引用。 */
        private WorkflowRuntime owner;
        /** BoxUtil 二维变换，包含坐标、角度、缩放与默认颜色。 */
        private final Fixed2DStruct transform = new Fixed2DStruct();
        /** 当前实例的节点参数，以导出时分配的字节偏移存储。 */
        private ByteBuffer parameters;
        /** 已移除的句柄只能查询状态。 */
        private boolean removed;

        /** 由所属批次创建，使用单位缩放和不透明白色初始化变换。 */
        private Instance(WorkflowRuntime owner) {
            this.owner = owner;
            parameters = BufferUtils.createByteBuffer(owner.stride);
            transform.setLocation(0, 0).setFacing(0).setScale(1, 1).setColor(1f, 1f, 1f, 1f);
        }

        /** 所有更新入口都检查句柄及所属批次是否仍有效。 */
        private void requireActive() {
            if (removed || owner == null || owner.expired) {
                throw new IllegalStateException("Instance has been removed or its batch has expired");
            }
        }

        /**
         * 复制世界坐标。
         * 跟随舰船时，每帧调用 effect.instance(0).setPosition(ship.getLocation())。
         *
         * @param position 新的中心点坐标
         * @return 当前实例，支持连续设置多个属性
         */
        public Instance setPosition(Vector2f position) {
            requireActive();
            requirePosition(position);
            transform.setLocation(position.x, position.y);
            owner.instancesDirty = true;
            return this;
        }

        /** 设置实例旋转角度，单位为度。 */
        public Instance setAngle(float degrees) {
            requireActive();
            finite(degrees);
            transform.setFacing(degrees);
            owner.instancesDirty = true;
            return this;
        }

        /** 横向和纵向缩放倍率，1 表示使用工作流中的尺寸。 */
        public Instance setScale(float x, float y) {
            requireActive();
            finite(x);
            finite(y);
            transform.setScale(x, y);
            owner.instancesDirty = true;
            return this;
        }

        /** 查询是否已移除，移除后无法继续更新此句柄。 */
        public boolean isRemoved() {
            return removed;
        }

        /** 移除当前实例，可重复调用，批次仍可通过 createInstance() 添加实例。 */
        public void remove() {
            if (removed) {
                return;
            }
            removed = true;
            owner.instancesDirty = true;
            parameters = null;
            owner = null;
        }
    }

    /** 通过 BoxUtil 创建的着色器程序，清理时删除。 */
    protected ShaderProgram program;
    /** 传给 u_time 的累计秒数，游戏暂停时停止累加。 */
    protected float elapsed;

    // 构造时固定的绘制配置，由特效导出类传入。
    private final CombatEngineLayers targetLayer;
    private final String vertexPath;
    private final String fragmentPath;
    private final float[] vertices;
    private final int stride;
    private final int textureCount;
    private final boolean additive;

    // 实例数据与战斗清理登记。
    private final List<Instance> instances = new ArrayList<Instance>();
    private CombatEngineAPI engine;
    private CleanupRegistry cleanupRegistry;
    private final Map<String, Integer> uniformLocations = new HashMap<String, Integer>();

    // CPU 上传缓冲，只有实例数据变化时重新填充。
    private int transformBuffer;
    private FloatBuffer transformUpload;
    private ByteBuffer upload;
    private int capacity;

    // 在实际绘制回调中读取当前视口矩阵。
    private final FloatBuffer projection = BufferUtils.createFloatBuffer(16);
    private final FloatBuffer modelView = BufferUtils.createFloatBuffer(16);
    private final FloatBuffer viewProjection = BufferUtils.createFloatBuffer(16);

    // 本批次拥有的 GPU 资源，以及从 BoxUtil 借用的标准四边形。
    private int parameterBuffer;
    private int vao;
    private int vbo;
    private SimpleVAOAPI sharedQuad;

    // 生命周期和上传标记。
    private boolean attempted;
    private boolean expired;
    private boolean released;
    private boolean cleanupRegistered;
    private boolean instancesDirty = true;

    /**
     * 由生成的特效类调用，GPU 资源在首次绘制时创建。
     *
     * @param layer 绘制图层
     * @param vertex 顶点着色器在 Mod 内的路径
     * @param fragment 片段着色器在 Mod 内的路径
     * @param geometry 四个顶点的局部坐标，顺序为三角形带
     * @param stride 每个实例参数所占字节数，按 16 字节对齐
     * @param textures 本批次使用的纹理数量
     * @param additive 是否采用叠加混合
     */
    protected WorkflowRuntime(
        CombatEngineLayers layer,
        String vertex,
        String fragment,
        float[] geometry,
        int stride,
        int textures,
        boolean additive
    ) {
        if (layer == null || geometry == null || geometry.length != 8 || stride < 16 || stride % 16 != 0) {
            throw new IllegalArgumentException("Invalid batch contract");
        }
        for (float value : geometry) {
            finite(value);
        }
        targetLayer = layer;
        vertexPath = vertex;
        fragmentPath = fragment;
        vertices = geometry.clone();
        this.stride = stride;
        textureCount = textures;
        this.additive = additive;
    }

    /** 检查内部几何值及实例变换使用的数值。 */
    private static void finite(float value) {
        if (!Float.isFinite(value)) {
            throw new IllegalArgumentException("Expected finite value");
        }
    }

    /**
     * 动态添加实例。创建后应设置坐标，并调用生成类的 setter 填写各个每实例参数。
     * 节点参数初始为零，颜色参数也需要由调用方设置。
     */
    public final Instance createInstance() {
        if (expired) {
            throw new IllegalStateException("Batch expired");
        }
        Instance instance = new Instance(this);
        instances.add(instance);
        instancesDirty = true;
        return instance;
    }

    /** 清空实例并释放句柄中的 CPU 引用，批次可继续添加实例。 */
    public final void clearInstances() {
        for (Instance instance : instances) {
            instance.remove();
        }
        instances.clear();
        instancesDirty = true;
    }

    /** 结束整批特效，GPU 资源由后续 cleanup() 回调释放。 */
    public final void markExpired() {
        expired = true;
        clearInstances();
        releaseInstanceReferences();
    }

    /** 生成的特效在此释放构造时保存的实例句柄。 */
    protected void releaseInstanceReferences() {
    }

    /** 生成的浮点与向量参数 setter 通过此方法写入实例数据。 */
    protected final void putFloat(Instance instance, int offset, float value) {
        check(instance, offset);
        finite(value);
        instance.parameters.putFloat(offset, value);
        instancesDirty = true;
    }

    /** 生成的整数与布尔参数 setter 通过此方法写入实例数据。 */
    protected final void putInt(Instance instance, int offset, int value) {
        check(instance, offset);
        instance.parameters.putInt(offset, value);
        instancesDirty = true;
    }

    /** 检查句柄归属、有效状态及写入边界。 */
    private void check(Instance instance, int offset) {
        if (expired || instance == null || instance.owner != this || instance.removed
            || offset < 0 || offset + 4 > stride) {
            throw new IllegalArgumentException("Invalid instance/parameter offset");
        }
    }

    /** 引擎在注册分层渲染插件时调用，保存当前战斗引擎。 */
    @Override
    public void init(CombatEntityAPI entity) {
        engine = Global.getCombatEngine();
    }

    /** 引擎每帧调用，维护动画时间并在战斗结束时标记过期。 */
    @Override
    public void advance(float amount) {
        if (expired || engine == null) {
            return;
        }
        if (engine.isCombatOver()) {
            markExpired();
            return;
        }
        if (!engine.isPaused()) {
            elapsed += amount;
        }
    }

    /** 引擎通过返回值决定是否移除此插件。 */
    @Override
    public boolean isExpired() {
        return expired;
    }

    /** 仅在构造时指定的图层接收绘制回调。 */
    @Override
    public EnumSet<CombatEngineLayers> getActiveLayers() {
        return EnumSet.of(targetLayer);
    }

    /** 顶点节点可能任意位移，采用最大半径防止引擎误裁剪。 */
    @Override
    public float getRenderRadius() {
        return Float.MAX_VALUE;
    }

    /** 生成的特效类实现此方法，上传整批共用的节点参数与纹理。 */
    protected abstract void bindSharedParameters();

    /** 绑定精灵纹理，上传采样器和纹理尺寸。 */
    protected final void bindTexture(String name, int unit, SpriteAPI sprite) {
        if (sprite == null) {
            throw new IllegalArgumentException("Missing texture: " + name);
        }
        GL13.glActiveTexture(GL13.GL_TEXTURE0 + unit);
        GL11.glBindTexture(GL11.GL_TEXTURE_2D, sprite.getTextureId());
        GL20.glUniform1i(uniform(name), unit);
        GL20.glUniform2f(uniform("u_textureAspect_" + name), sprite.getWidth(), sprite.getHeight());
    }

    /** 从 Mod 资源路径读取两份着色器，通过 BoxUtil 编译、链接。 */
    protected int createProgram() {
        return ShaderUtil.createShaderVFFormPath(getClass().getName(), vertexPath, fragmentPath);
    }

    /** 缓存 uniform 位置，减少每帧重复查询。 */
    protected final int uniform(String name) {
        return uniformLocations.computeIfAbsent(name, key -> GL20.glGetUniformLocation(program.getId(), key));
    }

    /** 同一战斗与运行时包共用一个清理登记表，集中处理战斗退出。 */
    protected void registerCombatCleanup() {
        if (engine == null) {
            throw new IllegalStateException("Register the plugin with the combat engine before rendering");
        }
        String key = WorkflowRuntime.class.getName() + ".cleanup";
        Object existing = engine.getCustomData().get(key);
        CleanupRegistry registry = existing instanceof CleanupRegistry
            ? (CleanupRegistry) existing
            : new CleanupRegistry(engine, key);
        if (existing != registry) {
            CombatRenderingManager.addCleanupPlugin(registry);
            engine.getCustomData().put(key, registry);
        }
        registry.batches.add(this);
        cleanupRegistry = registry;
    }

    /** 保存仍需清理的批次，已完成清理的批次会从集合中移除。 */
    private static final class CleanupRegistry implements TemporaryCleanupPlugin {
        private final CombatEngineAPI engine;
        private final String key;
        private final Set<WorkflowRuntime> batches =
            Collections.newSetFromMap(new IdentityHashMap<WorkflowRuntime, Boolean>());

        /** 记录当前战斗及登记表在 customData 中的位置。 */
        CleanupRegistry(CombatEngineAPI engine, String key) {
            this.engine = engine;
            this.key = key;
        }

        /** BoxUtil 在退出战斗时调用，复制集合以允许 cleanup() 同时解除登记。 */
        @Override
        public void cleanupCombatOnce() {
            for (WorkflowRuntime batch : new ArrayList<WorkflowRuntime>(batches)) {
                batch.cleanup();
            }
            batches.clear();
            if (engine.getCustomData().get(key) == this) {
                engine.getCustomData().remove(key);
            }
        }
    }

    /** 首次绘制时创建程序、实例缓冲及几何资源，随后登记战斗清理。 */
    private void initialize() {
        int id = createProgram();
        if (id <= 0) {
            throw new IllegalStateException(
                "Shader loading/compilation/link failed; keep the exported paths under the Mod root: "
                    + vertexPath + ", " + fragmentPath
            );
        }
        program = new ShaderProgram(id);
        if (GL11.glGetInteger(GL43.GL_MAX_VERTEX_SHADER_STORAGE_BLOCKS) < 2
            || textureCount > GL11.glGetInteger(GL20.GL_MAX_TEXTURE_IMAGE_UNITS)) {
            throw new IllegalStateException("Insufficient shader storage or texture units");
        }

        // binding 0 存放工作流参数，binding 5 存放 BoxUtil 实例变换。
        parameterBuffer = GL15.glGenBuffers();
        transformBuffer = GL15.glGenBuffers();
        if (parameterBuffer == 0 || transformBuffer == 0) {
            throw new IllegalStateException("SSBO allocation failed");
        }

        // 标准四边形借用共享 VAO，其他尺寸使用本批次自己的顶点缓冲。
        if (Arrays.equals(vertices, new float[]{-1, -1, 1, -1, -1, 1, 1, 1})) {
            sharedQuad = ShaderCore.getDefaultQuadObject();
        }
        if (sharedQuad == null || !sharedQuad.isValid()) {
            sharedQuad = null;
            vao = GL30.glGenVertexArrays();
            vbo = GL15.glGenBuffers();
            if (vao == 0 || vbo == 0 || parameterBuffer == 0) {
                throw new IllegalStateException("GPU allocation failed");
            }
            GL30.glBindVertexArray(vao);
            GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER, vbo);
            FloatBuffer data = BufferUtils.createFloatBuffer(8);
            data.put(vertices).flip();
            GL15.glBufferData(GL15.GL_ARRAY_BUFFER, data, GL15.GL_STATIC_DRAW);
            GL20.glEnableVertexAttribArray(0);
            GL20.glVertexAttribPointer(0, 2, GL11.GL_FLOAT, false, 8, 0L);
        }
        if (!cleanupRegistered) {
            registerCombatCleanup();
            cleanupRegistered = true;
        }
    }

    /** 数据变化时更新两个 SSBO，每次绘制都恢复本批次使用的绑定点。 */
    private void uploadInstances() {
        int count = instances.size();
        if (instancesDirty) {
            if (count > capacity) {
                int next = Math.max(count, Math.max(16, capacity * 2));
                long maxBlock = GL32.glGetInteger64(GL43.GL_MAX_SHADER_STORAGE_BLOCK_SIZE);
                if ((long) next * Math.max(stride, 32) > maxBlock) {
                    throw new IllegalStateException("Instance data exceeds device SSBO block limit");
                }
                capacity = next;
                upload = BufferUtils.createByteBuffer(Math.multiplyExact(capacity, stride));
                transformUpload = BufferUtils.createFloatBuffer(Math.multiplyExact(capacity, 8));
            }

            transformUpload.clear();
            for (Instance instance : instances) {
                transformUpload.put(instance.transform.getData());
            }
            transformUpload.flip();
            GL15.glBindBuffer(GL43.GL_SHADER_STORAGE_BUFFER, transformBuffer);
            GL15.glBufferData(GL43.GL_SHADER_STORAGE_BUFFER, (long) capacity * 32, GL15.GL_STREAM_DRAW);
            GL15.glBufferSubData(GL43.GL_SHADER_STORAGE_BUFFER, 0L, transformUpload);

            upload.clear();
            for (Instance instance : instances) {
                instance.parameters.position(0);
                upload.put(instance.parameters);
                instance.parameters.position(0);
            }
            upload.flip();
            GL15.glBindBuffer(GL43.GL_SHADER_STORAGE_BUFFER, parameterBuffer);
            GL15.glBufferData(GL43.GL_SHADER_STORAGE_BUFFER, (long) capacity * stride, GL15.GL_STREAM_DRAW);
            GL15.glBufferSubData(GL43.GL_SHADER_STORAGE_BUFFER, 0L, upload);
            instancesDirty = false;
        }
        GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER, 0, parameterBuffer);
        GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER, 5, transformBuffer);
        GL20.glUniform1i(uniform("u_instanceOffset"), 0);
    }

    /** 在绘制回调内计算 P × MV，使用当前战斗视口的平移与缩放。 */
    private void uploadViewProjection() {
        projection.clear();
        modelView.clear();
        viewProjection.clear();
        GL11.glGetFloat(GL11.GL_PROJECTION_MATRIX, projection);
        GL11.glGetFloat(GL11.GL_MODELVIEW_MATRIX, modelView);
        for (int column = 0; column < 4; column++) {
            for (int row = 0; row < 4; row++) {
                float value = 0;
                for (int index = 0; index < 4; index++) {
                    value += projection.get(index * 4 + row) * modelView.get(column * 4 + index);
                }
                viewProjection.put(value);
            }
        }
        viewProjection.flip();
        GL20.glUniformMatrix4(uniform("u_viewProjection"), false, viewProjection);
    }

    /** 引擎在指定图层调用，批量绘制后恢复 OpenGL 状态。 */
    @Override
    public void render(CombatEngineLayers layer, ViewportAPI viewport) {
        if (expired || layer != targetLayer) {
            return;
        }
        instances.removeIf(instance -> instance.removed);
        if (instances.isEmpty()) {
            return;
        }
        if (!GLContext.getCapabilities().OpenGL43 || !GLContext.getCapabilities().OpenGL11) {
            Global.getLogger(getClass()).warn("Workflow requires OpenGL 4.3 compatibility support");
            cleanup();
            return;
        }

        // 等待 BoxUtil 完成初始化，再创建本批次的 GPU 资源。
        if (!BoxUtilModPlugin.isGlobalInitialized()) {
            return;
        }
        if (!BoxConfigs.isShaderEnable() || !ShaderCore.isValid()) {
            Global.getLogger(getClass()).warn("Workflow disabled: BoxUtil shaders/core are unavailable");
            cleanup();
            return;
        }

        try (WorkflowGlState ignored = new WorkflowGlState(textureCount)) {
            if (!attempted) {
                attempted = true;
                initialize();
            }
            program.active();
            uploadInstances();
            uploadViewProjection();

            // 半透明绘制所需状态，退出 try 块时统一还原。
            GL11.glEnable(GL11.GL_BLEND);
            GL11.glDisable(GL11.GL_ALPHA_TEST);
            GL11.glDisable(GL11.GL_DEPTH_TEST);
            GL11.glDepthMask(false);
            GL11.glDisable(GL11.GL_CULL_FACE);
            GL20.glBlendEquationSeparate(GL14.GL_FUNC_ADD, GL14.GL_FUNC_ADD);
            GL14.glBlendFuncSeparate(
                GL11.GL_SRC_ALPHA,
                additive ? GL11.GL_ONE : GL11.GL_ONE_MINUS_SRC_ALPHA,
                GL11.GL_ONE,
                GL11.GL_ONE_MINUS_SRC_ALPHA
            );
            GL20.glUniform1f(uniform("u_time"), elapsed);
            GL20.glUniform1f(uniform("u_viewportAlpha"), viewport.getAlphaMult());
            bindSharedParameters();
            GL30.glBindVertexArray(sharedQuad != null ? sharedQuad.getVAO() : vao);
            GL31.glDrawArraysInstanced(GL11.GL_TRIANGLE_STRIP, 0, 4, instances.size());
        } catch (RuntimeException failure) {
            Global.getLogger(getClass()).error("Workflow renderer disabled", failure);
            cleanup();
        }
    }

    /** 引擎或战斗清理回调负责调用，释放本批次拥有的资源，允许重复清理。 */
    @Override
    public void cleanup() {
        markExpired();
        if (released) {
            return;
        }
        released = true;
        if (transformBuffer != 0) {
            GL15.glDeleteBuffers(transformBuffer);
            transformBuffer = 0;
        }
        transformUpload = null;
        if (vao != 0) {
            GL30.glDeleteVertexArrays(vao);
            vao = 0;
        }
        if (vbo != 0) {
            GL15.glDeleteBuffers(vbo);
            vbo = 0;
        }
        if (parameterBuffer != 0) {
            GL15.glDeleteBuffers(parameterBuffer);
            parameterBuffer = 0;
        }
        if (program != null) {
            program.delete();
            program = null;
        }
        upload = null;
        uniformLocations.clear();
        sharedQuad = null;
        if (cleanupRegistry != null) {
            cleanupRegistry.batches.remove(this);
            cleanupRegistry = null;
        }
        engine = null;
    }

    /** 保存绘制会影响的 OpenGL 状态，close() 在正常或异常退出时还原。 */
    private static final class WorkflowGlState implements AutoCloseable {
        // 程序、几何、缓冲与当前纹理单元。
        private final int program = GL11.glGetInteger(GL20.GL_CURRENT_PROGRAM);
        private final int vao = GL11.glGetInteger(GL30.GL_VERTEX_ARRAY_BINDING);
        private final int array = GL11.glGetInteger(GL15.GL_ARRAY_BUFFER_BINDING);
        private final int ssbo = GL11.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING);
        private final int activeTexture = GL11.glGetInteger(GL13.GL_ACTIVE_TEXTURE);

        // 混合方程、开关与深度写入状态。
        private final int srcRgb = GL11.glGetInteger(GL14.GL_BLEND_SRC_RGB);
        private final int dstRgb = GL11.glGetInteger(GL14.GL_BLEND_DST_RGB);
        private final int srcAlpha = GL11.glGetInteger(GL14.GL_BLEND_SRC_ALPHA);
        private final int dstAlpha = GL11.glGetInteger(GL14.GL_BLEND_DST_ALPHA);
        private final int equationRgb = GL11.glGetInteger(GL20.GL_BLEND_EQUATION_RGB);
        private final int equationAlpha = GL11.glGetInteger(GL20.GL_BLEND_EQUATION_ALPHA);
        private final boolean blend = GL11.glIsEnabled(GL11.GL_BLEND);
        private final boolean alphaTest = GL11.glIsEnabled(GL11.GL_ALPHA_TEST);
        private final boolean depth = GL11.glIsEnabled(GL11.GL_DEPTH_TEST);
        private final boolean cull = GL11.glIsEnabled(GL11.GL_CULL_FACE);
        private final boolean depthMask = GL11.glGetBoolean(GL11.GL_DEPTH_WRITEMASK);

        // 保存纹理绑定，以及 SSBO 绑定点的缓冲、偏移和范围。
        private final int[] textures;
        private final int[] bindings = {0, 5};
        private final int[] buffers = new int[2];
        private final long[] starts = new long[2];
        private final long[] sizes = new long[2];

        /** 绘制前捕获状态，采集纹理后立即还原当前纹理单元。 */
        WorkflowGlState(int textureCount) {
            textures = new int[textureCount];
            for (int i = 0; i < textureCount; i++) {
                GL13.glActiveTexture(GL13.GL_TEXTURE0 + i);
                textures[i] = GL11.glGetInteger(GL11.GL_TEXTURE_BINDING_2D);
            }
            GL13.glActiveTexture(activeTexture);
            for (int i = 0; i < bindings.length; i++) {
                buffers[i] = GL30.glGetInteger(GL43.GL_SHADER_STORAGE_BUFFER_BINDING, bindings[i]);
                starts[i] = GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_START, bindings[i]);
                sizes[i] = GL32.glGetInteger64(GL43.GL_SHADER_STORAGE_BUFFER_SIZE, bindings[i]);
            }
        }

        /** 按保存的布尔值还原一个 OpenGL 开关。 */
        private static void enable(int capability, boolean value) {
            if (value) {
                GL11.glEnable(capability);
            } else {
                GL11.glDisable(capability);
            }
        }

        /** 恢复纹理、缓冲绑定、程序及混合和深度状态。 */
        @Override
        public void close() {
            for (int i = 0; i < textures.length; i++) {
                GL13.glActiveTexture(GL13.GL_TEXTURE0 + i);
                GL11.glBindTexture(GL11.GL_TEXTURE_2D, textures[i]);
            }
            GL13.glActiveTexture(activeTexture);
            for (int i = 0; i < bindings.length; i++) {
                if (buffers[i] != 0 && sizes[i] > 0) {
                    GL30.glBindBufferRange(
                        GL43.GL_SHADER_STORAGE_BUFFER, bindings[i], buffers[i], starts[i], sizes[i]
                    );
                } else {
                    GL30.glBindBufferBase(GL43.GL_SHADER_STORAGE_BUFFER, bindings[i], buffers[i]);
                }
            }
            GL15.glBindBuffer(GL43.GL_SHADER_STORAGE_BUFFER, ssbo);
            GL30.glBindVertexArray(vao);
            GL15.glBindBuffer(GL15.GL_ARRAY_BUFFER, array);
            GL20.glUseProgram(program);
            enable(GL11.GL_BLEND, blend);
            enable(GL11.GL_ALPHA_TEST, alphaTest);
            enable(GL11.GL_DEPTH_TEST, depth);
            enable(GL11.GL_CULL_FACE, cull);
            GL11.glDepthMask(depthMask);
            GL14.glBlendFuncSeparate(srcRgb, dstRgb, srcAlpha, dstAlpha);
            GL20.glBlendEquationSeparate(equationRgb, equationAlpha);
        }
    }
}
