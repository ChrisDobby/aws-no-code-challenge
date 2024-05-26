import { IRole } from "aws-cdk-lib/aws-iam"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = (processTableName: string, processBusName: string) => ({
  Comment: "Workflow state machine",
  StartAt: "Map",
  States: {
    Map: {
      Type: "Map",
      ItemProcessor: {
        ProcessorConfig: {
          Mode: "INLINE",
        },
        StartAt: "Get existing process",
        States: {
          "Get existing process": {
            Type: "Task",
            Resource: "arn:aws:states:::dynamodb:getItem",
            Parameters: {
              TableName: processTableName,
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
                Variable: "$.existing.Item.processState.S",
                StringMatches: "created",
                Next: "Started",
              },
            ],
            Default: "Success",
          },
          Started: {
            Type: "Parallel",
            Next: "Wait until end of process",
            Branches: [
              {
                StartAt: "Set process to in progress",
                States: {
                  "Set process to in progress": {
                    Type: "Task",
                    Resource: "arn:aws:states:::dynamodb:updateItem",
                    Parameters: {
                      TableName: processTableName,
                      Key: {
                        accountId: {
                          "S.$": "$.accountId",
                        },
                      },
                      UpdateExpression: "SET processState = :inprogress, startedAt = :startedAt",
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
                          DetailType: "process-started",
                          EventBusName: processBusName,
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
          "Wait until end of process": {
            Type: "Wait",
            Seconds: 120,
            Next: "Complete",
          },
          Complete: {
            Type: "Parallel",
            Branches: [
              {
                StartAt: "Set process to complete",
                States: {
                  "Set process to complete": {
                    Type: "Task",
                    Resource: "arn:aws:states:::dynamodb:updateItem",
                    Parameters: {
                      TableName: processTableName,
                      Key: {
                        accountId: {
                          "S.$": "$.accountId",
                        },
                      },
                      UpdateExpression: "SET processState = :complete, completedAt = :completedAt",
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
                          DetailType: "process-complete",
                          EventBusName: processBusName,
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
  processTableName,
  processBusName,
}: {
  scope: Construct
  namespace: string
  serviceName: string
  role: IRole
  processTableName: string
  processBusName: string
}) =>
  new sfn.StateMachine(scope, "workflow", {
    stateMachineName: `${namespace}-${serviceName}-workflow`,
    stateMachineType: sfn.StateMachineType.STANDARD,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition(processTableName, processBusName))),
  })
