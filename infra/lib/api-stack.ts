import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

export interface ApiStackProps extends cdk.StackProps {
  conversationsTable: dynamodb.ITable;
  sessionsTable: dynamodb.ITable;
  auditLogTable: dynamodb.ITable;
  bucket: s3.IBucket;
}

export class ApiStack extends cdk.Stack {
  public readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { conversationsTable, sessionsTable, auditLogTable, bucket } = props;

    const webAdapterLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "WebAdapterLayer",
      `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerX86:24`
    );

    const fn = new lambda.Function(this, "K2ApiFunction", {
      functionName: "k2-api",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "run.sh",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../.lambda-package")
      ),
      layers: [webAdapterLayer],
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        PORT: "3000",
        AWS_LWA_READINESS_CHECK_PATH: "/api/copilotkit",
        AWS_LWA_READINESS_CHECK_MIN_UNHEALTHY_STATUS: "500",
        NODE_ENV: "production",
        DYNAMODB_CONVERSATIONS_TABLE: conversationsTable.tableName,
        DYNAMODB_SESSIONS_TABLE: sessionsTable.tableName,
        DYNAMODB_AUDIT_TABLE: auditLogTable.tableName,
        S3_DOCUMENTS_BUCKET: bucket.bucketName,
        BEDROCK_MODEL_ID:
          process.env.BEDROCK_MODEL_ID ||
          "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        BEDROCK_ACCESS_KEY_ID: process.env.BEDROCK_ACCESS_KEY_ID || "",
        BEDROCK_SECRET_ACCESS_KEY:
          process.env.BEDROCK_SECRET_ACCESS_KEY || "",
        BEDROCK_SESSION_TOKEN: process.env.BEDROCK_SESSION_TOKEN || "",
        BEDROCK_REGION: process.env.BEDROCK_REGION || "us-west-2",
        NEXTAUTH_SECRET:
          process.env.NEXTAUTH_SECRET || "k2-prod-secret-change-me",
        ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    conversationsTable.grantReadWriteData(fn);
    sessionsTable.grantReadWriteData(fn);
    auditLogTable.grantReadWriteData(fn);
    bucket.grantReadWrite(fn);

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock-agent-runtime:Retrieve",
        ],
        resources: ["*"],
      })
    );

    this.functionUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ["*"],
      },
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.functionUrl.url,
      description: "Lambda Function URL for API",
      exportName: "K2ApiUrl",
    });
  }
}
