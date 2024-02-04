import * as dynamo from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"

export const create = ({ scope, eligibilityTableName, processTableName }: { scope: Construct; eligibilityTableName: string; processTableName: string }) => ({
  eligibilityTable: new dynamo.Table(scope, "eligibility-table", {
    tableName: eligibilityTableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
  }),
  processTable: new dynamo.Table(scope, "process-table", {
    tableName: processTableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
  }),
})
