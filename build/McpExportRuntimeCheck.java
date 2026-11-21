package data.scripts.workflow;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.SettingsAPI;
import com.fs.starfarer.api.combat.*;
import data.scripts.FinalBatch;
import data.scripts.FinalNativeSingle;
import java.lang.reflect.*;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.util.*;
import org.boxutil.base.api.resource.TemporaryCleanupPlugin;
import org.boxutil.config.BoxConfigGUI;
import org.boxutil.config.BoxConfigs;
import org.boxutil.manager.ShaderCore;
import org.boxutil.units.standard.ShaderProgram;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.*;
import org.lwjgl.util.vector.Vector2f;
import org.lwjgl.util.vector.Vector4f;

/**
 * 检查公开 MCP 原样交付的两组文件，不调用生成器或修改导出源码。
 * 参数依次为 FinalNativeSingle 和 FinalBatch 的三文件目录。
 * 游戏与 BoxUtil 的启动环境仅在本测试 JVM 中模拟，不能替代游戏内验收。
 */
public final class McpExportRuntimeCheck {
    private static final CombatEngineLayers LAYER = CombatEngineLayers.BELOW_SHIPS_LAYER;
    private static boolean paused;
    private static int registrations;

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static Field field(Class<?> owner, String name) throws Exception {
        Field value = owner.getDeclaredField(name);
        value.setAccessible(true);
        return value;
    }

    private static Class<?> runtime(Object effect) {
        return effect.getClass().getSuperclass();
    }

    private static Object inspect(Object effect, String name) throws Exception {
        return field(runtime(effect), name).get(effect);
    }

    private static void rejects(Runnable action) {
        try {
            action.run();
        } catch (IllegalArgumentException | NullPointerException expected) {
            return;
        }
        throw new AssertionError("Invalid constructor input was accepted");
    }

    private static void camera(float x, float y, float halfSize) {
        GL11.glMatrixMode(GL11.GL_PROJECTION);
        GL11.glLoadIdentity();
        GL11.glOrtho(-halfSize, halfSize, -halfSize, halfSize, -1, 1);
        GL11.glMatrixMode(GL11.GL_MODELVIEW);
        GL11.glLoadIdentity();
        GL11.glTranslatef(-x, -y, 0);
    }

    private static void draw(CombatLayeredRenderingPlugin effect, ViewportAPI viewport,
                             CombatEngineLayers layer) {
        GL11.glClearColor(0, 0, 0, 0);
        GL11.glClear(GL11.GL_COLOR_BUFFER_BIT);
        effect.render(layer, viewport);
        GL11.glFinish();
    }

    private static int[] pixel(int x, int y) {
        ByteBuffer bytes = BufferUtils.createByteBuffer(4);
        GL11.glReadPixels(x, y, 1, 1, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, bytes);
        return new int[] {bytes.get(0) & 255, bytes.get(1) & 255,
                          bytes.get(2) & 255, bytes.get(3) & 255};
    }

    private static int[] bounds() {
        ByteBuffer bytes = BufferUtils.createByteBuffer(256 * 256 * 4);
        GL11.glReadPixels(0, 0, 256, 256, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, bytes);
        int minX = 256, minY = 256, maxX = -1, maxY = -1;
        for (int y = 0; y < 256; y++) {
            for (int x = 0; x < 256; x++) {
                if ((bytes.get((y * 256 + x) * 4 + 2) & 255) <= 20) continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        return new int[] {minX, minY, maxX, maxY};
    }

    private static void released(Object effect, int oldProgram) throws Exception {
        for (String name : List.of("vao", "vbo", "transformBuffer", "parameterBuffer")) {
            check((Integer) inspect(effect, name) == 0, "GPU handle retained: " + name);
        }
        check(inspect(effect, "program") == null, "Program reference retained");
        check(!GL20.glIsProgram(oldProgram), "Program still exists after cleanup");
        Object[] handles = (Object[]) field(effect.getClass(), "configuredInstances").get(effect);
        check(Arrays.stream(handles).allMatch(Objects::isNull), "Instance handle retained");
    }

    public static void main(String[] args) throws Exception {
        Path singleDirectory = Path.of(args[0]);
        Path batchDirectory = Path.of(args[1]);
        var previousEngine = Global.getCombatEngine();
        var previousSettings = Global.getSettings();
        Map<String, Object> custom = new HashMap<>();
        CombatEngineAPI engine = (CombatEngineAPI) Proxy.newProxyInstance(
            McpExportRuntimeCheck.class.getClassLoader(), new Class<?>[] {CombatEngineAPI.class},
            (object, method, values) -> switch (method.getName()) {
                case "getCustomData" -> custom;
                case "isPaused" -> paused;
                case "isCombatOver" -> false;
                case "addLayeredRenderingPlugin" -> {
                    registrations++;
                    ((CombatLayeredRenderingPlugin) values[0]).init(null);
                    yield null;
                }
                default -> throw new UnsupportedOperationException(method.getName());
            });
        Global.setCombatEngine(engine);
        Global.setSettings((SettingsAPI) Proxy.newProxyInstance(
            McpExportRuntimeCheck.class.getClassLoader(), new Class<?>[] {SettingsAPI.class},
            (object, method, values) -> switch (method.getName()) {
                case "getScreenScaleMult" -> 1f;
                case "getBoolean" -> false;
                case "loadText" -> {
                    String file = (String) values[0];
                    Path directory = file.contains("FinalNativeSingle") ? singleDirectory : batchDirectory;
                    yield Files.readString(directory.resolve(file));
                }
                default -> throw new UnsupportedOperationException(method.getName());
            }));
        ViewportAPI viewport = (ViewportAPI) Proxy.newProxyInstance(
            McpExportRuntimeCheck.class.getClassLoader(), new Class<?>[] {ViewportAPI.class},
            (object, method, values) -> method.getName().equals("getAlphaMult") ? 1f : null);

        Vector2f center = new Vector2f(1800, -750);
        FinalNativeSingle single = new FinalNativeSingle(LAYER, center);
        center.set(0, 0);
        rejects(() -> new FinalNativeSingle(LAYER, (Vector2f) null));
        rejects(() -> new FinalNativeSingle(LAYER, new Vector2f(Float.NaN, 0)));
        check(runtime(single).getSuperclass() == Object.class, "Unexpected Base superclass");
        check(inspect(single, "program") == null, "Constructor requires a GL context");
        engine.addLayeredRenderingPlugin(single);
        check(registrations == 1, "Single entry should register once");
        single.advance(0.5f);
        paused = true;
        single.advance(1f);
        paused = false;
        check((Float) inspect(single, "elapsed") == 0.5f, "Paused combat advances time");

        List<Vector2f> positions = new ArrayList<>();
        Vector4f[] colors = new Vector4f[8];
        float[] scale = new float[8], spin = new float[8];
        Arrays.fill(scale, 1f);
        for (int i = 0; i < 8; i++) {
            positions.add(new Vector2f(-600 + (i % 4) * 400, i < 4 ? -300 : 300));
            colors[i] = i % 2 == 0 ? new Vector4f(1, 0, 0, 0.25f) : new Vector4f(0, 1, 0, 0.75f);
        }
        FinalBatch batch = new FinalBatch(LAYER, positions, scale, spin, colors);
        rejects(() -> new FinalBatch(LAYER, positions, new float[7], spin, colors));
        rejects(() -> new FinalBatch(LAYER, positions, scale, spin, new Vector4f[8]));
        positions.get(0).set(9999, 9999);
        colors[0].set(0, 0, 0, 0);
        engine.addLayeredRenderingPlugin(batch);

        Pbuffer surface = new Pbuffer(256, 256, new PixelFormat(), null, null,
            new ContextAttribs(4, 3).withProfileCompatibility(true));
        Map<Field, Object> savedBox = new LinkedHashMap<>();
        try {
            surface.makeCurrent();
            org.boxutil.define.GLWrapper.init();
            GL11.glViewport(0, 0, 256, 256);
            Map<Class<?>, String> flags = Map.of(BoxConfigGUI.class, "globalInit",
                BoxConfigs.class, "BUtil_EnableShader", ShaderCore.class, "glValid");
            for (var flag : flags.entrySet()) {
                Field value = field(flag.getKey(), flag.getValue());
                savedBox.put(value, value.get(null));
                value.set(null, true);
            }
            GL11.glEnable(GL11.GL_ALPHA_TEST);
            GL11.glAlphaFunc(GL11.GL_GREATER, 0.9f);
            camera(1800, -750, 400);
            draw(single, viewport, LAYER);
            check(Arrays.equals(bounds(), new int[] {64, 64, 191, 191}),
                "Single Vector2f did not produce centered 400 x 400 square: " + Arrays.toString(bounds()));
            check(GL11.glIsEnabled(GL11.GL_ALPHA_TEST) && GL11.glGetFloat(GL11.GL_ALPHA_TEST_REF) == 0.9f,
                "Inherited alpha-test state changed");
            camera(1900, -750, 400);
            draw(single, viewport, LAYER);
            check(Arrays.equals(bounds(), new int[] {32, 64, 159, 191}), "Camera translation mismatch");
            camera(1800, -750, 800);
            draw(single, viewport, LAYER);
            check(Arrays.equals(bounds(), new int[] {96, 96, 159, 159}), "Camera zoom mismatch");
            single.instance(0).setPosition(new Vector2f(2200, -350));
            camera(2200, -350, 400);
            draw(single, viewport, LAYER);
            check(Arrays.equals(bounds(), new int[] {64, 64, 191, 191}), "Follow-position update failed");
            draw(single, viewport, CombatEngineLayers.ABOVE_SHIPS_LAYER);
            check(Arrays.equals(bounds(), new int[] {256, 256, -1, -1}), "Wrong layer rendered");
            System.out.println("PASS: unchanged single-coordinate export, square bounds, camera pan/zoom, following, pause, alpha state and layer");

            camera(0, 0, 1000);
            draw(batch, viewport, LAYER);
            for (int i = 0; i < 8; i++) {
                int x = (int) ((-600 + i % 4 * 400 + 1000) / 2000f * 256);
                int y = (int) (((i < 4 ? -300 : 300) + 1000) / 2000f * 256);
                int[] rgba = pixel(x, y);
                int channel = i % 2 == 0 ? 0 : 1;
                int expected = i % 2 == 0 ? 64 : 191;
                check(Math.abs(rgba[channel] - expected) <= 1,
                    "Batch position/color mismatch at instance " + i + ": " + Arrays.toString(rgba));
            }
            batch.instance(0).setPosition(new Vector2f(800, 800));
            draw(batch, viewport, LAYER);
            check(pixel(51, 89)[0] == 0 && Math.abs(pixel(230, 230)[0] - 64) <= 1,
                "Moving instance should only affect its own position");
            var removed = batch.instance(0);
            removed.remove();
            draw(batch, viewport, LAYER);
            check(removed.isRemoved() && pixel(230, 230)[0] == 0, "Removing instance left pixels");
            System.out.println("PASS: eight independent Vector2f positions, copied colors, per-instance arrays, movement and removal");

            int singleProgram = ((ShaderProgram) inspect(single, "program")).getId();
            int batchProgram = ((ShaderProgram) inspect(batch, "program")).getId();
            single.markExpired();
            single.cleanup();
            single.cleanup();
            batch.markExpired();
            batch.cleanup();
            batch.cleanup();
            released(single, singleProgram);
            released(batch, batchProgram);
            for (Object registry : new ArrayList<>(custom.values())) {
                if (registry instanceof TemporaryCleanupPlugin cleanup) cleanup.cleanupCombatOnce();
            }
            check(custom.isEmpty(), "Combat registry retained finished effects");
            check(GL11.glGetError() == GL11.GL_NO_ERROR, "OpenGL error remained");
            System.out.println("PASS: repeated cleanup releases programs, buffers, generated instance references and combat registries");
        } finally {
            for (var saved : savedBox.entrySet()) saved.getKey().set(null, saved.getValue());
            surface.destroy();
            Global.setCombatEngine(previousEngine);
            Global.setSettings(previousSettings);
        }
    }
}
