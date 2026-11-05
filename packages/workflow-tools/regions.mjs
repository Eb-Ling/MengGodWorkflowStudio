export function branchOwner(graph, node) {
  return graph.nodes.find((item) => {
    if (item.typeId === "logic.if")
      return (
        node.canvasX >= item.canvasX &&
        node.canvasX <=
          item.canvasX + Number(item.properties.trueWidth || 430) * 2 + 40 &&
        node.canvasY >= item.canvasY + 48 &&
        node.canvasY <=
          item.canvasY + Number(item.properties.trueHeight || 300) + 48
      );
    if (item.typeId === "logic.for")
      return (
        node.canvasX >= item.canvasX &&
        node.canvasX <= item.canvasX + Number(item.properties.width || 430) &&
        node.canvasY >= item.canvasY + 48 &&
        node.canvasY <=
          item.canvasY + 48 + Number(item.properties.height || 300)
      );
    return false;
  });
}
export function branchSide(controlNode, node) {
  return controlNode.typeId === "logic.for"
    ? "loop"
    : node.canvasX <
        controlNode.canvasX +
          Number(controlNode.properties.trueWidth || 430) +
          20
      ? "true"
      : "false";
}
export function variableBranchOwner(graph, node) {
  const link = graph.links.find(
      (item) => item.toNode === node.id && item.toSocket === "value",
    ),
    source = link && graph.nodes.find((item) => item.id === link.fromNode),
    sourceOwner = source && branchOwner(graph, source),
    owner = sourceOwner || branchOwner(graph, node);
  return owner
    ? {
        ownerId: owner.id,
        branch: branchSide(owner, sourceOwner ? source : node),
      }
    : null;
}
