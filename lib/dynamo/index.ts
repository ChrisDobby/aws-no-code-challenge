import * as dynamo from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"

export const create = ({ scope, eligibilityTableName, tableName }: { scope: Construct; eligibilityTableName: string; tableName: string }) => ({
  eligibilityTable: new dynamo.Table(scope, "eligibility-table", {
    tableName: eligibilityTableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
  }),
  mainTable: new dynamo.Table(scope, "main-table", {
    tableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
  }),
})
