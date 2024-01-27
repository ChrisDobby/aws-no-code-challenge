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
const trialsTableName = `${namespace}-trials`
const trialsBusName = `${namespace}-trials`

export class AwsNoCodeChallengeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps & { isBasic?: boolean }) {
    super(scope, id, props)

    const { demoApi } = demoApiGateway.create({ scope: this, namespace })
    const { role } = iam.create({ scope: this, namespace })
    const { publishedQueue, emailQueue } = sqs.create({ scope: this, namespace })
    sns.create({ scope: this, namespace, publishedQueue, isBasic: props?.isBasic })
    dynamo.create({ scope: this, eligibilityTableName, trialsTableName })
    const { trialsApi } = apiGateway.create({ scope: this, namespace, role, eligibilityTableName, trialsTableName, isBasic: props?.isBasic })
    const { apiConnection } = apiKeys.create({ scope: this, namespace, apis: [demoApi, trialsApi] })
    if (props?.isBasic) {
      stepFunctions.createBasic({ scope: this, namespace, role })
      eventBridge.createBasic({ scope: this, trialsBusName })
    } else {
      const { emailEnricherStateMachine, emailSchedulerStateMachine, trialWorkflowStateMachine } = stepFunctions.create({
        scope: this,
        namespace,
        role,
        trialsTableName,
        demoApi,
        emailQueue,
        trialsApi,
        trialsBusName,
        apiConnection,
      })
      eventBridge.create({
        scope: this,
        namespace,
        role,
        trialsBusName,
        emailQueue,
        publishedQueue,
        emailSchedulerStateMachine,
        trialWorkflowStateMachine,
        emailEnricherStateMachine,
        apiConnection,
        demoApi,
      })
    }
  }
}
