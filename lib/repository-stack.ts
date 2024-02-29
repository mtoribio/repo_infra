import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createName } from '../bin/infrastructure';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export interface RepositoryStackProps extends StackProps {
	env: { region: string; project: string; environment: string };
}

export class RepositoryStack extends Stack {
	public readonly repository: ecr.Repository;

	constructor(scope: Construct, id: string, props: RepositoryStackProps) {
		super(scope, id, props);

		// Elastic Container Repository (AWS ECR)
		this.repository = new ecr.Repository(this, 'ECRRepository', {
			repositoryName: createName('ecr', 'repository'),
			emptyOnDelete: true,
			removalPolicy: RemovalPolicy.DESTROY,
		});
	}
}
