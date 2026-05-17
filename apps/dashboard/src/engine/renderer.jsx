import React from "react";
import { resolveBindings } from "./bindings";

function renderNode(node, registry, ctx) {
  if (!node) return null;
  const Component = registry[node.type] || registry.Fallback;
  const dataContext = ctx?.data?.context;
  const resolvedProps = dataContext ? resolveBindings(node.props || {}, dataContext) : node.props;
  const resolvedNode = resolvedProps === node.props ? node : { ...node, props: resolvedProps };
  const children = Array.isArray(node.children)
    ? node.children.map((child) => renderNode(child, registry, ctx))
    : null;

  return (
    <Component key={resolvedNode.id || resolvedNode.type} node={resolvedNode} ctx={ctx}>
      {children}
    </Component>
  );
}

export function EngineRenderer({ surface, registry, ctx }) {
  if (!surface?.tree) return null;
  return renderNode(surface.tree, registry, ctx);
}
