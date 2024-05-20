import * as React from 'react';

type ButtonProps = {
  backgroundFilled?: boolean;
} & React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

const commonStyles = 'uppercase rounded-md px-4 py-2 font-medium';

const getButton = (props: ButtonProps, styles: string) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { className: extraStyles, backgroundFilled, ...rest } = props;

  return (
    <button className={`${commonStyles} ${styles} ${extraStyles}`} {...rest}>
      {props.children}
    </button>
  );
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
};

const primaryStylesMap = {
  default: 'border border-sky-600 text-sky-600 hover:bg-sky-100',
  disabled: 'border border-slate-400 text-slate-400',
  backgroundFilled: 'bg-green-600 text-white',
  backgroundFilledDisabled: 'bg-slate-300 text-white'
};
const secondaryStylesMap = {
  default: 'border border-slate-700 text-slate-700 hover:bg-slate-100',
  disabled: 'border border-slate-300 text-slate-300',
  backgroundFilled: 'bg-slate-300 text-black',
  backgroundFilledDisabled: 'bg-slate-300 text-white'
};
const tertiaryStylesMap = {
  default: 'border border-amber-500 text-amber-500 hover:bg-amber-100',
  disabled: 'border border-slate-400 text-slate-400',
  backgroundFilled: 'bg-amber-500 text-white',
  backgroundFilledDisabled: 'bg-slate-300 text-white'
};

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
