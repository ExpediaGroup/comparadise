import { styled } from '@mui/material/styles';

const PREFIX = 'MainPage';

export const Classes = {
  grid: `${PREFIX}-grid`,
  root: `${PREFIX}-root`,
  header: `${PREFIX}-header`
};

export const Root = styled('div')(() => ({
  [`& .${Classes.grid}`]: {
    minWidth: '100%',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },

  [`& .${Classes.root}`]: {
    height: '100vh',
    paddingBottom: 10
  },

  [`& .${Classes.header}`]: {
    gridArea: 'pageHeader',
    width: '100%',
    boxShadow: '0 0 8px 3px rgba(20, 20, 20, 0.3)',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: '#01009A',
    minHeight: '40px',
    paddingTop: 10,
    paddingBottom: 10
  }
}));
