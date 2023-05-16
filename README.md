# comparadise <img height=40 src="https://www.svgrepo.com/show/300635/island.svg">

## A visual comparison tool for reviewing visual changes on frontend PRs.

## Requirements

In order to use Comparadise, you must have visual regression tests set up in your project. These tests _must_ use the
following image naming conventions:

- `base.png`: The base image
- `diff.png`: The image diff
- `new.png`: The new image resulting from the test run

## GitHub Action

**Note:** In order to use the companion GitHub Action, your visual tests must pass when a screenshot is taken,
no matter if there was a diff or not.

Usage:

```yaml
- name: Run Visual Tests
  uses: actions/comparadise@v1
  with:
    visual-test-command: npm run visual-tests
    bucket-name: visual-regression-bucket
    commit-hash: ${{ github.event.pull_request.head.sha }}
```

This action will do the following:

- Downloads base images from your S3 bucket
- Runs your visual tests
- Checks for "diff" and "new" base images
- Conditionally uploads "diff" and "new" images to your S3 bucket
- Conditionally leaves a PR comment with a Comparadise link
- Sets the appropriate Visual Regression commit status on the PR

Therefore, your visual test workflow must check out your repo, install dependencies, and obtain AWS credentials prior to running the Comparadise action.
