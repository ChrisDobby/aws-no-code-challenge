# AWS No Code Challenge

AWS CDK project to build infrastructure demonstrated in my **AWS No Code Challenge** talk.

To run:

`npm ci`
`npm run deploy`

The deploy command accepts a number of context options:

- `--context type`: a type of base will create just the basics, API Gateway REST API with no resources, SNS topics, SQS queues and Dynamo table
- `--context service`: the name used for the service, defaults to `test`
- `--context demoEmail`: the email address used to send demo notifications to, if not provided no notifications will be sent
- `--context urlBucket`: boolean determining whether to put the API key into an S3 bucket, defaults to `false`

`npm run deploy` will create a full deployment with a service name of `test`, no notifications and doesn't store the api key.

`npm run deploy --context type=base --context service=trials --context demoEmail=test@email.com --context urlBucket=true` will create a base deployment with a service name of `trials`, notifications sent to `test@email.com` and stores the api key in a bucket.

[Architecture](./architecture.png)
