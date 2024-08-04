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
import * as deleteBase from "./deleteBase"

const namespace = "ncc"

const getOptions = (
  type: string | null,
): {
  includeSubscription: boolean
  apiEndpoints: apiGateway.ApiEndpoints[]
  stepFunctions: stepFunctions.StepFunctions[]
  eventBridgeRules: eventBridge.EventBridgeRules[]
  customDeleteRequired: boolean
  createPipes: boolean
} => {
  switch (type) {
    case "base":
      return {
        includeSubscription: false,
        apiEndpoints: [],
        stepFunctions: ["addDays"],
        eventBridgeRules: [],
        customDeleteRequired: true,
        createPipes: false,
      }

    case "comsum":
      return {
        includeSubscription: false,
        apiEndpoints: ["get-eligibility", "get-items", "post-items"],
        stepFunctions: ["addDays", "emailEnricher"],
        eventBridgeRules: ["completed"],
        customDeleteRequired: true,
        createPipes: false,
      }

    default:
      return {
        includeSubscription: true,
        apiEndpoints: ["get-eligibility", "get-items", "post-items"],
        stepFunctions: ["addDays", "emailEnricher", "emailScheduler", "workflow"],
        eventBridgeRules: ["started", "completed"],
        customDeleteRequired: false,
        createPipes: true,
      }
  }
}

export class AwsNoCodeChallengeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    if (!props) {
      return
    }

    const options = getOptions(this.node.tryGetContext("type"))

    const serviceName = this.node.tryGetContext("service") || "test"
    const demoEmail = this.node.tryGetContext("demoEmail")
    const { env } = props

    const eligibilityTableName = `${namespace}-${serviceName}Eligibility`
    const tableName = `${namespace}-${serviceName}`
    const busName = `${namespace}-${serviceName}`

    const { demoApi } = demoApiGateway.create({ scope: this, namespace, serviceName, region: env?.region, email: demoEmail })
    const { role, deleteBaseRole } = iam.create({ scope: this, namespace, serviceName, region: env?.region })
    const { publishedQueue, emailQueue } = sqs.create({ scope: this, namespace, serviceName })
    sns.create({ scope: this, namespace, serviceName, publishedQueue, includeSubscription: options.includeSubscription })
    const { eligibilityTable } = dynamo.create({ scope: this, eligibilityTableName, tableName })
    dynamo.initialise({ scope: this, eligibilityTable })
    const { restApi } = apiGateway.create({ scope: this, namespace, serviceName, role, eligibilityTableName, tableName, endpoints: options.apiEndpoints })
    const { apiConnection, key } = apiKeys.create({ scope: this, namespace, serviceName, apis: [demoApi, restApi] })

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
      stepFunctionsToCreate: options.stepFunctions,
    })

    const { bus } = eventBridge.create({
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
      rulesToCreate: options.eventBridgeRules,
      createPipes: options.createPipes,
    })

    const { deleteBaseResource } = deleteBase.create({ scope: this, namespace, serviceName, role: deleteBaseRole })
    deleteBaseResource.node.addDependency(restApi)
    deleteBaseResource.node.addDependency(bus)
    deleteBaseResource.node.addDependency(deleteBaseResource)

    scheduler.create({ scope: this, namespace, serviceName })

    if (this.node.tryGetContext("urlBucket") === "true") {
      const { bucket } = s3.create({ scope: this, namespace, serviceName, region: env?.region })
      s3.initialise({ scope: this, bucket, apiUrl: restApi.url, apiKey: key })
    }

    new cdk.CfnOutput(this, "DemoApiUrl", { value: demoApi.url })
    new cdk.CfnOutput(this, "ApiUrl", { value: restApi.url })
  }
}
