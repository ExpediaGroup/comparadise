import * as React from 'react';
import { PrimaryButton, SecondaryButton } from './buttons';

export const ImageViews = {
  SINGLE: 'SINGLE',
  SIDE_BY_SIDE: 'SIDE_BY_SIDE'
} as const;
export type ImageView = keyof typeof ImageViews;

interface ViewToggleProps {
  selectedView?: ImageView;
  onSelectView: (view: ImageView) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  selectedView,
  onSelectView
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
        disabled={
          selectedView === ImageViews.SINGLE || selectedView === undefined
        }
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
