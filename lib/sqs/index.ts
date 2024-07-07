import * as cdk from "aws-cdk-lib"
import * as sqs from "aws-cdk-lib/aws-sqs"
import { Construct } from "constructs"

export const create = ({ scope, namespace, serviceName }: { scope: Construct; namespace: string; serviceName: string }) => {
  const emailQueue = new sqs.Queue(scope, "email-queue", {
    queueName: `${namespace}-${serviceName}-email`,
    visibilityTimeout: cdk.Duration.seconds(30),
    retentionPeriod: cdk.Duration.minutes(1),
  })

  const publishedQueue = new sqs.Queue(scope, "published-queue", {
    queueName: `${namespace}-${serviceName}-published`,
    visibilityTimeout: cdk.Duration.seconds(30),
    retentionPeriod: cdk.Duration.minutes(1),
  })

  publishedQueue.addToResourcePolicy(
    new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ["sqs:SendMessage"],
      resources: [publishedQueue.queueArn],
      principals: [new cdk.aws_iam.ServicePrincipal("sns.amazonaws.com")],
    }),
  )

  return {
    emailQueue,
    publishedQueue,
  }
}
