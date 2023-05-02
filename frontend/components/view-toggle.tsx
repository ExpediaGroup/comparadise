import * as React from 'react';

export enum ViewType {
  SINGLE,
  SIDE_BY_SIDE
}

interface ViewToggleProps {
  selectedView?: ViewType;
  onSelectView: (view: ViewType) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ selectedView, onSelectView }) => {
  return (
    <div style={{ marginTop: '20px' }}>
      <button
        color={selectedView === ViewType.SIDE_BY_SIDE ? 'primary' : 'inherit'}
        onClick={() => onSelectView(ViewType.SIDE_BY_SIDE)}
        disabled={selectedView === undefined}
      >
        Side-by-side
      </button>
      <button
        color={selectedView === undefined || selectedView === ViewType.SINGLE ? 'primary' : 'inherit'}
        onClick={() => {
          if (selectedView === ViewType.SIDE_BY_SIDE) {
            onSelectView(ViewType.SINGLE);
          }
        }}
      >
        Single
      </button>
    </div>
  );
};
