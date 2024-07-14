import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"

import * as dynamo from "./dynamo"
import * as sns from "./sns"
import * as sqs from "./sqs"
import * as iam from "./iam"
import * as eventBridge from "./eventBridge"
import * as demoApiGateway from "./demoApi"
import * as apiGateway from "./apiGateway"
import * as stepFunctions from "./stepFunctions"
import * as apiKeys from "./apiKeys"
import * as s3 from "./s3"
import * as scheduler from "./scheduler"

const namespace = "ncc"

export class AwsNoCodeChallengeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    if (!props) {
      return
    }

    const isBase = this.node.tryGetContext("base") === "true"
    const serviceName = this.node.tryGetContext("service") || "test"
    const demoEmail = this.node.tryGetContext("demoEmail")
    const { env } = props

    const eligibilityTableName = `${namespace}-${serviceName}Eligibility`
    const tableName = `${namespace}-${serviceName}`
    const busName = `${namespace}-${serviceName}`

    const { demoApi } = demoApiGateway.create({ scope: this, namespace, serviceName, region: env?.region, email: demoEmail })
    const { role } = iam.create({ scope: this, namespace, serviceName, region: env?.region })
    const { publishedQueue, emailQueue } = sqs.create({ scope: this, namespace, serviceName })
    sns.create({ scope: this, namespace, serviceName, publishedQueue, isBase })
    const { eligibilityTable } = dynamo.create({ scope: this, eligibilityTableName, tableName })
    dynamo.initialise({ scope: this, eligibilityTable })
    const { restApi } = apiGateway.create({ scope: this, namespace, serviceName, role, eligibilityTableName, tableName, isBase })
    const { apiConnection } = apiKeys.create({ scope: this, namespace, serviceName, apis: [demoApi, restApi] })
    if (isBase) {
      stepFunctions.createBase({ scope: this, namespace, serviceName, role })
      eventBridge.createBase({ scope: this, namespace, serviceName, busName, apiConnection, demoApi })
    } else {
      const { emailEnricherStateMachine, emailSchedulerStateMachine, workflowStateMachine } = stepFunctions.create({
        scope: this,
        namespace,
        serviceName,
        role,
        tableName,
        demoApi,
        emailQueue,
        busName,
        apiConnection,
      })
      eventBridge.create({
        scope: this,
        namespace,
        serviceName,
        role,
        busName,
        emailQueue,
        publishedQueue,
        emailSchedulerStateMachine,
        workflowStateMachine,
        emailEnricherStateMachine,
        apiConnection,
        demoApi,
      })
    }

    scheduler.create({ scope: this, namespace, serviceName })

    if (this.node.tryGetContext("urlBucket") === "true") {
      const { bucket } = s3.create({ scope: this, namespace, serviceName, region: env?.region })
      s3.initialise({ scope: this, bucket, apiUrl: restApi.url })
    }

    new cdk.CfnOutput(this, "DemoApiUrl", { value: demoApi.url })
    new cdk.CfnOutput(this, "ApiUrl", { value: restApi.url })
  }
}
