import * as sns from "aws-cdk-lib/aws-sns"
import { Construct } from "constructs"
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions"
import { IQueue } from "aws-cdk-lib/aws-sqs"

export const create = ({ scope, namespace, publishedQueue }: { scope: Construct; namespace: string; publishedQueue: IQueue }) => {
  const publishedTopic = new sns.Topic(scope, "published-topic", { topicName: `${namespace}-published` })
  publishedTopic.addSubscription(new snsSubscriptions.SqsSubscription(publishedQueue, { rawMessageDelivery: true }))

  return { publishedTopic }
}
