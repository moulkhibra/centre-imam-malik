import { describe, expect, it } from 'vitest';
import { reconcilePending, valuesKey } from '@/components/list/use-pending-filters';

/**
 * The filter toolbar used to build its URL from the filter values it received as
 * props, which are the *previous* server render. Clearing a dropdown and
 * immediately picking another one therefore composed the next URL from the value
 * the first change was replacing, and put the cleared filter back:
 * `?status=SUSPENDED&gender=F` after "no status" then "girl".
 *
 * `reconcilePending` is the part with the sharp edges, so it is tested as a table
 * instead of only through a browser. `confirmed` is the question "did the render
 * that just arrived come from this form?", and the two answers need opposite
 * behaviour.
 */
describe('reconcilePending', () => {
  const server = { status: 'ALL', gender: 'ALL', level: 'ALL' };

  it('drops everything when the URL moved without this form asking', () => {
    // The reset link, another link, or the back button. Whatever the toolbar was
    // still holding is not what the user is looking at any more.
    expect(reconcilePending({ status: 'SUSPENDED' }, server, false)).toEqual({});
    expect(reconcilePending({ status: 'SUSPENDED', gender: 'F' }, server, false)).toEqual({});
  });

  it('drops nothing while the server still disagrees', () => {
    // The render that arrived is ours, but it does not carry the newer edit, so
    // the newer edit is still pending. This is the case that lost the change.
    expect(reconcilePending({ gender: 'F' }, { ...server, status: 'SUSPENDED' }, true)).toEqual({
      gender: 'F',
    });
  });

  it('drops the edits the arriving render adopted', () => {
    expect(
      reconcilePending({ status: 'SUSPENDED', gender: 'F' }, { ...server, status: 'SUSPENDED', gender: 'F' }, true),
    ).toEqual({});
  });

  it('keeps only the unconfirmed half of a burst', () => {
    // Three changes made in a row: the render that lands carries the first two.
    expect(
      reconcilePending(
        { status: 'SUSPENDED', gender: 'F', level: '3A' },
        { ...server, status: 'SUSPENDED', gender: 'F' },
        true,
      ),
    ).toEqual({ level: '3A' });
  });

  it('treats an explicit empty value as a real change', () => {
    // `''` is how the tabs page spells "no filter", and clearing a dropdown sets
    // it. Treating it as "absent" would either drop the clear or keep the
    // overlay alive for ever, so it has to compare like any other value: still
    // pending against a server that says `true`, then adopted once the server
    // says `''`.
    expect(reconcilePending({ active: '' }, { ...server, active: 'true' }, true)).toEqual({ active: '' });
    expect(reconcilePending({ active: '' }, { active: '', status: 'ALL' }, true)).toEqual({});
  });

  it('is idempotent, so a re-render cannot lose an edit', () => {
    const once = reconcilePending({ status: 'SUSPENDED' }, { ...server, status: 'SUSPENDED', level: 'ALL' }, true);
    expect(once).toEqual({});
    const twice = reconcilePending({ level: '3A' }, { ...server, status: 'SUSPENDED' }, true);
    expect(reconcilePending(twice, { ...server, status: 'SUSPENDED' }, true)).toEqual(twice);
  });

  it('starts with nothing pending', () => {
    expect(reconcilePending({}, server, true)).toEqual({});
    expect(reconcilePending({}, server, false)).toEqual({});
  });
});

describe('valuesKey', () => {
  it('is order-insensitive, so key order cannot fake a change', () => {
    // `pending` is built by spreading, the server values by mapping over the
    // filter list; the two can disagree on order without disagreeing on state.
    expect(valuesKey({ a: '1', b: '2' })).toBe(valuesKey({ b: '2', a: '1' }));
    expect(valuesKey({ a: '1', b: '2' })).not.toBe(valuesKey({ a: '1', b: '3' }));
  });

  it('separates the empty string from an absent key', () => {
    expect(valuesKey({ a: '' })).not.toBe(valuesKey({}));
    expect(valuesKey({ a: '' })).not.toBe(valuesKey({ a: 'ALL' }));
  });
});