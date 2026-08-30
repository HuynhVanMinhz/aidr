import { useEffect, useRef, useState } from 'react';
import { RawJsonEscapeHatch } from './TagsField';
import {
  DEFAULT_CLOSE,
  DEFAULT_OPEN,
  OPENING_HOURS_DAYS,
  emptyOpeningHoursWeek,
  parseOpeningHours,
  serializeOpeningHours,
  type OpeningHoursDayKey,
  type OpeningHoursWeek,
} from '../../utils/structuredJson';

type OpeningHoursFieldProps = {
  id?: string;
  /** The stored JSON object, e.g. `{"mon":"09:00-18:00"}`. Empty string means none. */
  value: string;
  onChange: (json: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
};

export function OpeningHoursField({
  id,
  value,
  onChange,
  onBlur,
  invalid = false,
}: OpeningHoursFieldProps) {
  const parsed = parseOpeningHours(value);
  const [week, setWeek] = useState<OpeningHoursWeek>(parsed.value);
  const [raw, setRaw] = useState(parsed.recognized ? null : value);
  const emitted = useRef(value);

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const next = parseOpeningHours(value);
    setWeek(next.value);
    setRaw(next.recognized ? null : value);
  }, [value]);

  function commit(next: OpeningHoursWeek) {
    setWeek(next);
    const json = serializeOpeningHours(next);
    emitted.current = json;
    onChange(json);
  }

  function patchDay(key: OpeningHoursDayKey, patch: Partial<OpeningHoursWeek[OpeningHoursDayKey]>) {
    commit({ ...week, [key]: { ...week[key], ...patch } });
  }

  /** Most shops keep one schedule; copying beats filling seven rows by hand. */
  function copyFirstOpenDayToAll() {
    const source = OPENING_HOURS_DAYS.map((d) => week[d.key]).find((d) => !d.closed);
    if (!source) return;
    commit(
      OPENING_HOURS_DAYS.reduce((next, day) => {
        next[day.key] = { ...source };
        return next;
      }, {} as OpeningHoursWeek),
    );
  }

  if (raw !== null) {
    return (
      <RawJsonEscapeHatch
        id={id}
        value={raw}
        hint="These opening hours do not fit the weekly grid — an unknown day key, or hours that are not a start–end range. Edit them as JSON, or clear them to use the grid."
        onChange={(next) => {
          setRaw(next);
          emitted.current = next;
          onChange(next);
        }}
        onReset={() => {
          setRaw(null);
          commit(emptyOpeningHoursWeek());
        }}
        onBlur={onBlur}
      />
    );
  }

  const anyOpen = OPENING_HOURS_DAYS.some((d) => !week[d.key].closed);

  return (
    <div id={id} className={`hours-field${invalid ? ' hours-field--invalid' : ''}`}>
      {OPENING_HOURS_DAYS.map((day) => {
        const entry = week[day.key];
        const invertedRange = !entry.closed && entry.open >= entry.close;
        return (
          <div className="hours-field__row" key={day.key}>
            <div className="form-check form-switch hours-field__toggle">
              <input
                id={`hours-${day.key}`}
                type="checkbox"
                className="form-check-input"
                checked={!entry.closed}
                onChange={(e) =>
                  patchDay(day.key, {
                    closed: !e.target.checked,
                    open: entry.open || DEFAULT_OPEN,
                    close: entry.close || DEFAULT_CLOSE,
                  })
                }
                onBlur={onBlur}
              />
              <label className="form-check-label" htmlFor={`hours-${day.key}`}>
                {day.label}
              </label>
            </div>

            {entry.closed ? (
              <span className="hours-field__closed">Closed</span>
            ) : (
              <div className="hours-field__times">
                <input
                  type="time"
                  className={`form-control${invertedRange ? ' is-invalid' : ''}`}
                  value={entry.open}
                  aria-label={`${day.label} opening time`}
                  onChange={(e) => patchDay(day.key, { open: e.target.value })}
                  onBlur={onBlur}
                />
                <span className="hours-field__dash">–</span>
                <input
                  type="time"
                  className={`form-control${invertedRange ? ' is-invalid' : ''}`}
                  value={entry.close}
                  aria-label={`${day.label} closing time`}
                  onChange={(e) => patchDay(day.key, { close: e.target.value })}
                  onBlur={onBlur}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="d-flex align-items-center gap-3 mt-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={!anyOpen}
          onClick={copyFirstOpenDayToAll}
        >
          Apply the first open day to every day
        </button>
        <span className="form-text mb-0">
          {anyOpen ? 'Buyers see this on your shop page.' : 'Leave every day off to hide opening hours.'}
        </span>
      </div>
    </div>
  );
}
