---
sidebar_position: 4
---

# Setting Up CI/CD

Comparadise ships a GitHub Action that execute all steps necessary to run and evaluate your visual tests!

This action will do the following:

- Downloads base images from your S3 bucket
- Runs your visual tests
- Checks for "diff" and "new" base images
- Conditionally uploads "diff" and "new" images to your S3 bucket
- Conditionally leaves a PR comment with a Comparadise link
- Sets the appropriate Visual Regression commit status on the PR

Therefore, your visual test workflow must check out your repo, install dependencies to run your visual tests, and obtain AWS credentials prior to running the Comparadise action.

## Example Usage

```yaml
- uses: actions/checkout@v3

- run: npm install

- name: Run Visual Tests
  uses: ExpediaGroup/comparadise@v1
  with:
    visual-test-command: npm run visual-tests
    bucket-name: visual-regression-bucket
    commit-hash: ${{ github.event.pull_request.head.sha }}
    comparadise-host: https://my-comparadise-url.com
```
