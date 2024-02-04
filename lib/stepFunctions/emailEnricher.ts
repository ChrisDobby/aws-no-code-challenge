import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import { IConnection } from "aws-cdk-lib/aws-events"
import { IRole } from "aws-cdk-lib/aws-iam"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = (processTableName: string, demoApi: IRestApi, apiConnection: IConnection) => ({
  Comment: "Enrich email data",
  StartAt: "Enrich each",
  States: {
    "Enrich each": {
      Type: "Map",
      ItemProcessor: {
        ProcessorConfig: {
          Mode: "INLINE",
        },
        StartAt: "Enrich",
        States: {
          Enrich: {
            Type: "Parallel",
            Branches: [
              {
                StartAt: "Get process",
                States: {
                  "Get process": {
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
                    End: true,
                    ResultPath: "$.process",
                    ResultSelector: {
                      "startedAt.$": "$.Item.startedAt.S",
                      "processState.$": "$.Item.processState.S",
                    },
                  },
                },
              },
              {
                StartAt: "Get user",
                States: {
                  "Get user": {
                    Type: "Task",
                    Resource: "arn:aws:states:::http:invoke",
                    Parameters: {
                      ApiEndpoint: demoApi.deploymentStage.urlForPath("/users"),
                      Method: "GET",
                      Authentication: {
                        ConnectionArn: apiConnection.connectionArn,
                      },
                    },
                    Retry: [
                      {
                        ErrorEquals: ["States.ALL"],
                        BackoffRate: 2,
                        IntervalSeconds: 1,
                        MaxAttempts: 3,
                        JitterStrategy: "FULL",
                      },
                    ],
                    End: true,
                    ResultPath: "$.user",
                    ResultSelector: {
                      "name.$": "$.ResponseBody.name",
                      "email.$": "$.ResponseBody.email",
                    },
                  },
                },
              },
            ],
            Next: "Combine results",
          },
          "Combine results": {
            Type: "Pass",
            End: true,
            Parameters: {
              "accountId.$": "$[0].accountId",
              "template.$": "$[0].template",
              "process.$": "$[0].process",
              "user.$": "$[1].user",
            },
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
  processTableName,
  demoApi,
  apiConnection,
}: {
  scope: Construct
  namespace: string
  role: IRole
  processTableName: string
  demoApi: IRestApi
  apiConnection: IConnection
}) =>
  new sfn.StateMachine(scope, "email-enricher", {
    stateMachineName: `${namespace}-email-enricher`,
    stateMachineType: sfn.StateMachineType.EXPRESS,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition(processTableName, demoApi, apiConnection))),
  })
