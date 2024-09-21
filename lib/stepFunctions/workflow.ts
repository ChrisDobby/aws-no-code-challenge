import { IRole } from "aws-cdk-lib/aws-iam"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = (tableName: string, busName: string, serviceName: string) => ({
  Comment: "Workflow state machine",
  StartAt: "Map",
  States: {
    Map: {
      Type: "Map",
      ItemProcessor: {
        ProcessorConfig: {
          Mode: "INLINE",
        },
        StartAt: `Get existing ${serviceName}`,
        States: {
          [`Get existing ${serviceName}`]: {
            Type: "Task",
            Resource: "arn:aws:states:::dynamodb:getItem",
            Parameters: {
              TableName: tableName,
              Key: {
                accountId: {
                  "S.$": "$.accountId",
                },
              },
            },
            Next: "Is state created",
            ResultPath: "$.existing",
          },
          "Is state created": {
            Type: "Choice",
            Choices: [
              {
                And: [
                  {
                    Variable: "$.existing.Item",
                    IsPresent: true,
                  },
                  {
                    Variable: "$.existing.Item.currentState.S",
                    StringMatches: "created",
                  },
                ],
                Next: "Started",
              },
            ],
            Default: "Success",
          },
          Started: {
            Type: "Parallel",
            Next: `Wait until end of ${serviceName}`,
            Branches: [
              {
                StartAt: `Set ${serviceName} to in progress`,
                States: {
                  [`Set ${serviceName} to in progress`]: {
                    Type: "Task",
                    Resource: "arn:aws:states:::dynamodb:updateItem",
                    Parameters: {
                      TableName: tableName,
                      Key: {
                        accountId: {
                          "S.$": "$.accountId",
                        },
                      },
                      UpdateExpression: "SET currentState = :inprogress, startedAt = :startedAt",
                      ExpressionAttributeValues: {
                        ":inprogress": {
                          S: "in-progress",
                        },
                        ":startedAt": {
                          "S.$": "$$.State.EnteredTime",
                        },
                      },
                      ConditionExpression: "attribute_exists(accountId)",
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
                          DetailType: `${serviceName}-started`,
                          EventBusName: busName,
                          Source: "workflow.statemachine",
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
          [`Wait until end of ${serviceName}`]: {
            Type: "Wait",
            Seconds: 120,
            Next: "Complete",
          },
          Complete: {
            Type: "Parallel",
            Branches: [
              {
                StartAt: `Set ${serviceName} to complete`,
                States: {
                  [`Set ${serviceName} to complete`]: {
                    Type: "Task",
                    Resource: "arn:aws:states:::dynamodb:updateItem",
                    Parameters: {
                      TableName: tableName,
                      Key: {
                        accountId: {
                          "S.$": "$.accountId",
                        },
                      },
                      UpdateExpression: "SET currentState = :complete, completedAt = :completedAt",
                      ExpressionAttributeValues: {
                        ":complete": {
                          S: "complete",
                        },
                        ":completedAt": {
                          "S.$": "$$.State.EnteredTime",
                        },
                      },
                      ConditionExpression: "attribute_exists(accountId)",
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
                          DetailType: `${serviceName}-complete`,
                          EventBusName: busName,
                          Source: "workflow.statemachine",
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
  serviceName,
  role,
  tableName,
  busName,
}: {
  scope: Construct
  namespace: string
  serviceName: string
  role: IRole
  tableName: string
  busName: string
}) =>
  new sfn.StateMachine(scope, "workflow", {
    stateMachineName: `${namespace}-${serviceName}-workflow`,
    stateMachineType: sfn.StateMachineType.STANDARD,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition(tableName, busName, serviceName))),
  })
