"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/run.ts
var import_core6 = require("@actions/core");

// src/s3-operations.ts
var import_exec = require("@actions/exec");
var import_core = require("@actions/core");
var import_shared = require("shared");
var import_bluebird = require("bluebird");
var path = __toESM(require("path"));
var downloadBaseImages = async () => {
  const bucketName = (0, import_core.getInput)("bucket-name", { required: true });
  const screenshotsDirectory = (0, import_core.getInput)("screenshots-directory");
  const packagePaths = (0, import_core.getInput)("package-paths")?.split(",");
  if (packagePaths) {
    return Promise.all(
      packagePaths.map(
        (packagePath) => (0, import_exec.exec)(
          `aws s3 cp s3://${bucketName}/${import_shared.BASE_IMAGES_DIRECTORY}/${packagePath} ${screenshotsDirectory}/${packagePath} --recursive`
        )
      )
    );
  }
  return (0, import_exec.exec)(
    `aws s3 cp s3://${bucketName}/${import_shared.BASE_IMAGES_DIRECTORY} ${screenshotsDirectory} --recursive`
  );
};
var uploadAllImages = async () => {
  const bucketName = (0, import_core.getInput)("bucket-name", { required: true });
  const screenshotsDirectory = (0, import_core.getInput)("screenshots-directory");
  const commitHash = (0, import_core.getInput)("commit-hash", { required: true });
  const packagePaths = (0, import_core.getInput)("package-paths")?.split(",");
  if (packagePaths) {
    return (0, import_bluebird.map)(
      packagePaths,
      (packagePath) => (0, import_exec.exec)(
        `aws s3 cp ${screenshotsDirectory}/${packagePath} s3://${bucketName}/${commitHash}/${packagePath} --recursive`
      )
    );
  }
  return (0, import_exec.exec)(
    `aws s3 cp ${screenshotsDirectory} s3://${bucketName}/${commitHash} --recursive`
  );
};
var uploadBaseImages = async (newFilePaths) => {
  const bucketName = (0, import_core.getInput)("bucket-name", { required: true });
  return (0, import_bluebird.map)(
    newFilePaths,
    (newFilePath) => (0, import_exec.exec)(
      `aws s3 cp ${newFilePath} s3://${bucketName}/${buildBaseImagePath(newFilePath)}`
    )
  );
};
function buildBaseImagePath(newFilePath) {
  const screenshotsDirectory = (0, import_core.getInput)("screenshots-directory");
  return path.join(
    import_shared.BASE_IMAGES_DIRECTORY,
    newFilePath.replace(screenshotsDirectory, "").replace(`${import_shared.NEW_IMAGE_NAME}.png`, `${import_shared.BASE_IMAGE_NAME}.png`)
  );
}

// src/run.ts
var import_exec2 = require("@actions/exec");

// src/octokit.ts
var import_github = require("@actions/github");
var import_core2 = require("@actions/core");
var octokit = (0, import_github.getOctokit)((0, import_core2.getInput)("github-token"));

// src/run.ts
var import_github6 = require("@actions/github");
var path2 = __toESM(require("path"));
var import_glob = require("glob");

// src/comment.ts
var import_github3 = require("@actions/github");
var import_core4 = require("@actions/core");

// src/build-comparadise-url.ts
var import_core3 = require("@actions/core");
var import_github2 = require("@actions/github");
var buildComparadiseUrl = () => {
  const bucketName = (0, import_core3.getInput)("bucket-name", { required: true });
  const commitHash = (0, import_core3.getInput)("commit-hash", { required: true });
  const comparadiseHost = (0, import_core3.getInput)("comparadise-host");
  const { owner, repo } = import_github2.context.repo;
  return `${comparadiseHost}/?hash=${commitHash}&owner=${owner}&repo=${repo}&bucket=${bucketName}`;
};

// src/comment.ts
var createGithubComment = async () => {
  const commitHash = (0, import_core4.getInput)("commit-hash", { required: true });
  const comparadiseHost = (0, import_core4.getInput)("comparadise-host");
  const comparadiseUrl = buildComparadiseUrl();
  const comparadiseLink = comparadiseHost ? `[Comparadise](${comparadiseUrl})` : "Comparadise";
  const comparadiseBaseComment = `**Visual tests failed!**
Check out the diffs on ${comparadiseLink}! :palm_tree:`;
  const comparadiseCommentDetails = (0, import_core4.getInput)("comment-details");
  const comparadiseComment = comparadiseCommentDetails ? `${comparadiseBaseComment}
${comparadiseCommentDetails}` : comparadiseBaseComment;
  const { data } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    commit_sha: commitHash,
    ...import_github3.context.repo
  });
  const prNumber = data.find(Boolean)?.number ?? import_github3.context.issue.number;
  const { data: comments } = await octokit.rest.issues.listComments({
    issue_number: prNumber,
    ...import_github3.context.repo
  });
  const githubActionsCommentBodies = comments.map((comment) => comment.body);
  const comparadiseCommentExists = githubActionsCommentBodies.some(
    (body) => body?.includes(comparadiseBaseComment)
  );
  if (!comparadiseCommentExists) {
    await octokit.rest.issues.createComment({
      body: comparadiseComment,
      issue_number: prNumber,
      ...import_github3.context.repo
    });
  }
};

// src/get-latest-visual-regression-status.ts
var import_github4 = require("@actions/github");
var import_shared2 = require("shared");
var getLatestVisualRegressionStatus = async (commitHash) => {
  const { data } = await octokit.rest.repos.listCommitStatusesForRef({
    ref: commitHash,
    ...import_github4.context.repo
  });
  return data.find((status) => status.context === import_shared2.VISUAL_REGRESSION_CONTEXT);
};

// src/run.ts
var import_shared3 = require("shared");

// src/disableAutoMerge.ts
var import_core5 = require("@actions/core");
var import_github5 = require("@actions/github");
var disableAutoMerge = async (commitHash) => {
  try {
    const { data } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      commit_sha: commitHash,
      ...import_github5.context.repo
    });
    const pullRequest = data.find(Boolean);
    if (!pullRequest) {
      (0, import_core5.warning)(
        "Auto merge could not be disabled - could not find pull request from commit hash."
      );
      return;
    }
    return await octokit.graphql(`
    mutation {
      disablePullRequestAutoMerge(input: { pullRequestId: "${pullRequest.node_id}"}) {
        clientMutationId
      }
    }
  `);
  } catch (error) {
    (0, import_core5.warning)(
      "Auto merge could not be disabled, probably because it is disabled for this repo."
    );
    (0, import_core5.warning)(error);
  }
};

// src/run.ts
var run = async () => {
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  const isRetry = runAttempt > 1;
  const visualTestCommands = (0, import_core6.getMultilineInput)("visual-test-command", {
    required: true
  });
  const commitHash = (0, import_core6.getInput)("commit-hash", { required: true });
  const screenshotsDirectory = (0, import_core6.getInput)("screenshots-directory");
  await downloadBaseImages();
  const visualTestExitCode = await Promise.all(
    visualTestCommands.map((cmd) => (0, import_exec2.exec)(cmd, [], { ignoreReturnCode: true }))
  );
  const numVisualTestFailures = visualTestExitCode.filter(
    (code) => code !== 0
  ).length;
  const latestVisualRegressionStatus = await getLatestVisualRegressionStatus(commitHash);
  const screenshotsPath = path2.join(process.cwd(), screenshotsDirectory);
  const filesInScreenshotDirectory = (0, import_glob.sync)(`${screenshotsPath}/**`) || [];
  const diffFileCount = filesInScreenshotDirectory.filter(
    (file) => file.endsWith("diff.png")
  ).length;
  const newFilePaths = filesInScreenshotDirectory.filter(
    (file) => file.endsWith("new.png")
  );
  const newFileCount = newFilePaths.length;
  if (numVisualTestFailures > diffFileCount) {
    (0, import_core6.setFailed)(
      "Visual tests failed to execute successfully. Perhaps one failed to take a screenshot?"
    );
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: import_shared3.VISUAL_REGRESSION_CONTEXT,
      state: "failure",
      description: import_shared3.VISUAL_TESTS_FAILED_TO_EXECUTE,
      ...import_github6.context.repo
    });
  }
  if (diffFileCount === 0 && newFileCount === 0) {
    (0, import_core6.info)("All visual tests passed, and no diffs found!");
    if (isRetry) {
      (0, import_core6.warning)(
        "Disabling auto merge because this is a retry attempt. This is to avoid auto merging prematurely."
      );
      await disableAutoMerge(commitHash);
    } else if (latestVisualRegressionStatus?.state === "failure") {
      (0, import_core6.info)(
        "Skipping status update since Visual Regression status has already been set to failed."
      );
      return;
    }
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: import_shared3.VISUAL_REGRESSION_CONTEXT,
      state: "success",
      description: `Visual tests passed${isRetry ? " on retry" : ""}!`,
      ...import_github6.context.repo
    });
  }
  if (latestVisualRegressionStatus?.state === "failure" && latestVisualRegressionStatus?.description === import_shared3.VISUAL_TESTS_FAILED_TO_EXECUTE && !isRetry) {
    (0, import_core6.warning)(
      "Some other Visual Regression tests failed to execute successfully, so skipping status update and comment."
    );
    return;
  }
  (0, import_core6.info)(
    `${diffFileCount} visual differences found, and ${newFileCount} new images found.`
  );
  if (diffFileCount === 0 && newFileCount > 0) {
    (0, import_core6.info)(
      `New visual tests found! ${newFileCount} images will be uploaded as new base images.`
    );
    await uploadBaseImages(newFilePaths);
    return octokit.rest.repos.createCommitStatus({
      sha: commitHash,
      context: import_shared3.VISUAL_REGRESSION_CONTEXT,
      state: "success",
      description: "New base images were created!",
      ...import_github6.context.repo
    });
  }
  await uploadAllImages();
  await octokit.rest.repos.createCommitStatus({
    sha: commitHash,
    context: import_shared3.VISUAL_REGRESSION_CONTEXT,
    state: "failure",
    description: "A visual regression was detected. Check Comparadise!",
    target_url: buildComparadiseUrl(),
    ...import_github6.context.repo
  });
  await createGithubComment();
};

// src/main.ts
run();
//# sourceMappingURL=main.js.map