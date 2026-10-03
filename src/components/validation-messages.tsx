'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/lib/constants';
import {
  errorMessages,
  validationMessages,
  type ErrorMessages,
  type ValidationMessages,
} from '@/lib/validation/messages';

/**
 * Makes the current locale's messages reachable from any component.
 *
 * Two namespaces travel the same way, for the same reason. A validation schema is
 * shared by the client form and the Server Action and is parsed twice, so it
 * cannot resolve text itself; a Server Action runs outside any request-time
 * locale, so the message it returns cannot be a sentence either. In both cases
 * what reaches the DOM is a key - `validation.*` or `errors.*` - and the single
 * `Field` or `Alert` that renders it turns it into text, where the locale is
 * known.
 *
 * A context is used rather than a prop because `Field` is called from about forty
 * places across the forms, and threading a messages bag through each of them
 * would be a change with no upside.
 *
 * `null` means "no provider": the components then render the message untouched,
 * which is what keeps them usable in isolation (and in tests).
 */
const MessagesContext = createContext<{ validation: ValidationMessages; errors: ErrorMessages } | null>(null);

export function ValidationMessagesProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <MessagesContext.Provider value={{ validation: validationMessages(locale), errors: errorMessages(locale) }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useValidationMessages(): ValidationMessages | null {
  return useContext(MessagesContext)?.validation ?? null;
}

export function useErrorMessages(): ErrorMessages | null {
  return useContext(MessagesContext)?.errors ?? null;
}