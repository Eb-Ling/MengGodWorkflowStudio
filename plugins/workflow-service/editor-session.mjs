// Application session notifications, independent of any optional integration.
export function createEditorSession() {
  const changes = new Set(),
    activities = new Set();
  let token = crypto.randomUUID();
  return {
    dispose() {
      changes.clear();
      activities.clear();
    },
    token: () => token,
    replace: () => {
      token = crypto.randomUUID();
    },
    changed: () => changes.forEach((listener) => listener()),
    activity: () => activities.forEach((listener) => listener()),
    subscribe(listener) {
      changes.add(listener);
      return () => changes.delete(listener);
    },
    onActivity(listener) {
      activities.add(listener);
      return () => activities.delete(listener);
    },
  };
}
