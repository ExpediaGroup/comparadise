import * as React from 'react';

export const ArrowForwardIcon = ({ disabled }: { disabled?: boolean }) => {
  const fill = disabled ? 'fill-slate-400' : 'fill-blue-700';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`${fill} w-16 h-16`}>
      <path
        fillRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
        clipRule="evenodd"
      />
    </svg>
  );
};

export const ArrowBackIcon = ({ disabled }: { disabled?: boolean }) => {
  const fill = disabled ? 'fill-slate-300' : 'fill-blue-700';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`${fill} w-16 h-16`}>
      <path
        fillRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-4.28 9.22a.75.75 0 000 1.06l3 3a.75.75 0 101.06-1.06l-1.72-1.72h5.69a.75.75 0 000-1.5h-5.69l1.72-1.72a.75.75 0 00-1.06-1.06l-3 3z"
        clipRule="evenodd"
      />
    </svg>
  );
};
