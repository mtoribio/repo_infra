import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { SesSmtpCredentials } from "@pepperize/cdk-ses-smtp-credentials";
import { createName } from "../utils/createName";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ses from "aws-cdk-lib/aws-ses";

export interface EmailStackProps extends StackProps {
    env: {
        region: string;
        project: string;
        environment: string;
        domainName: string;
        email: string;
    };
}

export class EmailStack extends Stack {
    constructor(scope: Construct, id: string, props: EmailStackProps) {
        super(scope, id, props);

        new ses.EmailIdentity(this, "Identity", {
            identity: ses.Identity.email(props.env.email),
        });

        const smtpCredentials = new secretsmanager.Secret(
            this,
            "SecretManagerToUserSES",
            {
                secretName: createName("sm", "smtp-credentials"),
                description: "SES Smtp Credentials",
                removalPolicy: RemovalPolicy.DESTROY,
            }
        );

        new SesSmtpCredentials(this, "SmtpCredentials", {
            secret: smtpCredentials,
            userName: createName("iam", "ses-user"),
        });
    }
}
