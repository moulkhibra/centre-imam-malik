'use client';

import { useRef, useState } from 'react';

/**
 * A filter form whose values are rendered by the server needs to know what the
 * user asked for before the render that confirms it has arrived.
 *
 * The defect this fixes: `applyFilter` used to build its URL from the filter
 * values it received as props. Those props are the *previous* server render, so
 * two changes made before the first navigation landed were composed against a
 * stale snapshot - clearing a dropdown and immediately picking another one put
 * the cleared filter back, giving `?status=SUSPENDED&gender=F` after the user
 * had chosen "no status" and "girl". It was not a timing artefact of the test:
 * it is what the toolbar did whenever the two changes landed close together,
 * which is exactly what happens when someone changes their mind twice.
 *
 * The rule: keep the edits the server has not adopted yet, and drop them as soon
 * as the URL moves for any other reason.
 */

/** Order-insensitive key for a set of values, so key order cannot fake a change. */
export const valuesKey = (values: Record<string, string>) =>
  JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Drops the pending edits that are no longer pending.
 *
 * `confirmed` tells the two cases apart, and they need opposite behaviour:
 *
 *  - The render that just arrived is the one this form asked for, so every edit
 *    it carries is adopted. Edits made *after* the navigation was requested are
 *    still missing from it and must be kept.
 *  - The URL moved without this form asking - the reset link, another link, the
 *    back button - so the server is authoritative again and nothing is pending.
 *
 * Pure on purpose: this is the part with the sharp edges, and it is unit-tested
 * as a table rather than through a browser.
 */
export function reconcilePending<T extends Record<string, string>>(
  pending: Partial<T>,
  serverValues: T,
  confirmed: boolean,
): Partial<T> {
  if (!confirmed) return {};

  const kept: Partial<T> = {};
  for (const [name, value] of Object.entries(pending) as Array<[keyof T & string, T[keyof T & string]]>) {
    if (serverValues[name] !== value) kept[name] = value;
  }
  return kept;
}

/**
 * Filter values for a server-rendered list, safe to change several times in a row.
 *
 * `values` is what the controls and the next URL must use; `change` records one
 * edit and returns the whole set to navigate to, so the caller never has to
 * recompute it from props.
 */
export function usePendingFilters<T extends Record<string, string>>(serverValues: T) {
  const [pending, setPending] = useState<Partial<T>>({});
  const [seenKey, setSeenKey] = useState(() => valuesKey(serverValues));
  /** The set the last navigation asked for, to recognise our own render. */
  const askedFor = useRef<string | null>(null);

  const serverKey = valuesKey(serverValues);

  // Reconciled during render rather than in an effect: a navigation landing
  // between two edits has to stop overriding the controls straight away.
  if (serverKey !== seenKey) {
    setSeenKey(serverKey);
    setPending((current) => reconcilePending(current, serverValues, serverKey === askedFor.current));
  }

  const values = { ...serverValues, ...pending } as T;

  return {
    values,
    /**
     * Records `name = value` and returns the full set the caller should navigate
     * to. The caller normalises its own "no filter" value (the list uses
     * `'ALL'`, the tabs page uses `''`).
     */
    change: (name: keyof T & string, value: string): T => {
      const next = { ...values, [name]: value };
      setPending((current) => ({ ...current, [name]: value }));
      askedFor.current = valuesKey(next);
      return next;
    },
  };
}