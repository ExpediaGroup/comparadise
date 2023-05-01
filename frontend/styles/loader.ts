import { styled } from '@mui/material/styles';
import { Grid } from '@mui/material';

const PREFIX = 'Loader';

export const LoaderClasses = {
  grid: `${PREFIX}-grid`,
  primaryLoading: `${PREFIX}-primaryLoading`,
  secondaryLoading: `${PREFIX}-secondaryLoading`
};

export const StyledGrid = styled(Grid)(() => ({
  [`&.${LoaderClasses.grid}`]: {
    minWidth: '100%',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },

  [`& .${LoaderClasses.primaryLoading}`]: {
    maxWidth: '25%',
    minHeight: '25vh',
    display: 'flex',
    alignItems: 'center',
    color: '#FFDB2D'
  },

  [`& .${LoaderClasses.secondaryLoading}`]: {
    alignItems: 'center',
    color: '#3f51b5'
  }
}));
