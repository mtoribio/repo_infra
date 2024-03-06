import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createName } from '../bin/infrastructure';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class BucketStack extends Stack {
	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		// Crear bucket S3 para los logs
		const s3LogsBucket = new s3.Bucket(this, 'S3LogsBucket', {
			bucketName: createName('s3', 'logs-statics'),
			enforceSSL: true,
			accessControl: s3.BucketAccessControl.PRIVATE,
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			encryption: s3.BucketEncryption.S3_MANAGED,
		});

		// Crear el bucket S3
		const s3Bucket = new s3.Bucket(this, 'S3Bucket', {
			bucketName: createName('s3', 'statics'),
			enforceSSL: true,
			accessControl: s3.BucketAccessControl.PRIVATE,
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
			blockPublicAccess: new s3.BlockPublicAccess({
				blockPublicAcls: true,
				blockPublicPolicy: false,
				ignorePublicAcls: true,
				restrictPublicBuckets: true,
			}),
			encryption: s3.BucketEncryption.S3_MANAGED,
			publicReadAccess: true,
			serverAccessLogsBucket: s3LogsBucket,
			serverAccessLogsPrefix: 'logs/',
			objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
		});

		// Crear el usuario IAM
		const user = new iam.User(this, 'CreateUser', {
			userName: createName('iam', 's3-user'),
		});

		user.addToPolicy(
			new iam.PolicyStatement({
				actions: ['s3:ListBucket'],
				effect: iam.Effect.ALLOW,
				resources: [s3Bucket.bucketArn],
			})
		);

		// Adjuntar políticas al usuario
		user.addToPolicy(
			new iam.PolicyStatement({
				actions: ['s3:*'],
				effect: iam.Effect.ALLOW,
				resources: [s3Bucket.bucketArn, `${s3Bucket.bucketArn}/*`],
			})
		);

		// Crear clave de acceso y guardarlo en AWS SecretManager
		const accessKey = new iam.AccessKey(this, 'AccessKey', { user });
		new secretsmanager.Secret(this, 'SecretManagerToUserBucket', {
			secretName: createName('sm', 's3-user-access-key'),
			secretObjectValue: {
				secretAccessKey: accessKey.secretAccessKey,
			},
			removalPolicy: RemovalPolicy.DESTROY,
		});
	}
}
