package data.workflowshader.preview;

import data.workflowshader.compiler.FragmentCompiler;
import data.workflowshader.contract.PreviewContracts;

/**
 * Pluggable preview backend. UI code sees only PreviewContracts and can switch local/game/remote renderers.
 * Implementations own their GL context and must never leak GPU handles across this boundary.
 */
public interface PreviewRenderer extends AutoCloseable {
    PreviewContracts.Session open(PreviewContracts.Request request);
    void updateInputs(String sessionId, long revision, java.util.Map<String, float[]> inputs);
    PreviewContracts.Frame render(String sessionId, FragmentCompiler.Result compilation);
    PreviewContracts.Metrics metrics(String sessionId);
    void closeSession(String sessionId);
    @Override void close();
}
