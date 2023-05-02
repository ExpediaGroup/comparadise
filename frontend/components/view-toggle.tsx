import * as React from 'react';
import { PrimaryButton, SecondaryButton } from './buttons';

export enum ViewType {
  SINGLE,
  SIDE_BY_SIDE
}

interface ViewToggleProps {
  selectedView?: ViewType;
  onSelectView: (view: ViewType) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ selectedView, onSelectView }) => {
  const SideBySideButton = selectedView === ViewType.SIDE_BY_SIDE ? PrimaryButton : SecondaryButton;
  const SingleButton = selectedView !== ViewType.SIDE_BY_SIDE ? PrimaryButton : SecondaryButton;
  return (
    <>
      <SideBySideButton
        backgroundFilled
        className="rounded-s-md rounded-e-none"
        onClick={() => onSelectView(ViewType.SIDE_BY_SIDE)}
        disabled={selectedView === undefined}
      >
        Side-by-side
      </SideBySideButton>
      <SingleButton
        backgroundFilled
        className="rounded-s-none rounded-e-md"
        onClick={() => {
          if (selectedView === ViewType.SIDE_BY_SIDE) {
            onSelectView(ViewType.SINGLE);
          }
        }}
      >
        Single
      </SingleButton>
    </>
  );
};
