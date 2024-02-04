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

const eligibilityTableName = `${namespace}-eligibility`
const processTableName = `${namespace}-process`
const processBusName = `${namespace}-process`

export class AwsNoCodeChallengeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps & { isBasic?: boolean }) {
    super(scope, id, props)

    const { demoApi } = demoApiGateway.create({ scope: this, namespace })
    const { role } = iam.create({ scope: this, namespace })
    const { publishedQueue, emailQueue } = sqs.create({ scope: this, namespace })
    sns.create({ scope: this, namespace, publishedQueue, isBasic: props?.isBasic })
    dynamo.create({ scope: this, eligibilityTableName, processTableName })
    const { processApi } = apiGateway.create({ scope: this, namespace, role, eligibilityTableName, processTableName, isBasic: props?.isBasic })
    const { apiConnection } = apiKeys.create({ scope: this, namespace, apis: [demoApi, processApi] })
    if (props?.isBasic) {
      stepFunctions.createBasic({ scope: this, namespace, role })
      eventBridge.createBasic({ scope: this, processBusName })
    } else {
      const { emailEnricherStateMachine, emailSchedulerStateMachine, workflowStateMachine } = stepFunctions.create({
        scope: this,
        namespace,
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
