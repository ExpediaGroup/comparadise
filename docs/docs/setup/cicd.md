---
sidebar_position: 4
---

# Setting Up CI/CD

Comparadise ships a GitHub Action that executes all steps necessary to run and evaluate your visual tests!

This action will do the following:

- Downloads base images from your S3 bucket
- Runs your visual tests
- Checks for "diff" and "new" base images
- Conditionally uploads "diff" and "new" images to your S3 bucket
- Conditionally leaves a PR comment with a Comparadise link
- Sets the appropriate Visual Regression commit status on the PR

Therefore, your visual test workflow must check out your repo, install dependencies to run your visual tests, and obtain AWS credentials prior to running the Comparadise action.

Make sure to also set the `Visual Regression` status as required in a [branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule) rule for your repo.

**Note:** It is recommended to name your jobs something like "Take Screenshots" to avoid confusion with the required `Visual Regression` status that Comparadise sets.

## Example Usage

```yaml
on:
  pull_request:
    branches:
      - main

jobs:
  visual-tests:
    name: Take Screenshots
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
    
      - run: npm install
      
      # Some AWS authentication step here 
    
      - name: Take Screenshots
        uses: ExpediaGroup/comparadise@v1
        with:
          visual-test-command: npm run visual-tests
          bucket-name: visual-regression-bucket
          commit-hash: ${{ github.event.pull_request.head.sha }}
          comparadise-host: https://my-comparadise-url.com
```

## Example Usage With Matrix Jobs

```yaml
on:
  pull_request:
    branches:
      - main

jobs:
  visual-tests:
    name: Take Screenshots (${{ matrix.name }})
    strategy:
      fail-fast: false
      matrix:
        include:
          - name: Test 1
            spec: '**/test-1.cy.ts'
          - name: Test 2
            spec: '**/test-2.cy.ts'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
    
      - run: npm install
    
      # Some AWS authentication step here 
    
      - name: Run Visual Tests
        uses: ExpediaGroup/comparadise@v1
        with:
          visual-test-command: npm run visual-tests --spec="${{ matrix.spec }}"
          bucket-name: visual-regression-bucket
          commit-hash: ${{ github.event.pull_request.head.sha }}
          comparadise-host: https://my-comparadise-url.com
```
