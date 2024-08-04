import * as apiGateway from "aws-cdk-lib/aws-apigateway"
import { IRole } from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"

export type ApiEndpoints = "get-eligibility" | "get-items" | "post-items"

export const create = ({
  scope,
  namespace,
  serviceName,
  role,
  eligibilityTableName,
  tableName,
  endpoints = ["get-eligibility", "get-items", "post-items"],
}: {
  scope: Construct
  namespace: string
  serviceName: string
  role: IRole
  eligibilityTableName: string
  tableName: string
  endpoints?: ApiEndpoints[]
}) => {
  const restApi = new apiGateway.RestApi(scope, "rest-api", { restApiName: `${namespace}-${serviceName}-api` })
  const requestModel = restApi.addModel("post-request", {
    modelName: `${namespace}${serviceName}Request`,
    schema: {
      type: apiGateway.JsonSchemaType.OBJECT,
      properties: {
        feature: { type: apiGateway.JsonSchemaType.STRING, enum: ["feature-1"] },
      },
      required: ["feature"],
    },
  })

  restApi.root.addMethod("GET", new apiGateway.MockIntegration({}))

  if (endpoints.length === 0) {
    return { restApi }
  }

  const serviceResource = restApi.root.addResource("accounts").addResource("{accountId}").addResource(serviceName)
  if (endpoints.includes("get-eligibility")) {
    serviceResource.addResource("eligibility").addMethod(
      "GET",
      new apiGateway.AwsIntegration({
        service: "dynamodb",
        action: "GetItem",
        integrationHttpMethod: "POST",
        options: {
          passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
          credentialsRole: role,
          requestTemplates: {
            "application/json": `
            {
              "TableName": "${eligibilityTableName}",
              "Key": {
                "accountId": { "S": "$input.params('accountId')" }
              }
            }`,
          },
          integrationResponses: [
            {
              statusCode: "200",
              responseTemplates: {
                "application/json": `
                #set($inputRoot = $input.path('$'))
                #if($inputRoot.Item.accountId.S != '') #set($isEligible = true) #else #set($isEligible = false) #end
                {
                    "isEligible": $isEligible
                }`,
              },
            },
          ],
        },
      }),
      {
        apiKeyRequired: true,
        methodResponses: [{ statusCode: "200" }],
      },
    )
  }

  if (endpoints.includes("get-items")) {
    serviceResource.addMethod(
      "GET",
      new apiGateway.AwsIntegration({
        service: "dynamodb",
        action: "Query",
        integrationHttpMethod: "POST",
        options: {
          passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
          credentialsRole: role,
          requestTemplates: {
            "application/json": `
            {
              "TableName": "${tableName}",
              "KeyConditionExpression": "accountId = :accountId",
              "ExpressionAttributeValues": {
                  ":accountId": {
                      "S": "$input.params('accountId')"
                  }
              }
          }`,
          },
          integrationResponses: [
            {
              statusCode: "200",
              responseTemplates: {
                "application/json": `
                #set($inputRoot = $input.path('$'))
                {
                    "${serviceName}": [
                        #foreach($elem in $inputRoot.Items) {
                            "accountId": "$elem.accountId.S",
                            "currentState": "$elem.currentState.S",
                            "feature": "$elem.feature.S"
                        }#if($foreach.hasNext),#end
                  #end
                    ]
                }`,
              },
            },
          ],
        },
      }),
      {
        apiKeyRequired: true,
        methodResponses: [{ statusCode: "200" }],
      },
    )
  }

  if (endpoints.includes("post-items")) {
    serviceResource.addMethod(
      "POST",
      new apiGateway.AwsIntegration({
        service: "dynamodb",
        action: "TransactWriteItems",
        integrationHttpMethod: "POST",
        options: {
          passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
          credentialsRole: role,
          requestTemplates: {
            "application/json": `
            {
                "TransactItems": [
                    {
                        "ConditionCheck": {
                            "TableName": "${eligibilityTableName}",
                            "Key": {
                                "accountId": {
                                    "S": "$input.params('accountId')"
                                }
                            },
                            "ConditionExpression": "attribute_exists(accountId)"
                        }
                    },
                    {
                        "Put": {
                            "TableName": "${tableName}",
                            "ConditionExpression": "attribute_not_exists(accountId)",
                            "Item": {
                                "accountId": {
                                    "S": "$input.params('accountId')"
                                },
                                "currentState": {
                                    "S": "created"
                                },
                                "feature": {
                                    "S": $input.json('$.feature')
                                }
                            }
                        }
                    }
                ]
            }`,
          },
          integrationResponses: [
            { statusCode: "200", responseTemplates: { "application/json": "" } },
            { statusCode: "409", selectionPattern: "400" },
          ],
        },
      }),
      {
        apiKeyRequired: true,
        requestValidatorOptions: { validateRequestBody: true },
        requestModels: { "application/json": requestModel },
        methodResponses: [{ statusCode: "200" }, { statusCode: "409" }],
      },
    )
  }

  return { restApi }
}
