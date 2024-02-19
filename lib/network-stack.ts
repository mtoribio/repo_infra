import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { createName } from "../utils/createName";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { aws_elasticache as elasticache } from "aws-cdk-lib";

export interface NetworkStackProps extends StackProps {
    env: { region: string; project: string; environment: string };
}

export class NetworkStack extends Stack {
    public readonly vpc: ec2.Vpc;
    public readonly containerSG: ec2.SecurityGroup;
    public readonly dbSG: ec2.SecurityGroup;
    public readonly albSG: ec2.SecurityGroup;
    public readonly elasticCacheSG: ec2.SecurityGroup;
    public readonly bastionHostSG: ec2.SecurityGroup;
    public readonly subnetGroup: elasticache.CfnSubnetGroup;

    constructor(scope: Construct, id: string, props: NetworkStackProps) {
        super(scope, id, props);

        this.vpc = new ec2.Vpc(this, "VirtualPrivateCloud", {
            vpcName: createName("vpc", "virtual-private-cloud"),
            maxAzs: 2,
            ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
        });

        this.dbSG = new ec2.SecurityGroup(this, "DataBaseSG", {
            securityGroupName: createName("sg", "db"),
            vpc: this.vpc,
        });

        this.dbSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(3306),
            "Permitir el acceso a MySQL desde cualquier lugar"
        );

        this.albSG = new ec2.SecurityGroup(this, "ApplicationLoadBalancerSG", {
            securityGroupName: createName("sg", "alb"),
            vpc: this.vpc,
        });

        this.albSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(80),
            "Permitir el acceso a cualquiera en el puerto 80"
        );

        this.albSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(443),
            "Permitir el acceso a cualquiera en el puerto 443"
        );

        this.elasticCacheSG = new ec2.SecurityGroup(this, "ElasticCacheSG", {
            securityGroupName: createName("sg", "elastic-cache"),
            vpc: this.vpc,
        });

        this.elasticCacheSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(6379),
            "Permitir el acceso a Redis desde cualquier lugar"
        );

        this.containerSG = new ec2.SecurityGroup(this, "ContainerSG", {
            securityGroupName: createName("sg", "container"),
            vpc: this.vpc,
        });

        this.containerSG.addIngressRule(
            this.dbSG,
            ec2.Port.tcp(3306),
            "Permitir el acceso de MySQL al contenedor"
        );

        this.containerSG.addIngressRule(
            this.elasticCacheSG,
            ec2.Port.tcp(6379),
            "Permitir el acceso de Redis al contenedor"
        );

        this.bastionHostSG = new ec2.SecurityGroup(this, "BastionHostSG", {
            securityGroupName: createName("sg", "bastion-host"),
            vpc: this.vpc,
        });

        this.bastionHostSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(22),
            "Permitir el acceso a traves de SSH"
        );

        this.subnetGroup = new elasticache.CfnSubnetGroup(this, "SubnetGroup", {
            description: "Grupo de subredes para cache",
            subnetIds: this.vpc.privateSubnets.map(({ subnetId }) => subnetId),
            cacheSubnetGroupName: createName("vpc", "subnet-group"),
        });
    }
}
