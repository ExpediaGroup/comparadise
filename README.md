# comparadise <img height=40 src="https://www.svgrepo.com/show/300635/island.svg">

## A visual comparison tool for reviewing visual changes on frontend PRs.

## Use Any S3 Bucket and GitHub Repo!

When accessing the URL, make sure to pass the following URL parameters:

- `hash`: The commit hash representing the change causing a visual difference
- `owner`: The GitHub org
- `repo`: The GitHub repo name
- `bucket`: The name of the S3 bucket where your visual changes are stored

Example URL:

`https://COMPARADISE_HOST/?hash=COMMIT_HASH&owner=GITHUB_ORG&repo=REPO_NAME&bucket=S3_BUCKET_NAME`

## Requirements

In order to use Comparadise, you must have visual regression tests set up in your project. These tests _must_ use the
following image naming conventions:

- `base.png`: The base image
- `diff.png`: The image diff
- `new.png`: The new image resulting from the test run
