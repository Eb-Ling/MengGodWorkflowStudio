package data.workflowshader.application;

import data.workflowshader.contract.*;
import data.workflowshader.preview.PreviewRenderer;

/** Frontend-facing application boundary; transport adapters call this instead of mutating Graph directly. */
public interface GraphApplicationService {
    GraphSnapshotDto load(String projectId);
    CommandResult execute(String projectId, GraphCommand command);
    PreviewContracts.Session openPreview(PreviewContracts.Request request, PreviewRenderer renderer);

    final class CommandResult {
        public final boolean accepted; public final GraphSnapshotDto snapshot; public final String errorCode, message;
        public CommandResult(boolean accepted, GraphSnapshotDto snapshot, String errorCode, String message) { this.accepted=accepted;this.snapshot=snapshot;this.errorCode=errorCode;this.message=message; }
        public static CommandResult conflict(GraphSnapshotDto latest) { return new CommandResult(false,latest,"REVISION_CONFLICT","The graph changed; reload the supplied snapshot."); }
    }
}
