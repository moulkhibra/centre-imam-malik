'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/lib/constants';
import { validationMessages, type ValidationMessages } from '@/lib/validation/messages';

/**
 * Makes the current locale's validation messages reachable from any component.
 *
 * The validation schemas are shared by the client form and the Server Action and
 * are parsed twice, so they cannot resolve text themselves; the message reaches
 * the DOM as a `validation.*` key and is turned into a sentence by the single
 * `Field` that renders it. A context is used rather than a prop because `Field`
 * is called from about forty places across the forms, and threading a messages
 * bag through each of them would be a change with no upside.
 *
 * `null` means "no provider" - `Field` then renders the message untouched, which
 * is what keeps this component usable in isolation (and in tests).
 */
const ValidationMessagesContext = createContext<ValidationMessages | null>(null);

export function ValidationMessagesProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <ValidationMessagesContext.Provider value={validationMessages(locale)}>
      {children}
    </ValidationMessagesContext.Provider>
  );
}

export function useValidationMessages(): ValidationMessages | null {
  return useContext(ValidationMessagesContext);
}