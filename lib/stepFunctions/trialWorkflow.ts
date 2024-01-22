import { IRole } from "aws-cdk-lib/aws-iam"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = (trialsTableName: string, trialsBusName: string) => ({
  Comment: "Trials workflow state machine",
  StartAt: "Map",
  States: {
    Map: {
      Type: "Map",
      ItemProcessor: {
        ProcessorConfig: {
          Mode: "INLINE",
        },
        StartAt: "Get existing trial",
        States: {
          "Get existing trial": {
            Type: "Task",
            Resource: "arn:aws:states:::dynamodb:getItem",
            Parameters: {
              TableName: trialsTableName,
              Key: {
                accountId: {
                  "S.$": "$.accountId",
                },
              },
            },
            Next: "Is trial state created",
            ResultPath: "$.existing",
          },
          "Is trial state created": {
            Type: "Choice",
            Choices: [
              {
                Variable: "$.existing.Item.trialState.S",
                StringMatches: "created",
                Next: "Trial started",
              },
            ],
            Default: "Success",
          },
          "Trial started": {
            Type: "Parallel",
            Next: "Wait until end of trial",
            Branches: [
              {
                StartAt: "Set trial to in progress",
                States: {
                  "Set trial to in progress": {
                    Type: "Task",
                    Resource: "arn:aws:states:::dynamodb:updateItem",
                    Parameters: {
                      TableName: trialsTableName,
                      Key: {
                        accountId: {
                          "S.$": "$.accountId",
                        },
                      },
                      UpdateExpression: "SET trialState = :inprogress, startedAt = :startedAt",
                      ExpressionAttributeValues: {
                        ":inprogress": {
                          S: "in-progress",
                        },
                        ":startedAt": {
                          "S.$": "$$.State.EnteredTime",
                        },
                      },
                    },
                    ResultPath: null,
                    End: true,
                  },
                },
              },
              {
                StartAt: "Put started event onto bus",
                States: {
                  "Put started event onto bus": {
                    Type: "Task",
                    Resource: "arn:aws:states:::events:putEvents",
                    Parameters: {
                      Entries: [
                        {
                          Detail: {
                            "accountId.$": "$.accountId",
                          },
                          DetailType: "trial-started",
                          EventBusName: trialsBusName,
                          Source: "trials.statemachine",
                        },
                      ],
                    },
                    End: true,
                    ResultPath: null,
                  },
                },
              },
            ],
            ResultPath: null,
          },
          Success: {
            Type: "Succeed",
          },
          "Wait until end of trial": {
            Type: "Wait",
            Seconds: 120,
            Next: "Trial complete",
          },
          "Trial complete": {
            Type: "Parallel",
            Branches: [
              {
                StartAt: "Set trial to complete",
                States: {
                  "Set trial to complete": {
                    Type: "Task",
                    Resource: "arn:aws:states:::dynamodb:updateItem",
                    Parameters: {
                      TableName: trialsTableName,
                      Key: {
                        accountId: {
                          "S.$": "$.accountId",
                        },
                      },
                      UpdateExpression: "SET trialState = :complete, completedAt = :completedAt",
                      ExpressionAttributeValues: {
                        ":complete": {
                          S: "complete",
                        },
                        ":completedAt": {
                          "S.$": "$$.State.EnteredTime",
                        },
                      },
                    },
                    End: true,
                  },
                },
              },
              {
                StartAt: "Put completed event onto bus",
                States: {
                  "Put completed event onto bus": {
                    Type: "Task",
                    Resource: "arn:aws:states:::events:putEvents",
                    Parameters: {
                      Entries: [
                        {
                          Detail: {
                            "accountId.$": "$.accountId",
                          },
                          DetailType: "trial-complete",
                          EventBusName: trialsBusName,
                          Source: "trials.statemachine",
                        },
                      ],
                    },
                    End: true,
                  },
                },
              },
            ],
            End: true,
          },
        },
      },
      End: true,
    },
  },
})

export const create = ({
  scope,
  namespace,
  role,
  trialsTableName,
  trialsBusName,
}: {
  scope: Construct
  namespace: string
  role: IRole
  trialsTableName: string
  trialsBusName: string
}) =>
  new sfn.StateMachine(scope, "trial-workflow", {
    stateMachineName: `${namespace}-trial-workflow`,
    stateMachineType: sfn.StateMachineType.STANDARD,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition(trialsTableName, trialsBusName))),
  })
