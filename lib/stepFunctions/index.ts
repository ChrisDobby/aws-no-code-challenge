import { Construct } from "constructs"
import { IRole } from "aws-cdk-lib/aws-iam"
import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import { IQueue } from "aws-cdk-lib/aws-sqs"

import * as addDays from "./addDays"
import * as emailEnricher from "./emailEnricher"
import * as emailScheduler from "./emailScheduler"
import * as workflow from "./workflow"
import { IConnection } from "aws-cdk-lib/aws-events"

export const createBasic = (params: { scope: Construct; namespace: string; serviceName: string; role: IRole }) => ({
  addDaysStateMachine: addDays.create(params),
})

export const create = (params: {
  scope: Construct
  namespace: string
  serviceName: string
  role: IRole
  tableName: string
  demoApi: IRestApi
  emailQueue: IQueue
  busName: string
  apiConnection: IConnection
}) => ({
  emailEnricherStateMachine: emailEnricher.create(params),
  emailSchedulerStateMachine: emailScheduler.create({ ...params, addDaysStateMachine: createBasic(params).addDaysStateMachine }),
  workflowStateMachine: workflow.create(params),
})
