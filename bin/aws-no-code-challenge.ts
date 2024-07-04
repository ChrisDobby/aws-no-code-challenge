#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import { AwsNoCodeChallengeStack } from "../lib/aws-no-code-challenge-stack"

const app = new cdk.App()
const isBasic = app.node.tryGetContext("base") === "true"
const region = app.node.tryGetContext("region") || process.env.CDK_DEFAULT_REGION
const serviceName = app.node.tryGetContext("service") || "test"

new AwsNoCodeChallengeStack(app, `AwsNoCodeChallengeStack-${serviceName}${isBasic ? "-basic" : ""}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
  tags: {
    project: "aws-no-code-challenge",
  },
})
