import { Construct } from "constructs"
import * as events from "aws-cdk-lib/aws-events"
import * as apiGateway from "aws-cdk-lib/aws-apigateway"
import { SecretValue } from "aws-cdk-lib"
import { randomBytes } from "crypto"

export const create = ({ scope, namespace, serviceName, apis }: { scope: Construct; namespace: string; serviceName: string; apis: apiGateway.IRestApi[] }) => {
  const key = randomBytes(12).toString("hex")
  const apiKey = new apiGateway.ApiKey(scope, "api-key", {
    apiKeyName: `${namespace}-${serviceName}-api-key`,
    value: key,
  })
  const usagePlan = new apiGateway.UsagePlan(scope, "usage-plan", {
    name: `${namespace}-${serviceName}-usage-plan`,
    apiStages: apis.map(api => ({ api, stage: api.deploymentStage })),
  })

  usagePlan.addApiKey(apiKey)
  return {
    apiConnection: new events.Connection(scope, "api-key-connection", {
      connectionName: `${namespace}-${serviceName}-api-key`,
      authorization: events.Authorization.apiKey("x-api-key", SecretValue.unsafePlainText(key)),
    }),
    key,
  }
}
