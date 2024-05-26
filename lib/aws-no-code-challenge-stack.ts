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

const namespace = "ncc"

export class AwsNoCodeChallengeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    if (!props) {
      return
    }

    const serviceParameter = new cdk.CfnParameter(this, "service", {
      description: "The name of the service",
      type: "String",
    })

    const baseParameter = new cdk.CfnParameter(this, "base", {
      description: "Just deploying the base resources",
      type: "string",
      allowedValues: ["true", "false"],
    })

    const serviceName = serviceParameter.valueAsString
    const isBasic = baseParameter.valueAsString === "true"
    const { env } = props

    const eligibilityTableName = `${namespace}-${serviceName}Eligibility`
    const processTableName = `${namespace}-${serviceName}`
    const processBusName = `${namespace}-${serviceName}`

    const { demoApi } = demoApiGateway.create({ scope: this, namespace, serviceName })
    const { role } = iam.create({ scope: this, namespace, serviceName, region: env?.region })
    const { publishedQueue, emailQueue } = sqs.create({ scope: this, namespace, serviceName })
    sns.create({ scope: this, namespace, serviceName, publishedQueue, isBasic })
    dynamo.create({ scope: this, eligibilityTableName, processTableName })
    const { processApi } = apiGateway.create({ scope: this, namespace, serviceName, role, eligibilityTableName, processTableName, isBasic })
    const { apiConnection } = apiKeys.create({ scope: this, namespace, serviceName, apis: [demoApi, processApi] })
    if (isBasic) {
      stepFunctions.createBasic({ scope: this, namespace, serviceName, role })
      eventBridge.createBasic({ scope: this, processBusName })
    } else {
      const { emailEnricherStateMachine, emailSchedulerStateMachine, workflowStateMachine } = stepFunctions.create({
        scope: this,
        namespace,
        serviceName,
        role,
        processTableName,
        demoApi,
        emailQueue,
        processApi,
        processBusName,
        apiConnection,
      })
      eventBridge.create({
        scope: this,
        namespace,
        serviceName,
        role,
        processBusName,
        emailQueue,
        publishedQueue,
        emailSchedulerStateMachine,
        workflowStateMachine,
        emailEnricherStateMachine,
        apiConnection,
        demoApi,
      })
    }
  }
}
