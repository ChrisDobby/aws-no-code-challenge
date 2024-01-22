import { IRole } from "aws-cdk-lib/aws-iam"
import { IQueue } from "aws-cdk-lib/aws-sqs"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = (role: IRole, addDaysStateMachine: sfn.IStateMachine, emailQueue: IQueue) => ({
  Comment: "Schedule an email",
  StartAt: "Add current date/time",
  States: {
    "Add current date/time": {
      Type: "Pass",
      Next: "Map",
      Parameters: {
        "schedules.$": "$",
        "dateTime.$": "States.StringSplit($$.State.EnteredTime, '.')",
      },
    },
    Map: {
      Type: "Map",
      ItemProcessor: {
        ProcessorConfig: {
          Mode: "INLINE",
        },
        StartAt: "Add days",
        States: {
          "Add days": {
            Type: "Task",
            Next: "Create schedule",
            Parameters: {
              StateMachineArn: addDaysStateMachine.stateMachineArn,
              Input: {
                "dateTime.$": "$.dateTime",
                "daysToAdd.$": "$.schedule.days",
              },
            },
            Resource: "arn:aws:states:::aws-sdk:sfn:startSyncExecution",
            ResultPath: "$.schedule.create",
            ResultSelector: {
              "at.$": "States.StringToJson($.Output)",
            },
          },
          "Create schedule": {
            Type: "Task",
            End: true,
            Parameters: {
              FlexibleTimeWindow: {
                Mode: "OFF",
              },
              "Name.$": "States.Format('{}{}{}', $.schedule.accountId, $.schedule.template, $.schedule.days)",
              "ScheduleExpression.$": "States.Format('at({})', $.schedule.create.at.dateTime)",
              Target: {
                Arn: emailQueue.queueArn,
                RoleArn: role.roleArn,
                Input: {
                  "accountId.$": "$.schedule.accountId",
                  "template.$": "$.schedule.template",
                },
              },
            },
            Resource: "arn:aws:states:::aws-sdk:scheduler:createSchedule",
          },
        },
      },
      End: true,
      ItemsPath: "$.schedules",
      ItemSelector: {
        "dateTime.$": "$.dateTime[0]",
        "schedule.$": "$$.Map.Item.Value",
      },
    },
  },
})

export const create = ({
  scope,
  namespace,
  role,
  addDaysStateMachine,
  emailQueue,
}: {
  scope: Construct
  namespace: string
  role: IRole
  addDaysStateMachine: sfn.IStateMachine
  emailQueue: IQueue
}) =>
  new sfn.StateMachine(scope, "email-scheduler", {
    stateMachineName: `${namespace}-email-scheduler`,
    stateMachineType: sfn.StateMachineType.EXPRESS,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition(role, addDaysStateMachine, emailQueue))),
  })
