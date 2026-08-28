import type { SpecFilterDef } from '../../../utils/catalogSpecFilterConfig';
import { FilterSection } from './FilterSection';
import { FilterCheckbox } from './FilterCheckbox';

type Props = {
  defs: SpecFilterDef[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
};

export function DynamicSpecFilters({ defs, values, onChange }: Props) {
  if (defs.length === 0) return null;

  function toggle(key: string, value: string) {
    const next = { ...values };
    if (next[key] === value) delete next[key];
    else next[key] = value;
    onChange(next);
  }

  return (
    <>
      {defs.map((def) => (
        <FilterSection
          key={def.key}
          title={def.label}
          badge={values[def.key] ? 1 : 0}
          defaultOpen
        >
          <ul className="catalog-filter-option-list">
            {def.options.map((opt) => (
              <li key={opt.value}>
                <FilterCheckbox
                  id={`spec_${def.key}_${opt.value}`}
                  checked={values[def.key] === opt.value}
                  label={opt.label}
                  onChange={() => toggle(def.key, opt.value)}
                />
              </li>
            ))}
          </ul>
        </FilterSection>
      ))}
    </>
  );
}
