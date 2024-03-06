import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createName } from '../bin/infrastructure';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as kms from 'aws-cdk-lib/aws-kms';

export interface ContainerStackProps extends StackProps {
	env: { region: string; project: string; environment: string };
	vpc: ec2.Vpc;
	albSG: ec2.SecurityGroup;
	containerSG: ec2.SecurityGroup;
	repository: ecr.Repository;
	hrmgoCertificate: acm.ICertificate;
}

export class ContainerStack extends Stack {
	public readonly alb: elbv2.ApplicationLoadBalancer;

	constructor(scope: Construct, id: string, props: ContainerStackProps) {
		super(scope, id, props);

		// Creamos un task execution role para las tasks de ECS
		const executionECSRole = new iam.Role(this, 'ECSExecutionRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			roleName: createName('iam', 'task-execution-role'),
			description: 'Rol de IAM para ejecutar Tasks de ECS.',
		});

		executionECSRole.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
		);

		// Creamos un task role para las tasks de ECS
		const taskECSRole = new iam.Role(this, 'ECSTaskRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			roleName: createName('iam', 'task-role'),
			description: 'Rol de IAM para las Tasks de ECS.',
		});

		taskECSRole.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogStream',
					'logs:DescribeLogGroups',
					'logs:DescribeLogStreams',
					'logs:PutLogEvents',
					'ssmmessages:CreateControlChannel',
					'ssmmessages:CreateDataChannel',
					'ssmmessages:OpenControlChannel',
					'ssmmessages:OpenDataChannel',
				],
				resources: ['*'],
			})
		);

		// AWS KMS (AWS Key Management Service)
		const ksmEncryptionKey = new kms.Key(this, 'ECSClusterKey', {
			enableKeyRotation: true,
			alias: createName('kms', 'key'),
			removalPolicy: RemovalPolicy.DESTROY,
		});

		// Elastic Container Service (AWS ECS con AWS Fargate)
		const cluster = new ecs.Cluster(this, 'FargateCluster', {
			clusterName: createName('ecs', 'cluster'),
			vpc: props.vpc,
			enableFargateCapacityProviders: true,
			executeCommandConfiguration: { kmsKey: ksmEncryptionKey },
		});

		// Se crea la definición de tarea
		const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
			executionRole: executionECSRole,
			taskRole: taskECSRole,
			family: createName('ecs', 'task'),
			memoryLimitMiB: 4096,
			cpu: 2048,
			runtimePlatform: {
				operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
			},
		});

		// Se carga la imagen de la aplicación de AWS ECR
		const hrm_go_image = ecs.EcrImage.fromRegistry(props.repository.repositoryUri + ':latest');

		// Se añade un contenedor a la definición de tarea
		taskDefinition
			.addContainer('Container', {
				containerName: createName('ecs', 'container'),
				image: hrm_go_image,
				// Configuración del AWS CloudWatch
				logging: ecs.LogDriver.awsLogs({
					streamPrefix: 'ecs',
					logGroup: new logs.LogGroup(this, 'LogGroup', {
						logGroupName: createName('cw', 'ecs-logs'),
						retention: logs.RetentionDays.INFINITE,
						removalPolicy: RemovalPolicy.DESTROY,
					}),
				}),
			})
			.addPortMappings({ containerPort: 8000 });

		// Añadir políticas al task role de la tarea
		taskDefinition.addToTaskRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['kms:Decrypt'],
				resources: [ksmEncryptionKey.keyArn],
			})
		);

		// Se crea el servicio para el cluster
		const service = new ecs.FargateService(this, 'FargateService', {
			serviceName: createName('ecs', 'service'),
			cluster,
			taskDefinition,
			desiredCount: 2,
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				subnetFilters: [ec2.SubnetFilter.onePerAz()],
				onePerAz: true,
			},
			securityGroups: [props.containerSG],
			circuitBreaker: {
				rollback: true,
			},
			capacityProviderStrategies: [
				{
					capacityProvider: 'FARGATE_SPOT',
					weight: 2,
				},
				{
					capacityProvider: 'FARGATE',
					weight: 1,
				},
			],
			healthCheckGracePeriod: Duration.seconds(60),
			enableExecuteCommand: true,
		});

		// Application Load Balancer (AWS ALB)
		this.alb = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
			loadBalancerName: createName('elb', 'alb'),
			vpc: props.vpc,
			securityGroup: props.albSG,
			internetFacing: true,
		});

		// Se crea el grupo de destino
		const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
			targetGroupName: createName('elb', 'http-tg'),
			vpc: props.vpc,
			port: 8000,
			targets: [service],
			healthCheck: {
				enabled: true,
				interval: Duration.seconds(60),
				path: '/login',
			},
		});

		// Se configura la persistencia de sesiones
		targetGroup.setAttribute('stickiness.enabled', 'true');
		targetGroup.setAttribute('stickiness.type', 'lb_cookie');
		targetGroup.setAttribute('stickiness.lb_cookie.duration_seconds', '86400');

		// Se crean los listeners para http y https
		const httpListener = this.alb.addListener('HttpListener', {
			port: 80,
			open: true,
			protocol: elbv2.ApplicationProtocol.HTTP,
			defaultAction: elbv2.ListenerAction.redirect({
				port: '443',
				protocol: elbv2.ApplicationProtocol.HTTPS,
				permanent: true,
			}),
		});

		const httpsListener = this.alb.addListener('HttpsListener', {
			port: 443,
			open: true,
			protocol: elbv2.ApplicationProtocol.HTTPS,
			certificates: [props.hrmgoCertificate],
			defaultTargetGroups: [targetGroup],
		});
	}
}
