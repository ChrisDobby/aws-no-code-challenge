import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import { IConnection } from "aws-cdk-lib/aws-events"
import { IRole } from "aws-cdk-lib/aws-iam"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = (demoApi: IRestApi, apiConnection: IConnection) => ({
  Comment: "A description of my state machine",
  StartAt: "Map",
  States: {
    Map: {
      Type: "Map",
      ItemProcessor: {
        ProcessorConfig: {
          Mode: "INLINE",
        },
        StartAt: "POST to email endpoint",
        States: {
          "POST to email endpoint": {
            Type: "Task",
            Resource: "arn:aws:states:::http:invoke",
            Parameters: {
              Method: "POST",
              Authentication: {
                ConnectionArn: apiConnection.connectionArn, // "arn:aws:events:eu-west-1:604776666101:connection/api-key-connection/c916f9ec-21ac-494b-8be8-cd68035aa05f",
              },
              ApiEndpoint: demoApi.deploymentStage.urlForPath("/email"),
              RequestBody: {
                "accountId.$": "$.accountId",
                "template.$": "$.template",
                "trial.$": "$.trial",
                "user.$": "$.user",
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
          },
        },
      },
      End: true,
    },
  },
})

export const create = ({ scope, namespace, role, demoApi, apiConnection }: { scope: Construct; namespace: string; role: IRole; demoApi: IRestApi; apiConnection: IConnection }) =>
  new sfn.StateMachine(scope, "email-sender", {
    stateMachineName: `${namespace}-email-sender`,
    stateMachineType: sfn.StateMachineType.EXPRESS,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition(demoApi, apiConnection))),
  })
