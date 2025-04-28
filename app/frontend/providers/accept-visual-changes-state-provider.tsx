import * as React from 'react';
import { createContext, useState } from 'react';

export const AcceptVisualChangesTexts = {
  NOT_UPDATED: 'Accept visual changes',
  UPDATING: 'Updating...',
  ACCEPTED: 'Visual changes accepted!',
  ERROR: 'Base image update failed'
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
  const [baseImageState, setBaseImageState] = useState<AcceptVisualChangesText>(
    AcceptVisualChangesTexts.NOT_UPDATED
  );

  return (
    <AcceptVisualChangesStateContext.Provider
      value={{
        acceptVisualChangesState: baseImageState,
        setAcceptVisualChangesState: setBaseImageState
      }}
    >
      {children}
    </AcceptVisualChangesStateContext.Provider>
  );
};
