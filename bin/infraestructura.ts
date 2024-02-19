#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraestructuraStack } from '../lib/infraestructura-stack';

const app = new cdk.App();
new InfraestructuraStack(app, 'InfraestructuraStack');
