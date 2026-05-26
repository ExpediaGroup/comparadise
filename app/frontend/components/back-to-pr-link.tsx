import * as React from 'react';
import { trpc } from '../utils/trpc';

export const BackToPrLink: React.FC<{
  commitHash?: string;
  owner?: string;
  repo?: string;
}> = ({ commitHash, owner, repo }) => {
  const { data } = trpc.getPullRequestUrl.useQuery(
    { commitHash: commitHash ?? '', owner: owner ?? '', repo: repo ?? '' },
    { enabled: Boolean(commitHash && owner && repo) }
  );
  const pullRequestUrl = data?.url;

  if (!pullRequestUrl) return null;

  return (
    <div className="fixed top-4 left-4 z-50">
      <a
        href={pullRequestUrl}
        className="inline-flex items-center rounded-md bg-white/90 px-3 py-1.5 font-medium text-sky-600 shadow-sm backdrop-blur hover:text-sky-800"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="mr-1 h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Back to PR
      </a>
    </div>
  );
};
