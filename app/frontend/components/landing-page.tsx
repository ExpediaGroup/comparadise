import * as React from 'react';
import Island from '../resources/island.svg';

export const LandingPage = () => {
  return (
    <div className="m-10 flex flex-col items-center">
      <img src={Island} alt="Comparadise" height={700} width={700} />
      <div className="m-10">
        <h1 className="text-4xl">Welcome to Comparadise</h1>
        <p className="text-xl">
          Please enter a valid url. For example:
          <br />
          https://COMPARADISE_HOST/?hash=COMMIT_HASH&owner=GITHUB_ORG&repo=REPO_NAME&bucket=S3_BUCKET_NAME
        </p>
      </div>
    </div>
  );
};
