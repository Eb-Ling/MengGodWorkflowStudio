// Workflow documents contain JSON data only; snapshots must not share references.
export const clone = value => JSON.parse(JSON.stringify(value));
