import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

export interface DistributionStackProps extends StackProps {
    env: {
        region: string;
        project: string;
        environment: string;
        domainName: string;
    };
    hrmgoCertificate: acm.ICertificate;
    alb: elbv2.ApplicationLoadBalancer;
    vpc: ec2.Vpc;
}

export class DistributionStack extends Stack {
    constructor(scope: Construct, id: string, props: DistributionStackProps) {
        super(scope, id, props);

        // AWS CloudFront
        const distribution = new cloudfront.Distribution(this, "CloudFront", {
            defaultBehavior: {
                origin: new LoadBalancerV2Origin(props.alb, {
                    connectionAttempts: 3,
                    connectionTimeout: Duration.seconds(10),
                    readTimeout: Duration.seconds(30),
                    keepaliveTimeout: Duration.seconds(5),
                    protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
                }),
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy:
                    cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
                responseHeadersPolicy:
                    cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
                compress: true,
            },
            priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
            domainNames: [props.env.domainName],
            certificate: props.hrmgoCertificate,
        });
    }
}
