import type { PluginContext, UiApi } from "../../packages/plugin-sdk/types";
import { projectUiManifest } from "./manifest.mjs";
import { createProjectSession } from "./session.mjs";
import ProjectSettings from "./ProjectSettings.vue";
import ProjectLibrary from "./ProjectLibrary.vue";
import ProjectActions from "./ProjectActions.vue";
import ProjectDialogs from "./ProjectDialogs.vue";
import { isShortcutEditing } from "../../packages/plugin-sdk/shortcuts.mjs";
export const projectUiPlugin = {
  manifest: projectUiManifest,
  activate(context: PluginContext) {
    const ui = context.api<UiApi>("studio.ui"),
      session = createProjectSession({
        ui,
        workflow: context.api<any>("workflow.workspace"),
        presentation: context.api<any>("workflow.presentation"),
        exporter: context.api<any>("workflow.export"),
        templates: context.api<any>("workflow.templates"),
        files: context.api<any>("workflow.project-files"),
        picker: context.api<any>("workflow.file-selection"),
      });
    context.onDispose(() => session.dispose());
    const shortcuts = context.api<any>("studio.shortcuts");
    shortcuts.register([
      {
        id: "studio.project-ui.open-file",
        title: "打开工作流文件",
        scope: "workspace",
        defaults: ["Mod+O"],
      },
      {
        id: "studio.project-ui.save-as-file",
        title: "工作流另存为",
        scope: "workspace",
        defaults: ["Mod+Shift+S"],
      },
      {
        id: "studio.project-ui.save",
        title: "保存工作流",
        scope: "workspace",
        defaults: ["Mod+S"],
      },
      {
        id: "studio.project-ui.export",
        title: "导出特效",
        scope: "workspace",
        defaults: ["Mod+Shift+E"],
      },
    ]);
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (isShortcutEditing(target) || target?.closest("dialog,[role=dialog]"))
        return;
      const id = shortcuts.resolve(event, "workspace");
      if (id) {
        event.preventDefault();
        void session.run(() =>
          id === "studio.project-ui.save"
            ? session.save()
            : id === "studio.project-ui.open-file"
              ? session.files.open()
              : id === "studio.project-ui.save-as-file"
                ? session.files.saveAs()
                : session.exportEffect(),
        );
      }
    };
    window.addEventListener("keydown", keyboard);
    context.onDispose(() => window.removeEventListener("keydown", keyboard));
    for (const [slot, component, extra] of [
      ["project-config", ProjectSettings, {}],
      ["project-library", ProjectLibrary, { examples: false }],
      ["project-examples", ProjectLibrary, { examples: true }],
      ["project-actions", ProjectActions, { mode: "toolbar" }],
      ["project-title-actions", ProjectActions, { mode: "title" }],
    ] as const)
      ui.addView({
        id: context.pluginId + "." + slot,
        slot,
        component,
        props: { session, ...extra },
      });
    ui.addOverlay({
      id: context.pluginId + ".dialogs",
      component: ProjectDialogs,
      props: { session },
    });
  },
};
