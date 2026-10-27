import {Children, cloneElement, isValidElement} from 'react';

/** Map the retained JSX design into state-driven React components. */
export function renderTree(node, visitor) {
  if (Array.isArray(node)) return Children.map(node, child => renderTree(child, visitor));
  if (!isValidElement(node)) return node;
  const children = node.props.children;
  const mapped = children == null ? node : cloneElement(node, {}, Children.map(children, child => renderTree(child, visitor)));
  return visitor(mapped);
}

export function hasClass(node, name) {
  return isValidElement(node) && String(node.props.className || '').split(/\s+/).includes(name);
}

export function patch(node, props, ...children) {
  return children.length ? cloneElement(node, props, ...children) : cloneElement(node, props);
}

export function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  return isValidElement(node) ? textOf(node.props.children) : String(node);
}
