import {
  createCommandGateway,
  OperationRegistry,
} from "../../packages/kernel/index.mjs";
import { createDocumentController } from "./document-controller.js";
import { createWorkflowAccess } from "./workflow-api.js";
import { createNodeContributions } from "./node-contributions.js";
import { WorkflowRepository } from "../project/workflow-repository.js";
import { persistentStorage } from "../project/persistent-storage.js";
import { downloadZip } from "../export/zip.js";

/** L1 状态与浏览器端口。这里只装配内核、存取数据和转交事件，不决定业务次序。 */
export function createWorkspacePorts() {
  const preferences = persistentStorage(),
    operations = new OperationRegistry();
  let nodes;
  const text = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = String(value);
  };
  return {
    operationApi: (...args) => operations.createApi(...args),
    invalidateNodes: (owner) => nodes?.registry.invalidate(owner),
    nodeRegistry: {
      contributions(initial) {
        nodes = createNodeContributions(initial);
        return nodes;
      },
    },
    state: {
      preferences: () => ({
        getItem: (key) => preferences.getItem(key),
        setItem: (key, value) => preferences.setItem(key, value),
      }),
      repository: () =>
        new WorkflowRepository({ session: sessionStorage, local: preferences }),
      document: (options) => createDocumentController(options),
      access: (options) => createWorkflowAccess(options),
      stage: () =>
        new URLSearchParams(location.search).get("stage") === "vertex"
          ? "vertex"
          : "fragment",
      text,
      setStage(stage, title) {
        const url = new URL(location.href);
        url.searchParams.set("stage", stage);
        history.replaceState(null, "", url);
        document.title = title + " · Workflow Shader";
        document.body.dataset.stage = stage;
      },
    },
    execution: {
      gateway: (options) => createCommandGateway(options),
    },
    downloads: {
      blob(name, blob) {
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), {
          href: url,
          download: name,
        }).click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      zip: (name, files) => downloadZip(name, files),
      text(name, content) {
        const url = URL.createObjectURL(
          new Blob([content], { type: "text/plain;charset=utf-8" }),
        );
        const a = Object.assign(document.createElement("a"), {
          href: url,
          download: name,
        });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    },
  };
}
