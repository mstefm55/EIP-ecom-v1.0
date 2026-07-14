import React from "react";
import { resolveBindings } from "./bindings";
import { translateUiProps, useEipLanguage } from "../i18n/EipLanguageContext.jsx";

function renderNode(node, registry, ctx, translateText) {
  if (!node) return null;
  const Component = registry[node.type] || registry.Fallback;
  const dataContext = ctx?.data?.context;
  const resolvedProps = dataContext ? resolveBindings(node.props || {}, dataContext) : node.props;
  const translatedProps = translateUiProps(resolvedProps || {}, translateText);
  const resolvedNode = translatedProps === node.props ? node : { ...node, props: translatedProps };
  const children = Array.isArray(node.children)
    ? node.children.map((child) => renderNode(child, registry, ctx, translateText))
    : null;

  return (
    <Component key={resolvedNode.id || resolvedNode.type} node={resolvedNode} ctx={ctx}>
      {children}
    </Component>
  );
}

export function EngineRenderer({ surface, registry, ctx }) {
  const i18n = useEipLanguage();
  if (!surface?.tree) return null;
  const nextCtx = { ...ctx, i18n };
  return renderNode(surface.tree, registry, nextCtx, i18n.translateText);
}
