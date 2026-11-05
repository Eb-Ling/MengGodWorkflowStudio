import type { Disposable } from "./types";
/** 仅受信任模块使用的本地契约。命令实现留在贡献插件，服务只解析按键。 */
export interface ShortcutDefinition {
  /** ID 必须以贡献插件 ID 加点开头，停用时自动注销。 */
  id: string;
  title: string;
  /** 作用域隔离：graph / preview / workspace，扩展可使用自己的作用域。 */
  scope: string;
  /** 最多三个默认组合，空数组表示默认未绑定。Mod 为 Ctrl/Command。 */
  defaults: string[];
}
export interface ShortcutEntry extends ShortcutDefinition {
  owner: string;
  bindings: string[];
  conflicts: string[];
}
export interface ShortcutsApi {
  register(definitions: ShortcutDefinition[]): Disposable;
  list(): ShortcutEntry[];
  subscribe(listener: () => void): () => void;
  /** 返回当前消费者在给定作用域匹配的命令 ID，冲突、输入法等情况返回 null。 */
  resolve(event: KeyboardEvent, scope: string): string | null;
  /** 更新并持久化，冲突时拒绝，空数组取消绑定。 */
  configure(id: string, bindings: string[]): void;
  reset(id?: string): void;
}
