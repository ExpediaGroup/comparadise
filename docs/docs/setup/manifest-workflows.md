---
sidebar_position: 5
---

# Manifest-Based Workflows

Manifest-based workflows are an alternative to the standard `pr`/`merge` setup that reduces S3 usage and CI time by only uploading screenshots that changed relative to the base branch.

Three workflow modes work together:

![Manifest workflow sequence diagram](/img/manifest-workflow.svg)

| Mode                | Trigger                  | What it does                                                                                     |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `manifest-generate` | PR push                  | Runs visual tests, hashes screenshots, uploads only changed images and a manifest to S3          |
| `manifest-compare`  | PR push (after generate) | 3-way hash comparison against base branch; generates diffs, sets commit status, posts PR comment |
| `manifest-merge`    | PR merged                | Overlays the PR's changeset onto the base manifest; updates base images in S3                    |

## PR Workflow

Both `manifest-generate` and `manifest-compare` run on every PR push. Generate must complete before compare runs, so the simplest setup is two sequential steps in one job.

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
      - uses: actions/checkout@v4

      - run: npm install

      # Some AWS authentication step here

      - name: Generate Manifest
        uses: ExpediaGroup/comparadise@v1
        with:
          workflow: manifest-generate
          visual-test-command: npm run visual-tests
          bucket-name: visual-regression-bucket
          commit-hash: ${{ github.event.pull_request.head.sha }}
          comparadise-host: https://my-comparadise-url.com

      - name: Compare Manifest
        uses: ExpediaGroup/comparadise@v1
        with:
          workflow: manifest-compare
          bucket-name: visual-regression-bucket
          commit-hash: ${{ github.event.pull_request.head.sha }}
          comparadise-host: https://my-comparadise-url.com
```

### Differential uploads

By default, `manifest-generate` uploads all screenshots on every push. To limit uploads to only images whose hash changed since the last base branch commit, pass `head-sha`:

```yaml
- name: Get HEAD SHA
  id: head
  run: |
    echo "sha=$(git ls-remote origin refs/heads/main | cut -f1)" >> "$GITHUB_OUTPUT"

- name: Generate Manifest
  uses: ExpediaGroup/comparadise@v1
  with:
    workflow: manifest-generate
    visual-test-command: npm run visual-tests
    bucket-name: visual-regression-bucket
    commit-hash: ${{ github.event.pull_request.head.sha }}
    head-sha: ${{ steps.head.outputs.sha }}
    comparadise-host: https://my-comparadise-url.com
```

### Matrix jobs

For monorepos running visual tests in parallel, run one `manifest-generate` job per package and a single `manifest-compare` job once all generate jobs complete:

```yaml
on:
  pull_request:
    branches:
      - main

jobs:
  generate:
    name: Generate Manifest (${{ matrix.package }})
    strategy:
      fail-fast: false
      matrix:
        include:
          - package: packages/ui
            spec: '**/packages/ui/**/*.cy.ts'
          - package: packages/core
            spec: '**/packages/core/**/*.cy.ts'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      # AWS authentication
      - name: Generate Manifest
        uses: ExpediaGroup/comparadise@v1
        with:
          workflow: manifest-generate
          visual-test-command: npm run visual-tests --spec="${{ matrix.spec }}"
          bucket-name: visual-regression-bucket
          commit-hash: ${{ github.event.pull_request.head.sha }}
          package-paths: ${{ matrix.package }}
          comparadise-host: https://my-comparadise-url.com

  compare:
    name: Compare Manifest
    needs: generate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # AWS authentication
      - name: Compare Manifest
        uses: ExpediaGroup/comparadise@v1
        with:
          workflow: manifest-compare
          bucket-name: visual-regression-bucket
          commit-hash: ${{ github.event.pull_request.head.sha }}
          comparadise-host: https://my-comparadise-url.com
```

## Merge Workflow

When a PR merges, `manifest-merge` updates the base manifest and base images in S3 so future comparisons are based on the latest merged state.

**Important:** You must set a `concurrency` group with `cancel-in-progress: false` on this workflow. Without it, two PRs merging simultaneously can race to update overlapping base images, producing a corrupted state that future `manifest-compare` runs will read incorrect diffs against.

```yaml
on:
  pull_request:
    types:
      - closed
    branches:
      - main

concurrency:
  group: manifest-merge
  cancel-in-progress: false

jobs:
  manifest-merge:
    name: Update Manifest
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # AWS authentication
      - name: Update Manifest
        uses: ExpediaGroup/comparadise@v1
        with:
          workflow: manifest-merge
          bucket-name: visual-regression-bucket
```

The `pr-sha`, `merge-commit-sha`, and `pr-number` inputs are automatically read from the `pull_request` event payload and do not need to be set explicitly.

## Required status check

`manifest-compare` sets the `Visual Regression` commit status on the PR head SHA–the same context as the standard `pr` mode. Add it as a required status check in your branch protection settings to block merges until visual changes are reviewed.
