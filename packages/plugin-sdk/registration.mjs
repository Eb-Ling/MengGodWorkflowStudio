/**
 * 本地注册句柄：所有者只作身份说明，实际权限仍由宿主决定。
 * 清理至多执行一次，异步清理返回同一个 Promise，这不是第二套生命周期管理器。
 * @param {string} owner
 * @param {()=>void|Promise<void>} cleanup
 */
export function registration(owner, cleanup) {
  let active = true,
    result;
  return Object.freeze({
    owner,
    get active() {
      return active;
    },
    dispose() {
      if (!active) return result;
      active = false;
      result = cleanup();
      return result;
    },
  });
}

/**
 * 将已创建的资源交给唯一宿主兜底，登记失败立即回滚，主动释放时移除兜底回调。
 * own 返回的函数仅取消登记，不能代替资源释放。组件/函数句柄仅用于 local API。
 * @template {{owner:string, dispose:()=>void}} T
 * @param {(cleanup:()=>void|Promise<void>)=>void|(()=>void)} own
 * @param {T} handle
 */
export function ownRegistration(own, handle) {
  let forget;
  const owned = registration(handle.owner, () => {
    try {
      return handle.dispose();
    } finally {
      if (typeof forget === "function") forget();
    }
  });
  try {
    forget = own(owned.dispose);
  } catch (error) {
    owned.dispose();
    throw error;
  }
  return owned;
}
