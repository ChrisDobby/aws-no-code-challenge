import { aws_events_targets as targets } from "aws-cdk-lib"
import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import * as eventBridge from "aws-cdk-lib/aws-events"
import { IRole } from "aws-cdk-lib/aws-iam"
import * as pipes from "aws-cdk-lib/aws-pipes"
import { IQueue } from "aws-cdk-lib/aws-sqs"
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

export const createBasic = ({
  scope,
  namespace,
  serviceName,
  busName,
  apiConnection,
  demoApi,
}: {
  scope: Construct
  namespace: string
  serviceName: string
  busName: string
  apiConnection: eventBridge.IConnection
  demoApi: IRestApi
}) => ({
  bus: new eventBridge.EventBus(scope, "bus", { eventBusName: busName }),
  emailSendApiDestination: new eventBridge.ApiDestination(scope, "api-destination", {
    apiDestinationName: `${namespace}-${serviceName}-send-email`,
    connection: apiConnection,
    endpoint: demoApi.deploymentStage.urlForPath("/email"),
    httpMethod: eventBridge.HttpMethod.POST,
  }),
})

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
}: {
  scope: Construct
  namespace: string
  serviceName: string
  busName: string
  role: IRole
  emailQueue: IQueue
  publishedQueue: IQueue
  emailSchedulerStateMachine: IStateMachine
  workflowStateMachine: IStateMachine
  emailEnricherStateMachine: IStateMachine
  apiConnection: eventBridge.IConnection
  demoApi: IRestApi
}) => {
  const { bus, emailSendApiDestination } = createBasic({ scope, namespace, serviceName, busName, apiConnection, demoApi })
  return {
    bus,
    startedEmailRule: new eventBridge.Rule(scope, "send-started-email-rule", {
      ruleName: `${namespace}-${serviceName}-send-started-email`,
      eventBus: bus,
      eventPattern: { detailType: [`${serviceName}-started`] },
    }).addTarget(
      new targets.SqsQueue(emailQueue, {
        message: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "started",
        }),
      }),
    ),
    completedEmailRule: new eventBridge.Rule(scope, "send-completed-email-rule", {
      ruleName: `${namespace}-${serviceName}-send-completed-email`,
      eventBus: bus,
      eventPattern: { detailType: [`${serviceName}-complete`] },
    }).addTarget(
      new targets.SqsQueue(emailQueue, {
        message: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "completed",
        }),
      }),
    ),
    startedScheduleRule: new eventBridge.Rule(scope, "schedule-emails-rule", {
      ruleName: `${namespace}-${serviceName}-schedule-emails`,
      eventBus: bus,
      eventPattern: { detailType: [`${serviceName}-started`] },
    }).addTarget(
      new targets.SfnStateMachine(emailSchedulerStateMachine, {
        input: eventBridge.RuleTargetInput.fromObject([
          {
            accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
            template: "update",
            days: 4,
          },
          {
            accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
            template: "update",
            days: 8,
          },
          {
            accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
            template: "ending",
            days: 10,
          },
        ]),
      }),
    ),
    publishedPipe: new pipes.CfnPipe(scope, "published-pipe", {
      name: `${namespace}-${serviceName}-published`,
      roleArn: role.roleArn,
      source: publishedQueue.queueArn,
      target: workflowStateMachine.stateMachineArn,
      sourceParameters: {
        sqsQueueParameters: {
          batchSize: 1,
        },
        filterCriteria: {
          filters: [
            {
              pattern: JSON.stringify({
                body: {
                  features: [
                    {
                      prefix: "feature-1",
                    },
                  ],
                },
              }),
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
    }),
    emailPipe: new pipes.CfnPipe(scope, "email-pipe", {
      name: `${namespace}-${serviceName}-email`,
      roleArn: role.roleArn,
      source: emailQueue.queueArn,
      target: emailSendApiDestination.apiDestinationArn,
      enrichment: emailEnricherStateMachine.stateMachineArn,
      enrichmentParameters: {
        inputTemplate: '{"accountId": "<$.body.accountId>","template": "<$.body.template>"}',
      },
    }),
  }
}
