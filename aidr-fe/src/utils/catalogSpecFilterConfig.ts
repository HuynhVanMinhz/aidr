import type { CategoryTreeNode } from '../types/catalog';

export type SpecFilterOption = {
  value: string;
  label: string;
};

export type SpecFilterDef = {
  key: string;
  label: string;
  options: SpecFilterOption[];
};

/** Dynamic spec filters keyed by root category slug. */
const SPEC_FILTERS_BY_ROOT_SLUG: Record<string, SpecFilterDef[]> = {
  'dien-thoai': [
    {
      key: 'ram',
      label: 'RAM',
      options: [
        { value: '6GB', label: '6 GB' },
        { value: '8GB', label: '8 GB' },
        { value: '12GB', label: '12 GB' },
        { value: '16GB', label: '16 GB' },
      ],
    },
    {
      key: 'storage',
      label: 'Storage',
      options: [
        { value: '128GB', label: '128 GB' },
        { value: '256GB', label: '256 GB' },
        { value: '512GB', label: '512 GB' },
        { value: '1TB', label: '1 TB' },
      ],
    },
    {
      key: 'connectivity',
      label: 'Network',
      options: [
        { value: '5G', label: '5G' },
        { value: '4G', label: '4G / LTE' },
      ],
    },
  ],
  laptop: [
    {
      key: 'ram',
      label: 'RAM',
      options: [
        { value: '8GB', label: '8 GB' },
        { value: '16GB', label: '16 GB' },
        { value: '32GB', label: '32 GB' },
      ],
    },
    {
      key: 'storage',
      label: 'Storage',
      options: [
        { value: '256GB', label: '256 GB SSD' },
        { value: '512GB', label: '512 GB SSD' },
        { value: '1TB', label: '1 TB SSD' },
      ],
    },
    {
      key: 'screen',
      label: 'Screen size',
      options: [
        { value: '13', label: '13"' },
        { value: '14', label: '14"' },
        { value: '15.6', label: '15.6"' },
        { value: '16', label: '16"' },
      ],
    },
  ],
};

function findNode(nodes: CategoryTreeNode[], categoryId: number): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.categoryId === categoryId) return node;
    const child = findNode(node.children ?? [], categoryId);
    if (child) return child;
  }
  return null;
}

function findRootSlug(nodes: CategoryTreeNode[], categoryId: number): string | null {
  for (const root of nodes) {
    if (root.categoryId === categoryId) return root.slug;
    const stack = [...(root.children ?? [])];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.categoryId === categoryId) return root.slug;
      stack.push(...(node.children ?? []));
    }
  }
  return null;
}

export function resolveDynamicSpecFilters(
  categoryIds: number[],
  categories: CategoryTreeNode[],
): SpecFilterDef[] {
  const slugs = new Set<string>();
  for (const id of categoryIds) {
    const slug = findRootSlug(categories, id);
    if (slug) slugs.add(slug);
  }

  if (slugs.size === 0) return [];

  const defs: SpecFilterDef[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    const group = SPEC_FILTERS_BY_ROOT_SLUG[slug];
    if (!group) continue;
    for (const def of group) {
      if (seen.has(def.key)) continue;
      seen.add(def.key);
      defs.push(def);
    }
  }
  return defs;
}

export function getCategoryName(nodes: CategoryTreeNode[], categoryId: number): string | null {
  const node = findNode(nodes, categoryId);
  return node?.name ?? null;
}
