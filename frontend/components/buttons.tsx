import * as React from 'react';

type ButtonProps = {
  backgroundFilled?: boolean;
} & React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;

const commonStyles = 'uppercase rounded-md px-4 py-2 font-medium';

const primaryStylesMap = {
  default: 'border border-blue-700 text-blue-700 hover:bg-blue-100',
  disabled: 'border border-slate-400 text-slate-400',
  backgroundFilled: 'bg-blue-700 text-white',
  backgroundFilledDisabled: 'bg-slate-200 text-slate-400',
};
const secondaryStylesMap = {
  default: 'border border-slate-700 text-slate-700 hover:bg-slate-100',
  disabled: 'border border-slate-100 text-slate-100',
  backgroundFilled: 'bg-slate-400 text-black',
  backgroundFilledDisabled: 'bg-slate-400 text-white',
};
const tertiaryStylesMap = {
  default: 'border border-purple-800 text-purple-800 hover:bg-purple-100',
  disabled: 'border border-slate-400 text-slate-400',
  backgroundFilled: 'bg-purple-800 text-white',
  backgroundFilledDisabled: 'bg-slate-300 text-white',
};

const getStyles = (props: ButtonProps, stylesMap: typeof primaryStylesMap) => {
  if (props.backgroundFilled && props.disabled) {
    return stylesMap.backgroundFilledDisabled;
  } else if (props.backgroundFilled) {
    return stylesMap.backgroundFilled;
  } else if (props.disabled) {
    return stylesMap.disabled;
  } else {
    return stylesMap.default;
  }
}

const getButton = (props: ButtonProps, styles: string) => {
  const { className: extraStyles, ...rest } = props;

  return (
    <button className={`${commonStyles} ${styles} ${extraStyles}`} {...rest}>
      {props.children}
    </button>
  );
}

export const PrimaryButton = (props: ButtonProps) => {
  const styles = getStyles(props, primaryStylesMap);
  return getButton(props, styles);
};

export const SecondaryButton = (props: ButtonProps) => {
  const styles = getStyles(props, secondaryStylesMap);
  return getButton(props, styles);
};

export const TertiaryButton = (props: ButtonProps) => {
  const styles = getStyles(props, tertiaryStylesMap);
  return getButton(props, styles);
};
