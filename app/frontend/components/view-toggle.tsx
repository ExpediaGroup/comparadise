import * as React from 'react';
import { PrimaryButton, SecondaryButton } from './buttons';

export const ImageViews = {
  SINGLE: 'SINGLE',
  SIDE_BY_SIDE: 'SIDE_BY_SIDE'
} as const;
export type ImageView = keyof typeof ImageViews;

const AvailableViews = {
  ...ImageViews,
  BOTH: 'BOTH'
} as const;

export type AvailableView =
  (typeof AvailableViews)[keyof typeof AvailableViews];

interface ViewToggleProps {
  selectedView?: ImageView;
  onSelectView: (view: ImageView) => void;
  availableView?: AvailableView;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  selectedView,
  onSelectView,
  availableView
}) => {
  const SideBySideButton =
    selectedView === ImageViews.SIDE_BY_SIDE ? PrimaryButton : SecondaryButton;
  const SingleButton =
    selectedView !== ImageViews.SIDE_BY_SIDE ? PrimaryButton : SecondaryButton;
  return (
    <>
      <SideBySideButton
        backgroundFilled
        className="rounded-e-none rounded-s-md"
        onClick={() => onSelectView(ImageViews.SIDE_BY_SIDE)}
        disabled={availableView === AvailableViews.SINGLE}
      >
        Side-by-side
      </SideBySideButton>
      <SingleButton
        backgroundFilled
        className="rounded-e-md rounded-s-none"
        onClick={() => {
          if (selectedView === ImageViews.SIDE_BY_SIDE) {
            onSelectView(ImageViews.SINGLE);
          }
        }}
      >
        Single
      </SingleButton>
    </>
  );
};
