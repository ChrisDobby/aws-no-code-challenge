import { RemovalPolicy } from "aws-cdk-lib"
import * as s3 from "aws-cdk-lib/aws-s3"
import { AwsCustomResource, AwsCustomResourcePolicy } from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

export const create = ({ scope, namespace, serviceName, region }: { scope: Construct; namespace: string; serviceName: string; region?: string }) => ({
  bucket: new s3.Bucket(scope, "urlbucket", {
    bucketName: `${namespace}-${serviceName}-${region}-url`,
    autoDeleteObjects: true,
    removalPolicy: RemovalPolicy.DESTROY,
  }),
})

export const initialise = ({ scope, bucket, apiUrl }: { scope: Construct; bucket: s3.IBucket; apiUrl: string }) => {
  new AwsCustomResource(scope, "initialise-s3", {
    onCreate: {
      service: "S3",
      action: "PutObject",
      parameters: {
        Bucket: bucket.bucketName,
        Key: "apiUrl.json",
        Body: JSON.stringify({ apiUrl }),
      },
      physicalResourceId: { id: "initialise-s3" },
    },
    policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [`${bucket.bucketArn}/*`] }),
  })
}
