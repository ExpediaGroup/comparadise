---
sidebar_position: 3
---

# Deploying the Web App

Comparadise ships a web application that can be deployed using Docker.
This app provides the experience where visual changes are reviewed.

An example Dockerfile might look something like this:

```Dockerfile
FROM expediagroup/comparadise:latest
```

You can deploy this any way you would like!

## Secrets

You will need to make sure your runtime includes AWS credentials that have permissions to read/write to your S3 bucket.

Also, for the app to authenticate to GitHub, your runtime must contain a `secrets.json` file with the following format:

```json
{
  "<github-owner>/<github-repo>": {
    "githubToken": "<token (required)>",
    "githubApiUrl": "<api url (optional)>"
  }
}
```
