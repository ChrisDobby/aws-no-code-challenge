import * as iam from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"

export const create = ({ scope, namespace }: { scope: Construct; namespace: string }) => ({
  role: new iam.Role(scope, "role", {
    roleName: `${namespace}-role`,
    assumedBy: new iam.CompositePrincipal(
      new iam.ServicePrincipal("scheduler.amazonaws.com"),
      new iam.ServicePrincipal("pipes.amazonaws.com"),
      new iam.ServicePrincipal("events.amazonaws.com"),
      new iam.ServicePrincipal("states.amazonaws.com"),
      new iam.ServicePrincipal("apigateway.amazonaws.com"),
    ),
    managedPolicies: [
      // iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonAPIGatewayPushToCloudWatchLogs"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEventBridgeFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSStepFunctionsFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXrayFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite"),
    ],
  }),
})
