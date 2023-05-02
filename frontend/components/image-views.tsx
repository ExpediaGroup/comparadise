import * as React from 'react';
import { RouterOutput } from '../utils/trpc';

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
    <div className="flex justify-center mt-5 mb-12">
      <div className="fixed bottom-20">
        {responseEntries.map((entry, index) => {
          const onClick = () => onSelectImage(index);
          const buttonColor = selectedImageIndex === index ? 'bg-blue-500' : 'bg-slate-300';
          return (
            <button key={entry.name} onClick={onClick} className={`${buttonColor}`}>
              {entry.name}
            </button>
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
