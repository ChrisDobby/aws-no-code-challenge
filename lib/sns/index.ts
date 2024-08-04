import * as sns from "aws-cdk-lib/aws-sns"
import { Construct } from "constructs"
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions"
import { IQueue } from "aws-cdk-lib/aws-sqs"

export const create = ({
  scope,
  namespace,
  serviceName,
  publishedQueue,
  includeSubscription,
}: {
  scope: Construct
  namespace: string
  serviceName: string
  publishedQueue: IQueue
  includeSubscription?: boolean
}) => {
  const publishedTopic = new sns.Topic(scope, "published-topic", { topicName: `${namespace}-${serviceName}-published` })
  if (includeSubscription) {
    publishedTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(publishedQueue, {
        rawMessageDelivery: true,
        filterPolicyWithMessageBody: {
          features: sns.FilterOrPolicy.filter(sns.SubscriptionFilter.stringFilter({ allowlist: ["feature-1"] })),
        },
      }),
    )
  }

  return { publishedTopic }
}
