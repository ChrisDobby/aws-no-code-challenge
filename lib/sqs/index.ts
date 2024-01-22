import * as cdk from "aws-cdk-lib"
import * as sqs from "aws-cdk-lib/aws-sqs"
import { Construct } from "constructs"

export const create = ({ scope, namespace }: { scope: Construct; namespace: string }) => ({
  emailQueue: new sqs.Queue(scope, "email-queue", {
    queueName: `${namespace}-email`,
    visibilityTimeout: cdk.Duration.seconds(30),
    retentionPeriod: cdk.Duration.minutes(1),
  }),
  publishedQueue: new sqs.Queue(scope, "published-queue", {
    queueName: `${namespace}-published`,
    visibilityTimeout: cdk.Duration.seconds(30),
    retentionPeriod: cdk.Duration.minutes(1),
  }),
})
