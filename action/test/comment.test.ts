import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { PackageResult } from '../src/comment';

const getInputMock = mock();
mock.module('@actions/core', () => ({
  info: mock(),
  warning: mock(),
  setFailed: mock(),
  getBooleanInput: mock(),
  getMultilineInput: mock(),
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
  'comment-details': ''
};

const NO_PACKAGES: PackageResult[] = [
  { packagePath: '', diffCount: 2, newTestCount: 1 }
];
const WITH_PACKAGES: PackageResult[] = [
  { packagePath: 'packages/web', diffCount: 2, newTestCount: 1 },
  { packagePath: 'packages/mobile', diffCount: 0, newTestCount: 3 }
];

async function runCreateGithubComment(
  pendingDescription = 'Review pending',
  packageResults: PackageResult[] = NO_PACKAGES
) {
  const { createGithubComment } = await import('../src/comment');
  await createGithubComment(pendingDescription, packageResults);
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

      await runCreateGithubComment();

      expect(createCommentMock).toHaveBeenCalledTimes(1);
      expect(updateCommentMock).not.toHaveBeenCalled();
    });

    it('should append rows to existing comment when commit hash matches', async () => {
      const existingBody = [
        '<!-- comparadise -->',
        `<!-- comparadise-hash:${CURRENT_SHA} -->`,
        '## Visual Test Results',
        'Review pending',
        '',
        '| Visual Diffs | New Visual Tests |',
        '|-------------|-----------------|',
        '| 1 | 0 |',
        '<!-- comparadise-table-end -->',
        '',
        `Check [Comparadise](${currentUrl})! :palm_tree:`,
        '_Last updated: Mon, 01 Jan 2024 00:00:00 GMT_ <!-- comparadise-updated -->'
      ].join('\n');

      listCommentsMock.mockResolvedValue({
        data: [{ id: 42, body: existingBody }]
      });

      await runCreateGithubComment('Review pending', [
        { packagePath: '', diffCount: 2, newTestCount: 1 }
      ]);

      expect(updateCommentMock).toHaveBeenCalledTimes(1);
      expect(createCommentMock).not.toHaveBeenCalled();
      const updatedBody: string = updateCommentMock.mock.calls[0]![0].body;
      expect(updatedBody).toContain('| 1 | 0 |');
      expect(updatedBody).toContain('| 2 | 1 |');
      expect(updatedBody).toContain('<!-- comparadise-table-end -->');
      expect(updatedBody).toContain('<!-- comparadise-updated -->');
      expect(updatedBody).not.toContain('Mon, 01 Jan 2024 00:00:00 GMT');
    });

    it('should replace existing comment when commit hash differs', async () => {
      const existingBody = [
        '<!-- comparadise -->',
        '<!-- comparadise-hash:oldhash -->',
        '## Visual Test Results',
        'Old description',
        '',
        '| Visual Diffs | New Visual Tests |',
        '|-------------|-----------------|',
        '| 5 | 0 |',
        '<!-- comparadise-table-end -->',
        '',
        `Check [Comparadise](${currentUrl})! :palm_tree:`,
        '_Last updated: Mon, 01 Jan 2024 00:00:00 GMT_ <!-- comparadise-updated -->'
      ].join('\n');

      listCommentsMock.mockResolvedValue({
        data: [{ id: 99, body: existingBody }]
      });

      await runCreateGithubComment('New description');

      expect(updateCommentMock).toHaveBeenCalledTimes(1);
      expect(createCommentMock).not.toHaveBeenCalled();
      const updatedBody: string = updateCommentMock.mock.calls[0]![0].body;
      expect(updatedBody).toContain(`<!-- comparadise-hash:${CURRENT_SHA} -->`);
      expect(updatedBody).not.toContain('<!-- comparadise-hash:oldhash -->');
      expect(updatedBody).toContain('New description');
      expect(updatedBody).not.toContain('| 5 | 0 |');
      expect(updatedBody).toContain('<!-- comparadise-updated -->');
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

  describe('table format', () => {
    it('should render a 2-column table when no package paths are given', async () => {
      listCommentsMock.mockResolvedValue({ data: [] });

      await runCreateGithubComment('2 visual diffs found.', NO_PACKAGES);

      const body: string = createCommentMock.mock.calls[0]![0].body;
      expect(body).toContain('| Visual Diffs | New Visual Tests |');
      expect(body).not.toContain('| Package |');
      expect(body).toContain('| 2 | 1 |');
    });

    it('should render a 3-column table with one row per package', async () => {
      listCommentsMock.mockResolvedValue({ data: [] });

      await runCreateGithubComment('2 visual diffs found.', WITH_PACKAGES);

      const body: string = createCommentMock.mock.calls[0]![0].body;
      expect(body).toContain('| Package | Visual Diffs | New Visual Tests |');
      expect(body).toContain('| packages/web | 2 | 1 |');
      expect(body).toContain('| packages/mobile | 0 | 3 |');
    });

    it('should include pendingDescription as text after the heading', async () => {
      listCommentsMock.mockResolvedValue({ data: [] });

      await runCreateGithubComment('3 visual diffs found.');

      const body: string = createCommentMock.mock.calls[0]![0].body;
      expect(body).toContain('## Visual Test Results\n3 visual diffs found.');
    });

    it('should include the Comparadise link when a host is configured', async () => {
      listCommentsMock.mockResolvedValue({ data: [] });

      await runCreateGithubComment();

      const body: string = createCommentMock.mock.calls[0]![0].body;
      expect(body).toContain(`[Comparadise](${currentUrl})`);
    });

    it('should include a last updated timestamp', async () => {
      listCommentsMock.mockResolvedValue({ data: [] });

      await runCreateGithubComment();

      const body: string = createCommentMock.mock.calls[0]![0].body;
      expect(body).toContain('_Last updated:');
      expect(body).toContain('<!-- comparadise-updated -->');
    });

    it('should append comment-details when provided', async () => {
      getInputMock.mockImplementation((name: string) =>
        name === 'comment-details' ? 'Extra info' : (inputMap[name] ?? '')
      );
      listCommentsMock.mockResolvedValue({ data: [] });

      await runCreateGithubComment();

      const body: string = createCommentMock.mock.calls[0]![0].body;
      expect(body).toContain('Extra info');
    });
  });
});
