import * as React from 'react';
import { RouterOutput } from '../utils/trpc';
import { PrimaryButton, SecondaryButton } from './buttons';

interface ImageViewChildProps {
  responseEntries: RouterOutput['getGroupedImages'][number]['entries'];
}

interface SingleImageViewProps extends ImageViewChildProps {
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
}

export const SingleImageView: React.FC<SingleImageViewProps> = ({ responseEntries, selectedImageIndex, onSelectImage }) => {
  if (!responseEntries) {
    return null;
  }

  if (!responseEntries[selectedImageIndex]) {
    onSelectImage(0);
    return null;
  }

  return (
    <div className="mb-12 mt-5 flex justify-center">
      <div className="fixed bottom-20">
        {responseEntries.map((entry, index) => {
          const onClick = () => onSelectImage(index);
          const Button = selectedImageIndex === index ? PrimaryButton : SecondaryButton;
          const extraStyles =
            index === 0
              ? 'rounded-s-md rounded-e-none'
              : index === responseEntries.length - 1
              ? 'rounded-s-none rounded-e-md'
              : 'rounded-none';
          return (
            <Button key={entry.name} onClick={onClick} backgroundFilled className={`border border-slate-700 ${extraStyles}`}>
              {entry.name}
            </Button>
          );
        })}
      </div>
      <img src={responseEntries[selectedImageIndex].image} alt={responseEntries[selectedImageIndex].name} />
    </div>
  );
};

export const SideBySideImageView: React.FC<ImageViewChildProps> = ({ responseEntries }) => {
  if (!responseEntries) {
    return null;
  }

  return (
    <div className="flex justify-center">
      {responseEntries.map(entry => (
        <div key={entry.name}>
          <h2 className="text-center">{entry.name}</h2>
          <img src={entry.image} alt={entry.name} />
        </div>
      ))}
    </div>
  );
};
