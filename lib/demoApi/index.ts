import * as apiGateway from "aws-cdk-lib/aws-apigateway"
import { Construct } from "constructs"

export const create = ({ scope, namespace }: { scope: Construct; namespace: string }) => {
  const demoApi = new apiGateway.RestApi(scope, "demo-api", { restApiName: `${namespace}-demo-api` })
  demoApi.root.addResource("email").addMethod(
    "POST",
    new apiGateway.MockIntegration({
      integrationResponses: [{ statusCode: "200" }],
      passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{ "statusCode": 200 }',
      },
    }),
    {
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
      methodResponses: [{ statusCode: "200" }],
    },
  )

  return { demoApi }
}
