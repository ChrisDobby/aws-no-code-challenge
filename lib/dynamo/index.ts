import * as dynamo from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"

export const create = ({ scope, eligibilityTableName, trialsTableName }: { scope: Construct; eligibilityTableName: string; trialsTableName: string }) => ({
  eligibilityTable: new dynamo.Table(scope, "eligibility-table", {
    tableName: eligibilityTableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
  }),
  trialsTable: new dynamo.Table(scope, "trials-table", {
    tableName: trialsTableName,
    partitionKey: { name: "accountId", type: dynamo.AttributeType.STRING },
    billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
  }),
})
