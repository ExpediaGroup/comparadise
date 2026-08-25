---
sidebar_position: 5
---

# Manifest-Based Workflows

Manifest-based workflows are an alternative to the standard `pr`/`merge` setup that reduces S3 usage and CI time by only uploading screenshots that changed relative to the base branch.

Three workflow modes work together:

![Manifest workflow sequence diagram](/img/manifest-workflow.svg)

| Mode                | Trigger                  | What it does                                                                                            |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `manifest-generate` | PR push                  | Runs visual tests, hashes screenshots, uploads only changed images and a manifest to S3                 |
| `manifest-compare`  | PR push (after generate) | 3-way hash comparison against base branch; generates diffs, sets commit status, posts PR comment        |
| `manifest-merge`    | push to base branch      | Overlays each merged PR's changeset onto the base manifest, in landing order; updates base images in S3 |

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

On a `pull_request` trigger, `manifest-generate` automatically uploads only the screenshots whose hash changed since the base branch's current HEAD — it resolves the live base-branch HEAD from the event and diffs against that manifest, so no extra configuration is needed. When run outside a pull request (no base branch to diff against), it uploads all screenshots.

### Matrix jobs

For monorepos running visual tests in parallel, split the packages across several `manifest-generate` jobs — one package per job, or several packages grouped into one job (a "chunk") — and run a single `manifest-compare` job once all generate jobs complete.

Pass each job's package(s) as `package-paths` (comma separated for a chunk). `manifest-generate` sorts and MD5-hashes those paths into a chunk-id and writes that job's manifest to `manifests/{commit-sha}/{chunk-id}.json`, so parallel jobs never overwrite one another. Manifest keys are the screenshot paths exactly as they sit on disk — in a monorepo each package's screenshots already live under a package-named subdirectory, so keys are globally unique without any prefix being added. `manifest-compare` automatically discovers those per-chunk manifests, squashes them into the single `manifests/{commit-sha}.json`, and runs the comparison against it—so the compare and merge jobs need no extra configuration.

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

When a PR merges, `manifest-merge` updates the base manifest and base images in S3 so future comparisons are based on the latest merged state. Trigger it on `push`, not `pull_request: closed`:

**Important:** Restrict the base branch to **squash merge only** (GitHub branch protection: "Allow squash merging" enabled, "Allow merge commits" and "Allow rebase merging" disabled). `manifest-merge` maps each commit in the push payload to the PR it came from; a squash merge guarantees exactly one commit per PR, so that mapping — and the changeset applied to base images — stays one-to-one. A regular merge or rebase merge can land multiple commits for the same PR in one push, which would replay that PR's changeset against the base images once per commit instead of once per PR.

**Important:** You must still set a `concurrency` group with `cancel-in-progress: false` on this workflow. Processing a batched push's commits sequentially, in-job, only serializes _within_ that one push event — it does not serialize _across_ separate push events. Two PRs merged moments apart (even without a merge queue batching them) still fire two independent `push` events with no guaranteed run order or mutual exclusion, and without a concurrency group they can race to update overlapping base images the same way non-batched `pull_request: closed` runs could.

```yaml
on:
  push:
    branches:
      - main

concurrency:
  group: manifest-merge
  cancel-in-progress: false

jobs:
  manifest-merge:
    name: Update Manifest
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

`manifest-merge` reads the triggering push event's own `commits` list — already ordered oldest-first — resolves each commit's pull request via the GitHub API, and merges them one at a time, awaited in that order, within this single job run. No `pr-sha`, `merge-commit-sha`, or `pr-number` inputs need to be set explicitly; the `concurrency` group above still is, to serialize across pushes.

## Required status check

`manifest-compare` sets the `Visual Regression` commit status on the PR head SHA–the same context as the standard `pr` mode. Add it as a required status check in your branch protection settings to block merges until visual changes are reviewed.
