interface Environment {
	region: string;
	project: string;
	environment: string;
	dbName: string;
	dbUser: string;
	domainName: string;
	email: string;
}

export const environments: { [key: string]: Environment } = {
	dev: {
		region: 'us-east-2',
		project: 'hrmgo',
		environment: 'dev',
		dbName: 'hrm_go',
		dbUser: 'root',
		domainName: 'hrmgotest.overall.pe',
		email: 'notificaciones@overall.pe',
	},

	prod: {
		region: 'us-east-2',
		project: 'hrmgo',
		environment: 'prod',
		dbName: 'hrm_go',
		dbUser: 'root',
		domainName: 'hrmgo.overall.pe',
		email: 'notificaciones@overall.pe',
	},
};
