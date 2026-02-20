import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface BedrockStackProps extends cdk.StackProps {
  bucket: s3.IBucket;
}

export class BedrockStack extends cdk.Stack {
  public readonly bedrockRole: iam.IRole;

  constructor(scope: Construct, id: string, props: BedrockStackProps) {
    super(scope, id, props);

    const { bucket } = props;

    this.bedrockRole = new iam.Role(this, "BedrockKnowledgeBaseRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      description: "IAM role for Bedrock Knowledge Base to access S3",
    });

    bucket.grantRead(this.bedrockRole);

    new cdk.CfnOutput(this, "BedrockRoleArn", {
      value: this.bedrockRole.roleArn,
      description: "IAM Role ARN for Bedrock Knowledge Base",
      exportName: "K2BedrockRoleArn",
    });

    new cdk.CfnOutput(this, "S3BucketArn", {
      value: bucket.bucketArn,
      description: "S3 Bucket ARN for Knowledge Base data source",
      exportName: "K2KnowledgeBaseBucketArn",
    });

    new cdk.CfnOutput(this, "KnowledgeBaseSetupInstructions", {
      value:
        "Create the Knowledge Base in AWS Console (Bedrock > Knowledge bases): 1) Name: k2-knowledge-base, 2) Use this role ARN, 3) Add S3 data source with bucket above, 4) Use amazon.titan-embed-text-v2:0",
      description: "Instructions for creating Knowledge Base via console",
    });
  }
}
