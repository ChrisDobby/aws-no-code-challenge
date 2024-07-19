import { CustomResource, Duration } from "aws-cdk-lib"
import { IRole } from "aws-cdk-lib/aws-iam"
import { Runtime } from "aws-cdk-lib/aws-lambda"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import { RetentionDays } from "aws-cdk-lib/aws-logs"
import { Provider } from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

export const create = ({ scope, namespace, serviceName, role }: { scope: Construct; namespace: string; serviceName: string; role: IRole }) => ({
  deleteBaseResource: new CustomResource(scope, "deleteBase", {
    serviceToken: new Provider(scope, "deleteBaseProvider", {
      onEventHandler: new NodejsFunction(scope, "deleteBaseHandler", {
        timeout: Duration.seconds(60),
        runtime: Runtime.NODEJS_20_X,
        entry: "./lib/deleteBase/eventHandler.ts",
        role,
      }),
      logRetention: RetentionDays.ONE_DAY,
    }).serviceToken,
    properties: { namespace, serviceName },
    resourceType: "Custom::deleteBase",
  }),
})
