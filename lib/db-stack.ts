import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { createName } from '../bin/infrastructure';
import { aws_elasticache as elasticache } from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface DataBaseStackProps extends StackProps {
	env: {
		region: string;
		project: string;
		environment: string;
		dbName: string;
		dbUser: string;
	};
	vpc: ec2.Vpc;
	dbSG: ec2.SecurityGroup;
	redisSG: ec2.SecurityGroup;
	subnetGroup: elasticache.CfnSubnetGroup;
}

export class DataBaseStack extends Stack {
	constructor(scope: Construct, id: string, props: DataBaseStackProps) {
		super(scope, id, props);

		const { dbName, dbUser } = props.env;

		// AWS AURORA CON MYSQL
		const cluster_db = new rds.DatabaseCluster(this, 'DatabaseCluster', {
			clusterIdentifier: createName('aurora-mysql', 'database-cluster'),
			defaultDatabaseName: dbName,
			engine: rds.DatabaseClusterEngine.auroraMysql({
				version: rds.AuroraMysqlEngineVersion.VER_3_05_1,
			}),
			writer: rds.ClusterInstance.serverlessV2('writer'),
			readers: [
				rds.ClusterInstance.serverlessV2('reader', {
					scaleWithWriter: true,
				}),
			],
			serverlessV2MinCapacity: 1,
			serverlessV2MaxCapacity: 2,
			vpc: props.vpc,
			securityGroups: [props.dbSG],
			storageEncrypted: true,
			backup: { retention: Duration.days(1) },
			cloudwatchLogsRetention: RetentionDays.INFINITE,
			credentials: rds.Credentials.fromGeneratedSecret(dbUser, {
				secretName: createName('aurora-mysql', 'password'),
			}),
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
			removalPolicy: RemovalPolicy.DESTROY,
		});

		// GRUPOS DE REGISTROS (AWS CLOUDWATCH) PARA AWS ELASTICACHE FOR REDIS
		// const snowLogs = new LogGroup(this, "SnowLogGroup", {
		//     logGroupName: createName("cw", "redis-snow-logs"),
		//     retention: RetentionDays.INFINITE,
		//     removalPolicy: RemovalPolicy.DESTROY,
		// });

		// const engineLogs = new LogGroup(this, "EngineLogGroup", {
		//     logGroupName: createName("cw", "redis-engine-logs"),
		//     retention: RetentionDays.INFINITE,
		//     removalPolicy: RemovalPolicy.DESTROY,
		// });

		// AWS ELASTICACHE FOR REDIS
		// const redis = new elasticache.CfnReplicationGroup(
		//     this,
		//     "ElastiCacheRedis",
		//     {
		//         replicationGroupId: createName("ecredis", "cache"),
		//         replicationGroupDescription: "hrmgo - redis",
		//         atRestEncryptionEnabled: true,
		//         transitEncryptionEnabled: true,
		//         clusterMode: "disabled",
		//         engine: "redis",
		//         engineVersion: "7.1",
		//         cacheNodeType: "cache.m5.large",
		//         networkType: "ipv4",
		//         port: 6379,
		//         multiAzEnabled: true,
		//         numCacheClusters: 2,
		//         automaticFailoverEnabled: true,
		//         autoMinorVersionUpgrade: true,
		//         cacheSubnetGroupName: props.subnetGroup.cacheSubnetGroupName,
		//         securityGroupIds: [props.redisSG.securityGroupId],
		//         logDeliveryConfigurations: [
		//             {
		//                 destinationDetails: {
		//                     cloudWatchLogsDetails: {
		//                         logGroup: snowLogs.logGroupName,
		//                     },
		//                 },
		//                 destinationType: "cloudwatch-logs",
		//                 logFormat: "json",
		//                 logType: "slow-log",
		//             },
		//             {
		//                 destinationDetails: {
		//                     cloudWatchLogsDetails: {
		//                         logGroup: engineLogs.logGroupName,
		//                     },
		//                 },
		//                 destinationType: "cloudwatch-logs",
		//                 logFormat: "json",
		//                 logType: "engine-log",
		//             },
		//         ],
		//     }
		// );
	}
}
