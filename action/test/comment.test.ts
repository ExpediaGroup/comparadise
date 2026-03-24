import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

const getInputMock = mock();
mock.module('@actions/core', () => ({
  info: mock(),
  getInput: getInputMock
}));

const githubContext = {
  repo: { repo: 'repo', owner: 'owner' },
  issue: { number: 0 }
};
mock.module('@actions/github', () => ({
  context: githubContext
}));

const buildComparadiseUrlMock = mock();
mock.module('../src/build-comparadise-url', () => ({
  buildComparadiseUrl: buildComparadiseUrlMock
}));

const listPullRequestsAssociatedWithCommitMock = mock<
  () => Promise<{ data: Array<{ number: number }> }>
>(() => Promise.resolve({ data: [{ number: 123 }] }));
const listCommentsMock =
  mock<() => Promise<{ data: Array<{ id: number; body: string | null }> }>>();
const createCommentMock = mock();
const updateCommentMock = mock();
mock.module('../src/octokit', () => ({
  octokit: {
    rest: {
      repos: {
        listPullRequestsAssociatedWithCommit:
          listPullRequestsAssociatedWithCommitMock
      },
      issues: {
        listComments: listCommentsMock,
        createComment: createCommentMock,
        updateComment: updateCommentMock
      }
    }
  }
}));

const HOST = 'https://comparadise.app';
const CURRENT_SHA = 'abc123';
const currentUrl = `${HOST}/?commitHash=${CURRENT_SHA}&owner=owner&repo=repo&bucket=some-bucket&useBaseImages=true`;

const inputMap: Record<string, string> = {
  'commit-hash': CURRENT_SHA,
  'comparadise-host': HOST,
  'package-paths': '',
  'comment-details': ''
};

async function runCreateGithubComment(pendingDescription = 'Review pending') {
  const { createGithubComment } = await import('../src/comment');
  await createGithubComment(pendingDescription);
}

describe('createGithubComment', () => {
  beforeEach(() => {
    getInputMock.mockImplementation((name: string) => inputMap[name] ?? '');
    buildComparadiseUrlMock.mockReturnValue(currentUrl);
    githubContext.issue.number = 0;
  });

  afterEach(() => {
    mock.clearAllMocks();
  });

  describe('comment creation and updating', () => {
    it('should create a new comment when no existing comment is found', async () => {
      listCommentsMock.mockResolvedValue({ data: [] });

      await runCreateGithubComment('Review pending');

      expect(createCommentMock).toHaveBeenCalledTimes(1);
      expect(updateCommentMock).not.toHaveBeenCalled();
    });

    it('should update an existing comment when the base comment text matches', async () => {
      const existingBody = `## Package paths: \n\n**Review pending**\n\nCheck [Comparadise](${currentUrl})! :palm_tree:`;
      listCommentsMock.mockResolvedValue({
        data: [{ id: 42, body: existingBody }]
      });

      await runCreateGithubComment('Review pending');

      expect(updateCommentMock).toHaveBeenCalledWith({
        comment_id: 42,
        body: existingBody,
        owner: 'owner',
        repo: 'repo'
      });
      expect(createCommentMock).not.toHaveBeenCalled();
    });

    it('should create rather than update when the description has changed', async () => {
      const existingBody = `## Package paths: \n\n**1 diff found**\n\nCheck [Comparadise](${currentUrl})! :palm_tree:`;
      listCommentsMock.mockResolvedValue({
        data: [{ id: 7, body: existingBody }]
      });

      await runCreateGithubComment('2 diffs found');

      expect(createCommentMock).toHaveBeenCalledTimes(1);
      expect(updateCommentMock).not.toHaveBeenCalled();
    });

    it('should skip all comment operations when no PR number is found', async () => {
      listPullRequestsAssociatedWithCommitMock.mockResolvedValueOnce({
        data: []
      });
      githubContext.issue.number = 0;

      await runCreateGithubComment();

      expect(listCommentsMock).not.toHaveBeenCalled();
      expect(createCommentMock).not.toHaveBeenCalled();
      expect(updateCommentMock).not.toHaveBeenCalled();
    });
  });
});
