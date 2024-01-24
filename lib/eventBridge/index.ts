import { aws_events_targets as targets } from "aws-cdk-lib"
import * as eventBridge from "aws-cdk-lib/aws-events"
import { IRole } from "aws-cdk-lib/aws-iam"
import * as pipes from "aws-cdk-lib/aws-pipes"
import { IQueue } from "aws-cdk-lib/aws-sqs"
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

export const create = ({
  scope,
  namespace,
  trialsBusName,
  role,
  emailQueue,
  publishedQueue,
  emailSchedulerStateMachine,
  trialWorkflowStateMachine,
  emailSenderStateMachine,
  emailEnricherStateMachine,
}: {
  scope: Construct
  namespace: string
  trialsBusName: string
  role: IRole
  emailQueue: IQueue
  publishedQueue: IQueue
  emailSchedulerStateMachine: IStateMachine
  trialWorkflowStateMachine: IStateMachine
  emailSenderStateMachine: IStateMachine
  emailEnricherStateMachine: IStateMachine
}) => {
  const trialsBus = new eventBridge.EventBus(scope, "trials-bus", { eventBusName: trialsBusName })

  return {
    trialsBus,
    startedEmailRule: new eventBridge.Rule(scope, "send-started-email-rule", {
      ruleName: `${namespace}-send-started-email`,
      eventBus: trialsBus,
      eventPattern: { detailType: ["trial-started"] },
    }).addTarget(
      new targets.SqsQueue(emailQueue, {
        message: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "started",
        }),
      }),
    ),
    completedEmailRule: new eventBridge.Rule(scope, "send-completed-email-rule", {
      ruleName: `${namespace}-send-completed-email`,
      eventBus: trialsBus,
      eventPattern: { detailType: ["trial-complete"] },
    }).addTarget(
      new targets.SqsQueue(emailQueue, {
        message: eventBridge.RuleTargetInput.fromObject({
          accountId: eventBridge.EventField.fromPath("$.detail.accountId"),
          template: "completed",
        }),
      }),
    ),
    startedScheduleRule: new eventBridge.Rule(scope, "schedule-update-email-rule", {
      ruleName: `${namespace}-schedule-update-email`,
      eventBus: trialsBus,
      eventPattern: { detailType: ["trial-started"] },
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
      name: `${namespace}-published`,
      roleArn: role.roleArn,
      source: publishedQueue.queueArn,
      target: trialWorkflowStateMachine.stateMachineArn,
      sourceParameters: {
        filterCriteria: {
          filters: [
            {
              pattern: JSON.stringify({
                body: {
                  features: [
                    {
                      prefix: "slider",
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
      name: `${namespace}-email`,
      roleArn: role.roleArn,
      source: emailQueue.queueArn,
      target: emailSenderStateMachine.stateMachineArn,
      enrichment: emailEnricherStateMachine.stateMachineArn,
      enrichmentParameters: {
        inputTemplate: '{"accountId": "<$.body.accountId>","template": "<$.body.template>"}',
      },
    }),
  }
}
