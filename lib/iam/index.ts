import * as iam from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"

export const create = ({ scope, namespace, serviceName, region }: { scope: Construct; namespace: string; serviceName: string; region?: string }) => ({
  role: new iam.Role(scope, "role", {
    roleName: `${namespace}-${serviceName}-${region}-role`,
    assumedBy: new iam.CompositePrincipal(
      new iam.ServicePrincipal("scheduler.amazonaws.com"),
      new iam.ServicePrincipal("pipes.amazonaws.com"),
      new iam.ServicePrincipal("events.amazonaws.com"),
      new iam.ServicePrincipal("states.amazonaws.com"),
      new iam.ServicePrincipal("apigateway.amazonaws.com"),
    ),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXrayFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite"),
    ],
    inlinePolicies: {
      [`${namespace}-dynamo-policy`]: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["dynamodb:*"],
            resources: [`arn:aws:dynamodb:*:*:table/${namespace}-*/stream/*`, `arn:aws:dynamodb:*:*:table/${namespace}-*/index/*`, `arn:aws:dynamodb:*:*:table/${namespace}-*`],
          }),
        ],
      }),
      [`${namespace}-eventbridge-policy`]: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["events:*"],
            resources: [
              `arn:aws:events:*:*:event-bus/${namespace}-*`,
              `arn:aws:events:*:*:rule/${namespace}-*/*`,
              `arn:aws:events:*:*:connection/${namespace}-*/*`,
              `arn:aws:events:*:*:api-destination/${namespace}-*/*`,
            ],
          }),
          new iam.PolicyStatement({
            actions: ["pipes:*"],
            resources: [`arn:aws:pipes:*:*:pipe/${namespace}-*`],
          }),
          new iam.PolicyStatement({
            actions: ["scheduler:*"],
            resources: [`arn:aws:scheduler:*:*:schedule/*/*`],
          }),
          new iam.PolicyStatement({
            actions: ["iam:PassRole"],
            resources: [`arn:aws:iam::*:role/${namespace}-*`],
            conditions: {
              StringLike: { "iam:PassedToService": "scheduler.amazonaws.com" },
            },
          }),
        ],
      }),
      [`${namespace}-sqs-policy`]: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["sqs:*"],
            resources: [`arn:aws:sqs:*:*:${namespace}-*`],
          }),
        ],
      }),
      [`${namespace}-sfn-policy`]: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["states:*"],
            resources: [`arn:aws:states:*:*:stateMachine:${namespace}-*`],
          }),
        ],
      }),
    },
  }),
})
