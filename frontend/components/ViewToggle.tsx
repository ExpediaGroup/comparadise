import * as React from 'react';
import { Button, ButtonGroup } from '@mui/material';

export enum ViewType {
  SINGLE,
  SIDE_BY_SIDE
}

interface ViewToggleProps {
  selectedView?: ViewType;
  onSelectView: (view: ViewType) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ selectedView, onSelectView }) => {
  return (
    <ButtonGroup variant="contained" style={{ marginTop: '20px' }}>
      <Button
        color={selectedView === ViewType.SIDE_BY_SIDE ? 'primary' : 'inherit'}
        onClick={() => onSelectView(ViewType.SIDE_BY_SIDE)}
        disabled={selectedView === undefined}
      >
        Side-by-side
      </Button>
      <Button
        color={selectedView === undefined || selectedView === ViewType.SINGLE ? 'primary' : 'inherit'}
        onClick={() => {
          if (selectedView === ViewType.SIDE_BY_SIDE) {
            onSelectView(ViewType.SINGLE);
          }
        }}
      >
        Single
      </Button>
    </ButtonGroup>
  );
};

export default ViewToggle;
