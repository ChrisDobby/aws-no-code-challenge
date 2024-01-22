import { Construct } from "constructs"
import { IRole } from "aws-cdk-lib/aws-iam"
import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import { IQueue } from "aws-cdk-lib/aws-sqs"

import * as addDays from "./addDays"
import * as emailEnricher from "./emailEnricher"
import * as emailScheduler from "./emailScheduler"
import * as emailSender from "./emailSender"
import * as trialWorkflow from "./trialWorkflow"
import { IConnection } from "aws-cdk-lib/aws-events"

export const create = (params: {
  scope: Construct
  namespace: string
  role: IRole
  trialsTableName: string
  demoApi: IRestApi
  emailQueue: IQueue
  trialsApi: IRestApi
  trialsBusName: string
  apiConnection: IConnection
}) => ({
  emailEnricherStateMachine: emailEnricher.create(params),
  emailSchedulerStateMachine: emailScheduler.create({ ...params, addDaysStateMachine: addDays.create(params) }),
  emailSenderStateMachine: emailSender.create(params),
  trialWorkflowStateMachine: trialWorkflow.create(params),
})
