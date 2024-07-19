import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from "aws-lambda"

import { PipesClient, ListPipesCommand, DeletePipeCommand } from "@aws-sdk/client-pipes"
import { EventBridgeClient, ListRulesCommand, DeleteRuleCommand, RemoveTargetsCommand, ListTargetsByRuleCommand } from "@aws-sdk/client-eventbridge"
import { SFNClient, ListStateMachinesCommand, DeleteStateMachineCommand } from "@aws-sdk/client-sfn"
import { CloudWatchLogsClient, DescribeLogGroupsCommand, DeleteLogGroupCommand } from "@aws-sdk/client-cloudwatch-logs"
import { APIGatewayClient, DeleteResourceCommand, GetRestApisCommand, GetResourcesCommand } from "@aws-sdk/client-api-gateway"
import { SNSClient, ListSubscriptionsCommand, UnsubscribeCommand } from "@aws-sdk/client-sns"

const deletePipes = async (namespace: string) => {
  const client = new PipesClient()
  const { Pipes } = await client.send(new ListPipesCommand({ NamePrefix: `${namespace}-` }))
  if (Pipes) {
    await Promise.all(Pipes.map(({ Name }) => client.send(new DeletePipeCommand({ Name }))))
  }
}

const deleteRules = async (namespace: string, serviceName: string) => {
  const client = new EventBridgeClient()
  const { Rules } = await client.send(new ListRulesCommand({ NamePrefix: `${namespace}-`, EventBusName: `${namespace}-${serviceName}` }))
  if (Rules) {
    await Promise.all(
      Rules.map(async ({ Name }) => {
        const { Targets } = await client.send(new ListTargetsByRuleCommand({ Rule: Name, EventBusName: `${namespace}-${serviceName}` }))
        if (Targets) {
          await client.send(new RemoveTargetsCommand({ Rule: Name, EventBusName: `${namespace}-${serviceName}`, Ids: Targets.map(({ Id }) => Id).filter(Boolean) as string[] }))
        }
        await client.send(new DeleteRuleCommand({ Name, EventBusName: `${namespace}-${serviceName}` }))
      }),
    )
  }
}

const deleteStateMachines = async (namespace: string) => {
  const client = new SFNClient()
  const { stateMachines } = await client.send(new ListStateMachinesCommand({ maxResults: 1000 }))
  if (stateMachines) {
    const toDelete = stateMachines.filter(({ name }) => name?.startsWith(`${namespace}-`) && !name?.endsWith("add-days"))
    await Promise.all(toDelete.map(({ stateMachineArn }) => client.send(new DeleteStateMachineCommand({ stateMachineArn }))))
  }
}

const deleteLogGroups = async (namespace: string) => {
  const client = new CloudWatchLogsClient()
  const { logGroups } = await client.send(new DescribeLogGroupsCommand({ logGroupNamePattern: `${namespace}-` }))
  if (!logGroups) {
    return
  }

  try {
    await Promise.all(logGroups.map(({ logGroupName }) => client.send(new DeleteLogGroupCommand({ logGroupName }))))
  } catch (e) {}
}

const deleteApiResource = async (namespace: string, serviceName: string) => {
  const client = new APIGatewayClient()
  const { items } = await client.send(new GetRestApisCommand({}))
  if (items) {
    await Promise.all(
      items
        .filter(({ name }) => name === `${namespace}-${serviceName}-api`)
        .map(async ({ id: restApiId }) => {
          const { items } = await client.send(new GetResourcesCommand({ restApiId }))
          const accountsResource = items?.find(({ path }) => path === "/accounts")
          if (accountsResource) {
            await client.send(new DeleteResourceCommand({ restApiId, resourceId: accountsResource.id }))
          }
        }),
    )
  }
}

const deleteSubscriptions = async (namespace: string) => {
  const client = new SNSClient()
  const { Subscriptions } = await client.send(new ListSubscriptionsCommand({}))
  if (Subscriptions) {
    await Promise.all(
      Subscriptions.filter(({ TopicArn }) => TopicArn?.includes(`${namespace}-`))
        .filter(({ SubscriptionArn }) => Boolean(SubscriptionArn) && SubscriptionArn !== "PendingConfirmation")
        .map(({ SubscriptionArn }) => client.send(new UnsubscribeCommand({ SubscriptionArn }))),
    )
  }
}

export const handler = async (event: CloudFormationCustomResourceEvent): Promise<CloudFormationCustomResourceResponse> => {
  if (event.RequestType !== "Delete") {
    return {
      Status: "SUCCESS",
      PhysicalResourceId: crypto.randomUUID(),
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    }
  }

  const { namespace, serviceName } = event.ResourceProperties

  await Promise.all([
    deletePipes(namespace),
    deleteStateMachines(namespace),
    deleteLogGroups(namespace),
    deleteApiResource(namespace, serviceName),
    deleteSubscriptions(namespace),
    deleteRules(namespace, serviceName),
  ])

  return {
    Status: "SUCCESS",
    PhysicalResourceId: event.PhysicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  }
}
