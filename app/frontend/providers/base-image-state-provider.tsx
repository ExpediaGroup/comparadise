import * as React from 'react';
import { createContext, useState } from 'react';

export enum UpdateBaseImagesText {
  NOT_UPDATED = 'Update all base images',
  UPDATING = 'Updating...',
  UPDATED = 'All images updated!',
  ERROR = 'Base image update failed',
}

export type BaseImageStateProvider = {
  baseImageState?: UpdateBaseImagesText;
  setBaseImageState?: (text: UpdateBaseImagesText) => void;
};

export const BaseImageStateContext = createContext<BaseImageStateProvider>({});

export const BaseImageStateProvider = ({
  children,
}: React.PropsWithChildren) => {
  const [baseImageState, setBaseImageState] = useState(
    UpdateBaseImagesText.NOT_UPDATED
  );

  return (
    <BaseImageStateContext.Provider
      value={{ baseImageState, setBaseImageState }}
    >
      {children}
    </BaseImageStateContext.Provider>
  );
};
