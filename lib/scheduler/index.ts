import * as scheduler from "aws-cdk-lib/aws-scheduler"
import { Construct } from "constructs"

export const create = ({ scope, namespace, serviceName }: { scope: Construct; namespace: string; serviceName: string }) => ({
  scheduleGroup: new scheduler.CfnScheduleGroup(scope, "scheduleGroup", {
    name: `${namespace}-${serviceName}`,
  }),
})
