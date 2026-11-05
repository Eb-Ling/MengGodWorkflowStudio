/** 参数 ID 是用户定义的公开名称，与节点 ID 和着色器 uniform 名称分别保存。 */
export function parameterId(node) {
  return (
    node.properties.parameterId ??
    String(node.properties.uniform || "u_value").replace(/^u_/, "")
  );
}

/** 通用名称只检查字母、数字和下划线，目标语言关键字由导出目标检查。 */
export function validParameterId(id) {
  return typeof id === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(id);
}
