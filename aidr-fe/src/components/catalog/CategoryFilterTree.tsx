import { useMemo, useState } from 'react';
import type { CategoryTreeNode } from '../../types/catalog';
import { toggleCategoryId } from '../../utils/catalogFilterUtils';
import { FilterCheckbox } from './filters/FilterCheckbox';

const VISIBLE_PARENT_LIMIT = 6;
const MAX_LIST_HEIGHT = 280;

type Props = {
  categories: CategoryTreeNode[];
  selectedIds: number[];
  onChange: (categoryIds: number[]) => void;
};

export function CategoryFilterTree({ categories, selectedIds, onChange }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const parent of categories) {
      initial[parent.categoryId] = true;
    }
    return initial;
  });
  const [showAllParents, setShowAllParents] = useState(false);

  const visibleParents = useMemo(() => {
    if (showAllParents) return categories;
    return categories.slice(0, VISIBLE_PARENT_LIMIT);
  }, [categories, showAllParents]);

  const hiddenParentCount = Math.max(0, categories.length - VISIBLE_PARENT_LIMIT);

  function toggleExpanded(categoryId: number) {
    setExpanded((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }

  if (categories.length === 0) {
    return <p className="catalog-filter-empty">No categories available.</p>;
  }

  return (
    <div className="catalog-category-tree">
      <ul
        className="catalog-category-tree__list catalog-filter-scroll"
        style={{ maxHeight: showAllParents ? undefined : MAX_LIST_HEIGHT }}
      >
        {visibleParents.map((parent) => {
          const hasChildren = (parent.children?.length ?? 0) > 0;
          const isExpanded = expanded[parent.categoryId] ?? true;

          return (
            <li key={parent.categoryId} className="catalog-category-tree__parent">
              <div className="catalog-category-tree__parent-row">
                {hasChildren ? (
                  <button
                    type="button"
                    className="catalog-category-tree__toggle"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
                    onClick={() => toggleExpanded(parent.categoryId)}
                  >
                    <i
                      className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'}`}
                      aria-hidden
                    />
                  </button>
                ) : (
                  <span className="catalog-category-tree__toggle-spacer" aria-hidden />
                )}
                <FilterCheckbox
                  id={`cat_${parent.categoryId}`}
                  variant="parent"
                  checked={selectedIds.includes(parent.categoryId)}
                  label={parent.name}
                  count={parent.productCount ?? 0}
                  onChange={() => onChange(toggleCategoryId(selectedIds, parent.categoryId))}
                />
              </div>

              {hasChildren && isExpanded ? (
                <ul className="catalog-category-tree__children">
                  {parent.children.map((child) => (
                    <li key={child.categoryId}>
                      <FilterCheckbox
                        id={`cat_${child.categoryId}`}
                        variant="child"
                        checked={selectedIds.includes(child.categoryId)}
                        label={child.name}
                        count={child.productCount ?? 0}
                        onChange={() => onChange(toggleCategoryId(selectedIds, child.categoryId))}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {hiddenParentCount > 0 && !showAllParents ? (
        <button
          type="button"
          className="catalog-filter-more"
          onClick={() => setShowAllParents(true)}
        >
          Show more ({hiddenParentCount})
        </button>
      ) : null}
      {showAllParents && categories.length > VISIBLE_PARENT_LIMIT ? (
        <button
          type="button"
          className="catalog-filter-more"
          onClick={() => setShowAllParents(false)}
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}
