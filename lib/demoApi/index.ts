import * as apiGateway from "aws-cdk-lib/aws-apigateway"
import { IRole } from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"
import * as sns from "aws-cdk-lib/aws-sns"
import * as iam from "aws-cdk-lib/aws-iam"

export const create = ({ scope, namespace, serviceName, region }: { scope: Construct; namespace: string; serviceName: string; region?: string }) => {
  const role = new iam.Role(scope, "demo-role", {
    roleName: `${namespace}-${serviceName}-${region}-demo-role`,
    assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal("apigateway.amazonaws.com")),
    managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSNSFullAccess")],
  })
  const demoEmailTopic = new sns.Topic(scope, "demo-email-topic", { topicName: `${namespace}-${serviceName}-demo-email` })
  const demoApi = new apiGateway.RestApi(scope, "demo-api", { restApiName: `${namespace}-${serviceName}-demo-api` })
  demoApi.root.addResource("email").addMethod(
    "POST",
    new apiGateway.AwsIntegration({
      service: "sns",
      path: "/",
      integrationHttpMethod: "POST",
      options: {
        passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
        credentialsRole: role,
        requestParameters: {
          "integration.request.header.Content-Type": "'application/x-www-form-urlencoded'",
        },
        requestTemplates: {
          "application/json": `Action=Publish&TopicArn=$util.urlEncode(\'${demoEmailTopic.topicArn}\')&Message=$util.urlEncode($input.body)`,
        },
        integrationResponses: [{ statusCode: "200" }],
      },
    }),
    {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: "200" }],
    },
  )
  demoApi.root.addResource("users").addMethod(
    "GET",
    new apiGateway.MockIntegration({
      integrationResponses: [{ statusCode: "200", responseTemplates: { "application/json": JSON.stringify({ name: "Chris Dobson", email: "chrisdobby.dev@gmail.com" }) } }],
      passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{ "statusCode": 200 }',
      },
    }),
    {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: "200" }],
    },
  )

  return { demoApi }
}
