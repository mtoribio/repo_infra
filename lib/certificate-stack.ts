import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ssm from "aws-cdk-lib/aws-ssm";

export interface CertificateStackProps extends StackProps {
    env: {
        region: string;
        project: string;
        environment: string;
        domainName: string;
    };
}

export class CertificateStack extends Stack {
    public readonly hrmgoCertificate: acm.ICertificate;

    constructor(scope: Construct, id: string, props: CertificateStackProps) {
        super(scope, id, props);

        const parameterName = `hrmgo-${props.env.region}-ps-${props.env.environment}-certificate-arn`;

        const certificateArn = ssm.StringParameter.fromStringParameterName(
            this,
            "CertificateARN",
            parameterName
        ).stringValue;

        this.hrmgoCertificate = acm.Certificate.fromCertificateArn(
            this,
            "Certificate",
            certificateArn
        );
    }
}
