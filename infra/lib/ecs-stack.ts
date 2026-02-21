import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  bucket: s3.IBucket;
  conversationsTable: dynamodb.ITable;
  sessionsTable: dynamodb.ITable;
  auditLogTable: dynamodb.ITable;
  bedrockRole: iam.IRole;
}

export class EcsStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const {
      vpc,
      bucket,
      conversationsTable,
      sessionsTable,
      auditLogTable,
    } = props;

    const region = this.region;

    const ecrRepo = new ecr.Repository(this, "K2EcrRepo", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    const cluster = new ecs.Cluster(this, "K2Cluster", {
      vpc,
      clusterName: "k2-cluster",
    });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:*"],
        resources: [
          conversationsTable.tableArn,
          sessionsTable.tableArn,
          auditLogTable.tableArn,
        ],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:*"],
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: ["*"],
      })
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock-agent-runtime:Retrieve"],
        resources: ["*"],
      })
    );

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole,
    });

    const logGroup = new logs.LogGroup(this, "AppLogGroup", {
      logGroupName: "/ecs/k2-app",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const appImage = ecs.ContainerImage.fromRegistry("node:20-alpine");

    const appContainer = taskDefinition.addContainer("app", {
      image: appImage,
      portMappings: [{ containerPort: 3000 }],
      environment: {
        AWS_REGION: region,
        DYNAMODB_CONVERSATIONS_TABLE: conversationsTable.tableName,
        DYNAMODB_SESSIONS_TABLE: sessionsTable.tableName,
        DYNAMODB_AUDIT_TABLE: auditLogTable.tableName,
        S3_DOCUMENTS_BUCKET: bucket.bucketName,
        BEDROCK_MODEL_ID: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        DD_ENV: "production",
        DD_SERVICE: "k2-support-agent",
        DD_VERSION: "1.0.0",
        NEXTAUTH_SECRET: "change-me-in-production",
        ADMIN_EMAIL: "admin@example.com",
        ADMIN_PASSWORD: "admin123",
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "k2-app",
        logGroup,
      }),
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    taskDefinition.addContainer("datadog-agent", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/datadog/agent:latest"
      ),
      portMappings: [{ containerPort: 8126 }],
      environment: {
        DD_API_KEY: process.env.DD_API_KEY,
        DD_SITE: process.env.DD_SITE || "datadoghq.com",
        DD_APM_ENABLED: "true",
        DD_APM_NON_LOCAL_TRAFFIC: "true",
        DD_DOGSTATSD_NON_LOCAL_TRAFFIC: "true",
      },
      essential: false,
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
    });

    this.alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      internetFacing: true,
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    this.alb.addListener("Listener", {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    service.attachToApplicationTargetGroup(targetGroup);

    const scaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
    });

    new cdk.CfnOutput(this, "AlbDnsName", {
      value: this.alb.loadBalancerDnsName,
      description: "ALB DNS name - deployed chatbot URL",
      exportName: "K2AlbDnsName",
    });

    new cdk.CfnOutput(this, "DockerImagePushInstructions", {
      value: `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${this.account}.dkr.ecr.${region}.amazonaws.com && docker build -t k2-app -f ../Dockerfile .. && docker tag k2-app:latest ${ecrRepo.repositoryUri}:latest && docker push ${ecrRepo.repositoryUri}:latest`,
      description:
        "Commands to build and push Docker image to ECR. Then update the task definition to use the ECR image.",
    });
  }
}
