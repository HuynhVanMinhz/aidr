import { useEffect, useRef, useState } from 'react';

export type BankOption = {
  bin: string;
  name: string;
  shortName: string;
  logo: string;
};

type Props = {
  value: BankOption | null;
  onChange: (bank: BankOption | null) => void;
  id?: string;
  disabled?: boolean;
};

let cachedBanks: BankOption[] | null = null;

async function fetchBanks(): Promise<BankOption[]> {
  if (cachedBanks) return cachedBanks;
  const res = await fetch('https://api.vietqr.io/v2/banks');
  if (!res.ok) throw new Error('Unable to load bank list');
  const json = (await res.json()) as { data?: BankOption[] };
  cachedBanks = (json.data ?? []).filter((b) => b.bin && b.shortName);
  return cachedBanks;
}

export function BankSelect({ value, onChange, id, disabled }: Props) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchBanks()
      .then((list) => { setBanks(list); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = query.trim()
    ? banks.filter((b) =>
        b.shortName.toLowerCase().includes(query.toLowerCase()) ||
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.bin.includes(query),
      )
    : banks;

  function handleSelect(bank: BankOption) {
    onChange(bank);
    setQuery('');
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const displayValue = value ? value.shortName : '';

  return (
    <div ref={containerRef} className="bank-select" style={{ position: 'relative' }}>
      <div className="input-group">
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="form-control"
          placeholder={loading ? 'Loading banks…' : 'Search bank…'}
          value={open ? query : displayValue}
          disabled={disabled || loading}
          autoComplete="off"
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          required={!value}
        />
        {value && !disabled && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <p className="text-danger fs-12 mt-1 mb-0">
          Could not load bank list. Type the bank name manually or try again.
        </p>
      )}

      {open && filtered.length > 0 && (
        <ul
          className="bank-select__dropdown"
          style={{
            position: 'absolute',
            zIndex: 1050,
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: 'auto',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: 'var(--bs-body-bg, #fff)',
            border: '1px solid var(--bs-border-color, rgba(0,0,0,.15))',
            borderRadius: '0 0 6px 6px',
            boxShadow: '0 4px 12px rgba(0,0,0,.1)',
          }}
        >
          {filtered.slice(0, 40).map((bank) => (
            <li key={bank.bin}>
              <button
                type="button"
                className="bank-select__option"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 12px',
                  border: 0,
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(bank); }}
              >
                <img
                  src={bank.logo}
                  alt=""
                  width={28}
                  height={28}
                  style={{ objectFit: 'contain', flexShrink: 0, borderRadius: 4 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <span>
                  <strong style={{ display: 'block', lineHeight: 1.2 }}>{bank.shortName}</strong>
                  <span style={{ color: 'var(--bs-secondary-color, #6c757d)', fontSize: 11 }}>
                    {bank.name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && query.trim() && (
        <div
          style={{
            position: 'absolute',
            zIndex: 1050,
            top: '100%',
            left: 0,
            right: 0,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--bs-secondary-color, #6c757d)',
            background: 'var(--bs-body-bg, #fff)',
            border: '1px solid var(--bs-border-color, rgba(0,0,0,.15))',
            borderRadius: '0 0 6px 6px',
          }}
        >
          No bank found.
        </div>
      )}
    </div>
  );
}
