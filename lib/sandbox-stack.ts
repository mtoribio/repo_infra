import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createName } from '../utils/createName';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface SandBoxStackProps extends StackProps {
	env: { region: string; project: string; environment: string };
	vpc: ec2.Vpc;
	bastionHostSG: ec2.SecurityGroup;
}

export class SandBoxStack extends Stack {
	constructor(scope: Construct, id: string, props: SandBoxStackProps) {
		super(scope, id, props);

		// SE CREA EL PAR DE CLAVES EN AWS EC2 Y LA PRIVATE KEY SE GUARDA EN AWS SYSTEMS MANAGER (PARAMETER STORE)
		const keyPair = new ec2.KeyPair(this, 'KeyPair', {
			keyPairName: createName('ec2', 'key-pair'),
			type: ec2.KeyPairType.RSA,
			format: ec2.KeyPairFormat.PEM,
		});

		// AWS EC2 - BASTION HOST
		const instance = new ec2.Instance(this, 'EC2Instance', {
			vpc: props.vpc,
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
			machineImage: new ec2.AmazonLinuxImage({
				generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023, // user = ec2-user
			}),
			securityGroup: props.bastionHostSG,
			instanceName: createName('ec2', 'bastion-host'),
			vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
			keyPair,
		});

		instance.addToRolePolicy(
			new iam.PolicyStatement({
				actions: ['secretsmanager:GetSecretValue'],
				effect: iam.Effect.ALLOW,
				resources: ['*'],
			})
		);
	}
}
