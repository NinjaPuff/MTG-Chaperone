import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';

type ScryfallSet = {
  code: string;
  name: string;
  icon_svg_uri: string | null;
  set_type: string;
  released_at: string | null;
};

type ApiListResponse<T> = {
  data: T[];
};

type SetCodePickerProps = {
  value: string[];
  onChange: (codes: string[]) => void;
  multiple?: boolean;
  label?: string;
  placeholder?: string;
};

export function SetCodePicker({
  value,
  onChange,
  multiple = true,
  label = 'Set Codes',
  placeholder = 'Search sets by name or code',
}: SetCodePickerProps) {
  const [sets, setSets] = useState<ScryfallSet[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState(value.join(', '));

  useEffect(() => {
    setManualValue(value.join(', '));
  }, [value]);

  useEffect(() => {
    const loadSets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiRequest<ApiListResponse<ScryfallSet>>('/api/sets');
        setSets(response.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load set list');
      } finally {
        setIsLoading(false);
      }
    };

    void loadSets();
  }, []);

  const normalizedValue = useMemo(() => new Set(value.map((code) => code.toUpperCase())), [value]);
  const filteredSets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return sets;
    }

    return sets.filter((set) => {
      const code = set.code.toLowerCase();
      const name = set.name.toLowerCase();
      return code.includes(normalizedQuery) || name.includes(normalizedQuery);
    });
  }, [sets, query]);

  const upsertCode = (code: string) => {
    const normalizedCode = code.toUpperCase();
    if (!multiple) {
      onChange([normalizedCode]);
      setOpen(false);
      return;
    }

    if (normalizedValue.has(normalizedCode)) {
      return;
    }

    onChange([...value, normalizedCode]);
  };

  const removeCode = (code: string) => {
    onChange(value.filter((item) => item.toUpperCase() !== code.toUpperCase()));
  };

  if (error) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{label}</label>
        <p className="text-xs text-destructive">{error}</p>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={manualValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setManualValue(nextValue);
            const parsed = nextValue
              .split(',')
              .map((entry) => entry.trim().toUpperCase())
              .filter(Boolean);
            onChange(multiple ? Array.from(new Set(parsed)) : parsed.slice(0, 1));
          }}
          placeholder={multiple ? 'Enter comma-separated set codes' : 'Enter one set code'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="rounded-md border border-border bg-background p-2">
        <div className="flex flex-wrap gap-2">
          {value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground"
            >
              {code}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removeCode(code)}
                aria-label={`Remove ${code}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          className="mt-2 w-full border-0 bg-transparent px-1 py-1 text-sm outline-none"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
      </div>

      {open ? (
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1">
          {isLoading ? <p className="px-2 py-2 text-xs text-muted-foreground">Loading set list...</p> : null}
          {!isLoading && filteredSets.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No sets match your search.</p>
          ) : null}
          {!isLoading
            ? filteredSets.map((set) => (
                <button
                  key={set.code}
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => upsertCode(set.code)}
                >
                  {set.icon_svg_uri ? (
                    <img
                      src={set.icon_svg_uri}
                      alt=""
                      className="h-4 w-4 shrink-0 dark:invert"
                    />
                  ) : (
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[10px] text-muted-foreground">
                      •
                    </span>
                  )}
                  <span>
                    {set.name} ({set.code.toUpperCase()})
                  </span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
