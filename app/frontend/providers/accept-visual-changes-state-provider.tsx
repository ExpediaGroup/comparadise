import * as React from 'react';
import { createContext, useState } from 'react';

export const AcceptVisualChangesTexts = {
  NOT_ACCEPTED: 'Accept visual changes',
  ACCEPTING: 'Accepting...',
  ACCEPTED: 'Visual changes accepted!',
  ERROR: 'Visual changes could not be accepted'
} as const;
export type AcceptVisualChangesText =
  (typeof AcceptVisualChangesTexts)[keyof typeof AcceptVisualChangesTexts];

export type AcceptVisualChangesStateProvider = {
  acceptVisualChangesState?: AcceptVisualChangesText;
  setAcceptVisualChangesState?: (text: AcceptVisualChangesText) => void;
};

export const AcceptVisualChangesStateContext =
  createContext<AcceptVisualChangesStateProvider>({});

export const AcceptVisualChangesStateProvider = ({
  children
}: React.PropsWithChildren) => {
  const [acceptVisualChangesState, setAcceptVisualChangesState] =
    useState<AcceptVisualChangesText>(AcceptVisualChangesTexts.NOT_ACCEPTED);

  return (
    <AcceptVisualChangesStateContext.Provider
      value={{
        acceptVisualChangesState: acceptVisualChangesState,
        setAcceptVisualChangesState: setAcceptVisualChangesState
      }}
    >
      {children}
    </AcceptVisualChangesStateContext.Provider>
  );
};
