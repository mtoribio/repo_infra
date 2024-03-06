import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { createName } from '../bin/cdk-code';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface TextractApiProps extends StackProps {
	env: {
		region: string;
		project: string;
		environment: string;
	};
}

export class TextractApi extends Stack {
	constructor(scope: Construct, id: string, props: TextractApiProps) {
		super(scope, id, props);

		// CREAR BUCKET DE S3 PARA LOS LOGS
		const s3LogsBucket = new s3.Bucket(this, 'S3LogsTextract', {
			bucketName: createName('s3', 'logs-textract-api'),
			enforceSSL: true,
			accessControl: s3.BucketAccessControl.PRIVATE,
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			encryption: s3.BucketEncryption.S3_MANAGED,
		});

		// CREAR BUCKET DE S3 PARA TEXTRACT
		const bucket = new s3.Bucket(this, 'BucketToTextract', {
			bucketName: createName('s3', 'textract-api'),
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			accessControl: s3.BucketAccessControl.PRIVATE,
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
			enforceSSL: true,
			versioned: true,
			serverAccessLogsBucket: s3LogsBucket,
			serverAccessLogsPrefix: 'logs/',
		});

		// POLÍTICA PARA USAR TEXTRACT
		const textractPolicy = new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ['textract:*'],
			resources: ['*'],
		});

		// POLÍTICA PARA USAR S3
		const s3Policy = new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ['s3:*'],
			resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
		});

		// AWS LAMBDAS FUNCTION
		const indexFunction = new lambda.Function(this, 'IndexFunction', {
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'index.handler',
			functionName: createName('fn', 'textract-index'),
			description: 'Lambda function para la Api de Textract',
			retryAttempts: 0,
			code: lambda.Code.fromAsset('lambda'),
			timeout: Duration.seconds(240),
			memorySize: 1024,
			initialPolicy: [textractPolicy, s3Policy],
		});

		const analyzeDocument = new lambda.Function(this, 'AnalizeDocument', {
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'analyzeDocument.handler',
			functionName: createName('fn', 'textract-analyze-document'),
			description: 'Lambda function para la Api de Textract',
			retryAttempts: 0,
			code: lambda.Code.fromAsset('lambda'),
			timeout: Duration.seconds(240),
			memorySize: 1024,
			initialPolicy: [textractPolicy, s3Policy],
			environment: {
				['BUCKET_NAME']: bucket.bucketName,
				['REGION']: props.env.region,
			},
		});

		const analyzeExpense = new lambda.Function(this, 'AnalizeExpense', {
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'analyzeExpense.handler',
			functionName: createName('fn', 'textract-analyze-expense'),
			description: 'Lambda function para la Api de Textract',
			retryAttempts: 0,
			code: lambda.Code.fromAsset('lambda'),
			timeout: Duration.seconds(240),
			memorySize: 1024,
			initialPolicy: [textractPolicy, s3Policy],
			environment: {
				['BUCKET_NAME']: bucket.bucketName,
				['REGION']: props.env.region,
			},
		});

		const analyzeId = new lambda.Function(this, 'AnalizeId', {
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'analyzeId.handler',
			functionName: createName('fn', 'textract-analyze-id'),
			description: 'Lambda function para la Api de Textract',
			retryAttempts: 0,
			code: lambda.Code.fromAsset('lambda'),
			timeout: Duration.seconds(240),
			memorySize: 1024,
			initialPolicy: [textractPolicy, s3Policy],
			environment: {
				['BUCKET_NAME']: bucket.bucketName,
				['REGION']: props.env.region,
			},
		});

		// GRUPOS DE REGISTROS (AWS CLOUDWATCH) PARA AWS APIGATEWAY
		const apiLogGroup = new LogGroup(this, 'ApiTextractLogGroup', {
			logGroupName: createName('cw', 'api-textract-logs'),
			retention: RetentionDays.INFINITE,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		// AWS API GATEWAY
		const api = new apigw.RestApi(this, 'APIGateway', {
			restApiName: createName('apigw', 'rest-api'),
			deploy: true,
			defaultCorsPreflightOptions: {
				allowOrigins: apigw.Cors.ALL_ORIGINS,
				allowHeaders: apigw.Cors.DEFAULT_HEADERS,
				allowMethods: apigw.Cors.ALL_METHODS,
			},
			description: 'Api de Textract',
			endpointTypes: [apigw.EndpointType.REGIONAL],
			cloudWatchRole: true,
			cloudWatchRoleRemovalPolicy: RemovalPolicy.DESTROY,
			deployOptions: {
				accessLogDestination: new apigw.LogGroupLogDestination(apiLogGroup),
				accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
				loggingLevel: apigw.MethodLoggingLevel.INFO,
				metricsEnabled: true,
				stageName: 'api',
			},
			binaryMediaTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'application/pdf'],
		});

		const apikey = api.addApiKey('APIKey', {
			apiKeyName: createName('apigw', 'api-key'),
		});

		const plan = api.addUsagePlan('UsagePlan', {
			name: createName('apigw', 'usage-plan'),
			throttle: {
				rateLimit: 1000,
				burstLimit: 500,
			},
			quota: {
				limit: 1000000,
				period: apigw.Period.MONTH,
			},
			apiStages: [{ stage: api.deploymentStage }],
		});

		plan.addApiKey(apikey);

		api.root.addMethod('GET', new apigw.LambdaIntegration(indexFunction), {
			apiKeyRequired: true,
			methodResponses: [
				{
					statusCode: '200',
					responseParameters: {
						'method.response.header.Access-Control-Allow-Headers': true,
						'method.response.header.Access-Control-Allow-Methods': true,
						'method.response.header.Access-Control-Allow-Origin': true,
					},
				},
			],
		});

		api.root.addResource('analyze-document').addMethod('POST', new apigw.LambdaIntegration(analyzeDocument), {
			apiKeyRequired: true,
			methodResponses: [
				{
					statusCode: '200',
					responseParameters: {
						'method.response.header.Access-Control-Allow-Headers': true,
						'method.response.header.Access-Control-Allow-Methods': true,
						'method.response.header.Access-Control-Allow-Origin': true,
					},
				},
			],
		});

		api.root.addResource('analyze-expense').addMethod('POST', new apigw.LambdaIntegration(analyzeExpense), {
			apiKeyRequired: true,
			methodResponses: [
				{
					statusCode: '200',
					responseParameters: {
						'method.response.header.Access-Control-Allow-Headers': true,
						'method.response.header.Access-Control-Allow-Methods': true,
						'method.response.header.Access-Control-Allow-Origin': true,
					},
				},
			],
		});

		api.root.addResource('analyze-id').addMethod('POST', new apigw.LambdaIntegration(analyzeId), {
			apiKeyRequired: true,
			methodResponses: [
				{
					statusCode: '200',
					responseParameters: {
						'method.response.header.Access-Control-Allow-Headers': true,
						'method.response.header.Access-Control-Allow-Methods': true,
						'method.response.header.Access-Control-Allow-Origin': true,
					},
				},
			],
		});
	}
}
