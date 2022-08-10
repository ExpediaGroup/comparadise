import * as React from 'react';
import { Button, ButtonGroup } from '@mui/material';
import { InferQueryOutput } from '../utils/trpc';

interface ImageViewChildProps {
  responseEntries: InferQueryOutput<'getGroupedImages'>[number]['entries'];
}

interface SingleImageViewProps extends ImageViewChildProps {
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
}

export const SingleImageView: React.FC<SingleImageViewProps> = ({ responseEntries, selectedImageIndex, onSelectImage }) => {
  if (!responseEntries) {
    return null;
  }

  return (
    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
      <ButtonGroup style={{ margin: '10px 0px', position: 'fixed', bottom: '20px' }} variant="contained">
        {responseEntries.map((entry, index) => {
          const onClick = () => onSelectImage(index);
          return (
            <Button key={entry.name} onClick={onClick} color={selectedImageIndex === index ? 'primary' : 'inherit'}>
              {entry.name}
            </Button>
          );
        })}
      </ButtonGroup>
      <img
        style={{ marginBottom: '100px' }}
        src={responseEntries[selectedImageIndex].image}
        alt={responseEntries[selectedImageIndex].name}
      />
    </div>
  );
};

export const SideBySideImageView: React.FC<ImageViewChildProps> = ({ responseEntries }) => {
  if (!responseEntries) {
    return null;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {responseEntries.map(entry => (
        <div key={entry.name}>
          <h2 style={{ textAlign: 'center' }}>{entry.name}</h2>
          <img src={entry.image} alt={entry.name} />
        </div>
      ))}
    </div>
  );
};
