import { Construct } from "constructs"
import * as events from "aws-cdk-lib/aws-events"
import { SecretValue } from "aws-cdk-lib"

export const create = ({ scope, namespace }: { scope: Construct; namespace: string }) => ({
  apiConnection: new events.Connection(scope, "api-key", {
    connectionName: `${namespace}-api-key`,
    authorization: events.Authorization.apiKey("x-api-key", SecretValue.unsafePlainText("123")),
  }),
})
