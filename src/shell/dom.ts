/** Tiny DOM helper to keep the shell framework-free. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Omit<HTMLElementTagNameMap[K], 'dataset'>> & { class?: string; dataset?: Record<string, string> } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, dataset, ...rest } = props;
  if (cls) node.className = cls;
  if (dataset) for (const [k, v] of Object.entries(dataset)) node.dataset[k] = v;
  Object.assign(node, rest);
  for (const c of children) node.append(c);
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}
