#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { ApiStack } from "../lib/api-stack";
import { FrontendStack } from "../lib/frontend-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-west-2",
};

const dataStack = new DataStack(app, "K2DataStack", { env });

const apiStack = new ApiStack(app, "K2ApiStack", {
  env,
  conversationsTable: dataStack.conversationsTable,
  sessionsTable: dataStack.sessionsTable,
  auditLogTable: dataStack.auditLogTable,
  bucket: dataStack.bucket,
});
apiStack.addDependency(dataStack);

const frontendStack = new FrontendStack(app, "K2FrontendStack", {
  env,
  apiUrl: apiStack.functionUrl.url,
});
frontendStack.addDependency(apiStack);
