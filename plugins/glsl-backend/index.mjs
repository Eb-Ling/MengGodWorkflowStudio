import { glslManifest } from "./manifest.mjs";
import { emitModule } from "./emitter.mjs";
/** 实现可替换的异步数据协议。没有编辑器、节点插件或平台对象依赖。 */
export const glslPlugin = {
  manifest: glslManifest,
  activate(context) {
    context.provide("shader.backend.glsl", {
      emit: async (request) => emitModule(request),
    });
  },
};
