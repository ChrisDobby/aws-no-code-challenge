import { aws_events_targets as targets } from "aws-cdk-lib"
import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import * as eventBridge from "aws-cdk-lib/aws-events"
import { IRole } from "aws-cdk-lib/aws-iam"
import * as pipes from "aws-cdk-lib/aws-pipes"
import { IQueue } from "aws-cdk-lib/aws-sqs"
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

export type EventBridgeRules = "started" | "completed"

export const create = ({
  scope,
  namespace,
  serviceName,
  busName,
  role,
  emailQueue,
  publishedQueue,
  emailSchedulerStateMachine,
  workflowStateMachine,
  emailEnricherStateMachine,
  apiConnection,
  demoApi,
  rulesToCreate,
  createPipes,
}: {
  scope: Construct
  namespace: string
  serviceName: string
  busName: string
  role: IRole
  emailQueue: IQueue
  publishedQueue: IQueue
  emailSchedulerStateMachine?: IStateMachine
  workflowStateMachine?: IStateMachine
  emailEnricherStateMachine?: IStateMachine
  apiConnection: eventBridge.IConnection
  demoApi: IRestApi
  rulesToCreate: EventBridgeRules[]
  createPipes: boolean
}) => {
  const bus = new eventBridge.EventBus(scope, "bus", { eventBusName: busName })
  const emailSendApiDestination = new eventBridge.ApiDestination(scope, "api-destination", {
    apiDestinationName: `${namespace}-${serviceName}-send-email`,
    connection: apiConnection,
    endpoint: demoApi.deploymentStage.urlForPath("/email"),
    httpMethod: eventBridge.HttpMethod.POST,
  })

  let startedRule: eventBridge.Rule | undefined
  if (rulesToCreate.includes("started")) {
    startedRule = new eventBridge.Rule(scope, "started-rule", {
      ruleName: `${namespace}-${serviceName}-started`,
      eventBus: bus,
      eventPattern: { detailType: [`${serviceName}-started`] },
    })
    startedRule.addTarget(
      new targets.SqsQueue(emailQueue, {
        message: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "started",
        }),
      }),
    )
    startedRule.addTarget(
      new targets.SfnStateMachine(emailSchedulerStateMachine as IStateMachine, {
        input: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "update",
          days: 4,
        }),
      }),
    )
    startedRule.addTarget(
      new targets.SfnStateMachine(emailSchedulerStateMachine as IStateMachine, {
        input: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "update",
          days: 8,
        }),
      }),
    )
    startedRule.addTarget(
      new targets.SfnStateMachine(emailSchedulerStateMachine as IStateMachine, {
        input: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "ending",
          days: 10,
        }),
      }),
    )
  }

  return {
    bus,
    startedRule,
    completedRule: rulesToCreate.includes("completed")
      ? new eventBridge.Rule(scope, "complete-rule", {
          ruleName: `${namespace}-${serviceName}-complete`,
          eventBus: bus,
          eventPattern: { detailType: [`${serviceName}-complete`] },
        }).addTarget(
          new targets.SqsQueue(emailQueue, {
            message: eventBridge.RuleTargetInput.fromObject({
              accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
              template: "completed",
            }),
          }),
        )
      : undefined,
    publishedPipe: createPipes
      ? new pipes.CfnPipe(scope, "published-pipe", {
          name: `${namespace}-${serviceName}-published`,
          roleArn: role.roleArn,
          source: publishedQueue.queueArn,
          target: workflowStateMachine?.stateMachineArn || "",
          sourceParameters: {
            filterCriteria: {
              filters: [
                {
                  pattern: `
                  {
                    "body": {
                      "features": [{
                        "prefix": "feature-1"
                      }]
                    }
                  }`,
                },
              ],
            },
          },
          targetParameters: {
            inputTemplate: '{"accountId": <$.body.accountId>}',
            stepFunctionStateMachineParameters: {
              invocationType: "FIRE_AND_FORGET",
            },
          },
        })
      : undefined,
    emailPipe: createPipes
      ? new pipes.CfnPipe(scope, "email-pipe", {
          name: `${namespace}-${serviceName}-email`,
          roleArn: role.roleArn,
          source: emailQueue.queueArn,
          target: emailSendApiDestination.apiDestinationArn,
          enrichment: emailEnricherStateMachine?.stateMachineArn || "",
          enrichmentParameters: {
            inputTemplate: '{"accountId": "<$.body.accountId>","template": "<$.body.template>"}',
          },
        })
      : undefined,
  }
}
