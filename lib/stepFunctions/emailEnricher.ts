import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import { IRole } from "aws-cdk-lib/aws-iam"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = (trialsTableName: string, demoApi: IRestApi) => ({
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
                StartAt: "Get trial",
                States: {
                  "Get trial": {
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
                    End: true,
                    ResultPath: "$.trial",
                    ResultSelector: {
                      "startedAt.$": "$.Item.startedAt.S",
                      "trialState.$": "$.Item.trialState.S",
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
                        ConnectionArn: "arn:aws:events:eu-west-1:604776666101:connection/api-key-connection/c916f9ec-21ac-494b-8be8-cd68035aa05f",
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
              "trial.$": "$[0].trial",
              "user.$": "$[1].user",
            },
          },
        },
      },
      End: true,
    },
  },
})

export const create = ({ scope, namespace, role, trialsTableName, demoApi }: { scope: Construct; namespace: string; role: IRole; trialsTableName: string; demoApi: IRestApi }) =>
  new sfn.StateMachine(scope, "email-enricher", {
    stateMachineName: `${namespace}-email-enricher`,
    stateMachineType: sfn.StateMachineType.EXPRESS,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition(trialsTableName, demoApi))),
  })
