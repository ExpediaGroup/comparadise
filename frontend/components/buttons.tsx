import * as React from 'react';

type ButtonProps = {
  backgroundFilled?: boolean;
} & React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;

export const PrimaryButton = (props: ButtonProps) => {
  let styles: string;
  if (props.backgroundFilled && props.disabled) {
    styles = 'bg-slate-400 text-white';
  } else if (props.backgroundFilled) {
    styles = 'bg-blue-700 text-white';
  } else if (props.disabled) {
    styles = 'border border-slate-400 text-slate-400';
  } else {
    styles = 'border border-blue-700 text-blue-700 hover:bg-blue-100';
  }

  const { className: extraStyles, ...rest } = props;

  return (
    <button className={`uppercase rounded-md px-4 py-2 font-medium ${styles} ${extraStyles}`} {...rest}>
      {props.children}
    </button>
  );
};

export const SecondaryButton = (props: ButtonProps) => {
  let styles: string;
  if (props.backgroundFilled && props.disabled) {
    styles = 'bg-slate-200 text-slate-400';
  } else if (props.backgroundFilled) {
    styles = 'bg-slate-400 text-black';
  } else if (props.disabled) {
    styles = 'border border-slate-100 text-slate-100';
  } else {
    styles = 'border border-slate-700 text-slate-700 hover:bg-slate-100';
  }

  const { className: extraStyles, ...rest } = props;

  return (
    <button className={`uppercase rounded-md px-4 py-2 font-medium ${styles} ${extraStyles}`} {...rest}>
      {props.children}
    </button>
  );
};

export const TertiaryButton = (props: ButtonProps) => {
  let styles: string;
  if (props.backgroundFilled && props.disabled) {
    styles = 'bg-slate-300 text-white';
  } else if (props.backgroundFilled) {
    styles = 'bg-purple-800 text-white';
  } else if (props.disabled) {
    styles = 'border border-slate-400 text-slate-400';
  } else {
    styles = 'border border-purple-800 text-purple-800 hover:bg-purple-100';
  }
  const { className: extraStyles, ...rest } = props;

  return (
    <button className={`uppercase rounded-md px-4 py-2 font-medium ${styles} ${extraStyles}`} {...rest}>
      {props.children}
    </button>
  );
};
