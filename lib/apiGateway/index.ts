import * as apiGateway from "aws-cdk-lib/aws-apigateway"
import { IRole } from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"

export const create = ({
  scope,
  namespace,
  serviceName,
  role,
  eligibilityTableName,
  tableName,
  isBasic,
}: {
  scope: Construct
  namespace: string
  serviceName: string
  role: IRole
  eligibilityTableName: string
  tableName: string
  isBasic?: boolean
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

  if (!isBasic) {
    restApi.root
      .addResource("eligibility")
      .addResource("{accountId}")
      .addMethod(
        "GET",
        new apiGateway.AwsIntegration({
          service: "dynamodb",
          action: "GetItem",
          integrationHttpMethod: "POST",
          options: {
            passthroughBehavior: apiGateway.PassthroughBehavior.NEVER,
            credentialsRole: role,
            requestTemplates: {
              "application/json": JSON.stringify({
                TableName: eligibilityTableName,
                Key: {
                  accountId: { S: "$input.params('accountId')" },
                },
              }),
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
    const accountResource = restApi.root.addResource("ncc").addResource("{accountId}")
    accountResource.addMethod(
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
                            "createdAt": "$elem.createdAt.S",
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

    accountResource.addMethod(
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
            #set($all_parts = $context.requestTime.split(':'))
            #set($date_parts = $all_parts[0].split('/'))
            #set($day = $date_parts[0])
            #set($month_name = $date_parts[1])
            #set($year = $date_parts[2])
            #set($months = {'Jan':'01', 'Feb':'02', 'Mar':'03', 'Apr':'04', 'May':'05', 'June':'06', 'Jul':'07', 'Aug':'08', 'Sep':'09', 'Oct':'10', 'Nov':'11', 'Dec':'12'})
            #set($month = $months.get($month_name))
            #set($hours = $all_parts[1])
            #set($minutes = $all_parts[2])
            #set($seconds = $all_parts[3].split(' ')[0])
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
                                "createdAt": {
                                    "S": "\${year}-\${month}-\${day}T\${hours}:\${minutes}:\${seconds}.000Z"
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

    accountResource.addResource("incomplete").addMethod(
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
              "FilterExpression": "currentState in (:created, :inProgress)",
              "ExpressionAttributeValues": {
                  ":accountId": {
                      "S": "$input.params('accountId')"
                  },
                  ":created": {
                      "S": "created"
                  },
                  ":inProgress": {
                      "S": "in-progress"
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
                            "createdAt": "$elem.createdAt.S",
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

  return { restApi }
}
