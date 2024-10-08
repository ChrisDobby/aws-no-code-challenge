import { IRole } from "aws-cdk-lib/aws-iam"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import { Construct } from "constructs"

const definition = {
  Comment: "Add days to dateTime",
  StartAt: "Split date and time",
  States: {
    "Split date and time": {
      Type: "Pass",
      Parameters: {
        "dateTimeParts.$": "States.StringSplit($.dateTime, 'T')",
        "daysToAdd.$": "$.daysToAdd",
      },
      Next: "Split date",
    },
    "Split date": {
      Type: "Pass",
      Parameters: {
        "dateParts.$": "States.StringSplit($.dateTimeParts[0], '-')",
        "time.$": "$.dateTimeParts[1]",
        "daysToAdd.$": "$.daysToAdd",
      },
      Next: "Remove leading zeroes(1)",
    },
    "Remove leading zeroes(1)": {
      Type: "Pass",
      Next: "Remove leading zeroes(2)",
      Parameters: {
        "dateParts.$": "$.dateParts",
        "time.$": "$.time",
        "daysToAdd.$": "$.daysToAdd",
        "testDay.$": "States.StringSplit(States.Format('99{}', $.dateParts[2]), '0')",
        "indicator.$": "States.ArrayGetItem(States.StringSplit(States.Format('99{}', $.dateParts[2]), '0'), 0)",
      },
    },
    "Remove leading zeroes(2)": {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.indicator",
          StringEquals: "99",
          Next: "Has leading zero",
        },
      ],
      Default: "No leading zero",
    },
    "No leading zero": {
      Type: "Pass",
      Next: "Needs trailing zero",
      Parameters: {
        "dateParts.$": "$.dateParts",
        "time.$": "$.time",
        "daysToAdd.$": "$.daysToAdd",
        "day.$": "States.StringToJson(States.ArrayGetItem(States.StringSplit(States.ArrayGetItem($.testDay, 0), '99'), 0))",
      },
    },
    "Needs trailing zero": {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.day",
          NumericGreaterThanEquals: 10,
          Next: "Create date",
        },
      ],
      Default: "Add trailing zero",
    },
    "Add trailing zero": {
      Type: "Pass",
      Next: "Create date",
      Parameters: {
        "dateParts.$": "$.dateParts",
        "time.$": "$.time",
        "daysToAdd.$": "$.daysToAdd",
        "day.$": "States.StringToJson(States.Format('{}0', $.day))",
      },
    },
    "Has leading zero": {
      Type: "Pass",
      Next: "Create date",
      Parameters: {
        "dateParts.$": "$.dateParts",
        "time.$": "$.time",
        "daysToAdd.$": "$.daysToAdd",
        "day.$": "States.StringToJson(States.ArrayGetItem($.testDay, 1))",
      },
    },
    "Create date": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "year.$": "States.StringToJson($.dateParts[0])",
        "month.$": "States.StringToJson(States.ArrayGetItem(States.StringSplit($.dateParts[1], '0'), 0))",
        "day.$": "$.day",
        "daysToAdd.$": "$.daysToAdd",
      },
      Next: "Have all days been added",
    },
    "Have all days been added": {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.daysToAdd",
          NumericGreaterThan: 0,
          Next: "Add day",
        },
      ],
      Default: "Day less than 10",
    },
    "Day less than 10": {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.day",
          NumericLessThan: 10,
          Next: "Add leading zero to day",
        },
      ],
      Default: "day to string",
    },
    "day to string": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "month.$": "$.month",
        "year.$": "$.year",
        "day.$": "States.Format('{}', $.day)",
      },
      Next: "Month less than 10",
    },
    "Add leading zero to day": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "month.$": "$.month",
        "year.$": "$.year",
        "day.$": "States.Format('0{}', $.day)",
      },
      Next: "Month less than 10",
    },
    "Month less than 10": {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.month",
          NumericLessThan: 10,
          Next: "Add leading zero to month",
        },
      ],
      Default: "month to string",
    },
    "Add leading zero to month": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "day.$": "$.day",
        "year.$": "$.year",
        "month.$": "States.Format('0{}', $.month)",
      },
      Next: "Format output",
    },
    "Format output": {
      Type: "Pass",
      End: true,
      Parameters: {
        "dateTime.$": "States.Format('{}-{}-{}T{}', $.year, $.month, $.day, $.time)",
      },
    },
    "month to string": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "day.$": "$.day",
        "year.$": "$.year",
        "month.$": "States.Format('{}', $.month)",
      },
      Next: "Format output",
    },
    "Add day": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "year.$": "$.year",
        "month.$": "$.month",
        "day.$": "States.MathAdd($.day, 1)",
        "daysToAdd.$": "States.MathAdd($.daysToAdd, -1)",
      },
      Next: "Is end of January",
    },
    "Is end of January": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 1,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 31,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of February",
    },
    "Is end of February": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 2,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 28,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of March",
    },
    "Is end of March": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 3,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 31,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of April",
    },
    "Is end of April": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 4,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 30,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of May",
    },
    "Is end of May": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 5,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 31,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of June",
    },
    "Is end of June": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 6,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 30,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of July",
    },
    "Is end of July": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 7,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 31,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of August",
    },
    "Is end of August": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 8,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 31,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of September",
    },
    "Is end of September": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 9,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 30,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of October",
    },
    "Is end of October": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 10,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 31,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of November",
    },
    "Is end of November": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 11,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 30,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Is end of December",
    },
    "Is end of December": {
      Type: "Choice",
      Choices: [
        {
          And: [
            {
              Variable: "$.month",
              NumericEquals: 12,
            },
            {
              Variable: "$.day",
              NumericGreaterThan: 31,
            },
          ],
          Next: "Increment month",
        },
      ],
      Default: "Have all days been added",
    },
    "Increment month": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "daysToAdd.$": "$.daysToAdd",
        "year.$": "$.year",
        "month.$": "States.MathAdd($.month, 1)",
        day: 1,
      },
      Next: "Is end of year",
    },
    "Is end of year": {
      Type: "Choice",
      Choices: [
        {
          Variable: "$.month",
          NumericGreaterThanEquals: 12,
          Next: "Increment year",
        },
      ],
      Default: "Have all days been added",
    },
    "Increment year": {
      Type: "Pass",
      Parameters: {
        "time.$": "$.time",
        "daysToAdd.$": "$.daysToAdd",
        "year.$": "States.MathAdd($.year, 1)",
        month: 1,
        day: 1,
      },
      Next: "Have all days been added",
    },
  },
}

export const create = ({ scope, namespace, serviceName, role }: { scope: Construct; namespace: string; serviceName: string; role: IRole }) =>
  new sfn.StateMachine(scope, "add-days", {
    stateMachineName: `${namespace}-${serviceName}-add-days`,
    stateMachineType: sfn.StateMachineType.EXPRESS,
    role,
    definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(definition)),
  })
