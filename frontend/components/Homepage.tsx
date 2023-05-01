import { Box, Stack, Typography } from '@mui/material';
import * as React from 'react';
import Logo from '../resources/Logo.svg';

export const Homepage = () => {
  return (
    <Stack direction="row" spacing={2}>
      <img
        style={{
          height: '50vh',
          width: '75vh',
          marginTop: '15vh',
          marginLeft: '5vh'
        }}
        src={Logo}
        alt=""
      />
      <Box
        sx={{
          my: 8,
          mx: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Stack sx={{ mt: 30, ml: 5 }}>
          <Typography component="h1" variant="h5">
            Welcome to Comparadise
          </Typography>
          <Box component="form" sx={{ mt: 1 }}>
            <Typography component="h3" variant="h6">
              Please enter a valid url
            </Typography>
            <Typography>
              For example
              <br />
              https://COMPARADISE_HOST/?hash=COMMIT_HASH&owner=GITHUB_ORG&repo=REPO_NAME&bucket=S3_BUCKET_NAME
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};
