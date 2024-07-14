import { RemovalPolicy } from "aws-cdk-lib"
import * as dynamo from "aws-cdk-lib/aws-dynamodb"
import { AwsCustomResource, AwsCustomResourcePolicy } from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

export const create = ({ scope, eligibilityTableName, tableName }: { scope: Construct; eligibilityTableName: string; tableName: string }) => ({
  eligibilityTable: new dynamo.Table(scope, "eligibility-table", {
    tableName: eligibilityTableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
  }),
  mainTable: new dynamo.Table(scope, "main-table", {
    tableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
  }),
})

export const initialise = ({ scope, eligibilityTable }: { scope: Construct; eligibilityTable: dynamo.ITable }) => {
  new AwsCustomResource(scope, "initialise-dara", {
    onCreate: {
      service: "DynamoDB",
      action: "batchWriteItem",
      parameters: {
        RequestItems: {
          [eligibilityTable.tableName]: [
            {
              PutRequest: {
                Item: {
                  accountId: { S: "test" },
                },
              },
            },
            {
              PutRequest: {
                Item: {
                  accountId: { S: "demo" },
                },
              },
            },
          ],
        },
      },
      physicalResourceId: { id: "initialise-dara" },
    },
    policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [eligibilityTable.tableArn] }),
  })
}
