import * as sns from "aws-cdk-lib/aws-sns"
import { Construct } from "constructs"
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions"
import { IQueue } from "aws-cdk-lib/aws-sqs"

export const create = ({
  scope,
  namespace,
  serviceName,
  publishedQueue,
  isBasic,
}: {
  scope: Construct
  namespace: string
  serviceName: string
  publishedQueue: IQueue
  isBasic?: boolean
}) => {
  const publishedTopic = new sns.Topic(scope, "published-topic", { topicName: `${namespace}-${serviceName}-published` })
  if (!isBasic) {
    publishedTopic.addSubscription(new snsSubscriptions.SqsSubscription(publishedQueue, { rawMessageDelivery: true }))
  }

  return { publishedTopic }
}
