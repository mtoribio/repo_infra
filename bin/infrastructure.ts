#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DataBaseStack } from '../lib/db-stack';
import { RepositoryStack } from '../lib/repository-stack';
import { ContainerStack } from '../lib/container-stack';
import { DistributionStack } from '../lib/distribution-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { SandBoxStack } from '../lib/sandbox-stack';
import { BucketStack } from '../lib/bucket-stack';
import { EmailStack } from '../lib/email-stack';
import { TextractApi } from '../lib/textractapi-stack';
import { environments } from './environments';

const app = new cdk.App();

const config: string = app.node.tryGetContext('config');
if (!config) throw new Error("Context variable missing on CDK command. Pass in as '-c config=XXX'");

const env = environments[config];
const { project, region, environment } = env;

export const createName = (resource: string, functionality: string) =>
	`${project}-${region}-${resource}-${environment}-${functionality}`;

const networkStack = new NetworkStack(app, createName('stack', 'network'), {
	env,
});
const repositoryStack = new RepositoryStack(app, createName('stack', 'repository'), { env });
const databaseStack = new DataBaseStack(app, createName('stack', 'database'), {
	env,
	vpc: networkStack.vpc,
	dbSG: networkStack.dbSG,
	redisSG: networkStack.elasticCacheSG,
	subnetGroup: networkStack.subnetGroup,
});
const acmUsEast1Stack = new CertificateStack(app, `hrmgo-us-east-1-stack-${environment}-acm`, {
	env: { ...env, region: 'us-east-1' },
	crossRegionReferences: true,
});
const acmUsEast2Stack = new CertificateStack(app, createName('stack', 'acm'), {
	env,
});
const containerStack = new ContainerStack(app, createName('stack', 'container'), {
	env,
	vpc: networkStack.vpc,
	containerSG: networkStack.containerSG,
	repository: repositoryStack.repository,
	albSG: networkStack.albSG,
	hrmgoCertificate: acmUsEast2Stack.hrmgoCertificate,
});
const distributionStack = new DistributionStack(app, createName('stack', 'distribution'), {
	env,
	vpc: networkStack.vpc,
	alb: containerStack.alb,
	hrmgoCertificate: acmUsEast1Stack.hrmgoCertificate,
	crossRegionReferences: true,
});
const emailStack = new EmailStack(app, createName('stack', 'email'), { env });
const sandboxStack = new SandBoxStack(app, createName('stack', 'sandbox'), {
	env,
	vpc: networkStack.vpc,
	bastionHostSG: networkStack.bastionHostSG,
});
const bucketStack = new BucketStack(app, createName('stack', 'bucket'), {
	env,
});
const textractApi = new TextractApi(app, createName('stack', 'textract-api'), {
	env,
});

cdk.Tags.of(networkStack).add('proyecto', project);
cdk.Tags.of(repositoryStack).add('proyecto', project);
cdk.Tags.of(databaseStack).add('proyecto', project);
cdk.Tags.of(emailStack).add('proyecto', project);
cdk.Tags.of(containerStack).add('proyecto', project);
cdk.Tags.of(distributionStack).add('proyecto', project);
cdk.Tags.of(acmUsEast1Stack).add('proyecto', project);
cdk.Tags.of(acmUsEast2Stack).add('proyecto', project);
cdk.Tags.of(bucketStack).add('proyecto', project);
cdk.Tags.of(sandboxStack).add('proyecto', project);
cdk.Tags.of(textractApi).add('proyecto', project);
