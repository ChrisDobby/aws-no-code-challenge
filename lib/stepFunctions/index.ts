import { Construct } from "constructs"
import { IRole } from "aws-cdk-lib/aws-iam"
import { IRestApi } from "aws-cdk-lib/aws-apigateway"
import { IQueue } from "aws-cdk-lib/aws-sqs"

import * as addDays from "./addDays"
import * as emailEnricher from "./emailEnricher"
import * as emailScheduler from "./emailScheduler"
import * as workflow from "./workflow"
import { IConnection } from "aws-cdk-lib/aws-events"
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions"

export type StepFunctions = "addDays" | "emailEnricher" | "emailScheduler" | "workflow"

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
  stepFunctionsToCreate: StepFunctions[]
}) => {
  const addDaysStateMachine = params.stepFunctionsToCreate.includes("addDays") || params.stepFunctionsToCreate.includes("emailScheduler") ? addDays.create(params) : undefined
  return {
    emailEnricherStateMachine: params.stepFunctionsToCreate.includes("emailEnricher") ? emailEnricher.create(params) : undefined,
    emailSchedulerStateMachine: params.stepFunctionsToCreate.includes("emailScheduler")
      ? emailScheduler.create({ ...params, addDaysStateMachine: addDaysStateMachine as IStateMachine })
      : undefined,
    workflowStateMachine: params.stepFunctionsToCreate.includes("workflow") ? workflow.create(params) : undefined,
  }
}
