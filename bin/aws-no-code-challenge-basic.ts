#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import { AwsNoCodeChallengeStack } from "../lib/aws-no-code-challenge-stack"

const app = new cdk.App()
new AwsNoCodeChallengeStack(app, "AwsNoCodeChallengeBaseStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  tags: {
    project: "aws-no-code-challenge",
  },
  isBasic: true,
  serviceName: "process",
})
