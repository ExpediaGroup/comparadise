# Local Development

1. Run `nvm use`
2. Run `npm install`
3. Login to the AWS account containing the visual regression S3 bucket
4. Run `npm run dev`
5. Application will be running at `http://localhost:3000`, and it will hot reload when you make changes.

You can also run the app using docker-compose using `npm run build:docker`!

Make sure you have a `secrets.json` file in the root of the project in order to test using application secrets.
This file should have the following format:

```json
{
  "github_token": "MY_TOKEN"
}
```
