import { useState, type FormEvent } from 'react';
import { useNlFilter } from '../../hooks/useAi';
import { useToast } from '../../hooks/useToast';
import type { CatalogFilters } from '../../store/catalogSlice';
import { slotsOrNlToCatalogFilters } from '../../utils/aiChatUi';

type Props = {
  onApplyFilters: (filters: CatalogFilters) => void;
};

/** @deprecated Prefer slotsOrNlToCatalogFilters from utils/aiChatUi */
export function nlResultToCatalogFilters(
  result: Parameters<typeof slotsOrNlToCatalogFilters>[0],
): CatalogFilters {
  return slotsOrNlToCatalogFilters(result);
}

/** Natural-language search bar - maps AI filter DSL into the catalog filter panel. */
export function NlSearchBar({ onApplyFilters }: Props) {
  const toast = useToast();
  const { loading, parse } = useNlFilter();
  const [query, setQuery] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      toast.error('Enter a short description of what you want to find.');
      return;
    }

    try {
      const result = await parse(trimmed);
      onApplyFilters(slotsOrNlToCatalogFilters(result));
      const bits: string[] = [];
      if (result.categoryName) bits.push(result.categoryName);
      if (result.brand) bits.push(result.brand);
      if (result.maxPrice != null) bits.push(`under ${Math.round(result.maxPrice).toLocaleString('vi-VN')} VND`);
      if (result.sort) bits.push(`sort: ${result.sort}`);
      setHint(
        bits.length > 0
          ? `Applied: ${bits.join(' · ')} (${result.source})`
          : `Filters updated from your search (${result.source}).`,
      );
      toast.success('Filters applied from your description.');
    } catch (err) {
      setHint(null);
      toast.error(err instanceof Error ? err.message : 'Unable to convert your search into filters.');
    }
  }

  return (
    <div className="catalog-nl-search mb-4">
      <form className="catalog-nl-search__form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="visually-hidden" htmlFor="nl_search_query">
          Search with natural language
        </label>
        <input
          id="nl_search_query"
          type="search"
          className="form-control"
          placeholder='Try: "Samsung phones under 15 million, cheapest first"'
          value={query}
          maxLength={500}
          disabled={loading}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-default btn-accent" disabled={loading}>
          {loading ? 'Thinking…' : 'AI Search'}
        </button>
      </form>
      {hint && <p className="catalog-nl-search__hint text-muted mb-0 mt-2">{hint}</p>}
    </div>
  );
}
