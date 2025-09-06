export default () => ({
	environment: process.env.NODE_ENV || 'development',
	port: parseInt(process.env.PORT || '3000', 10),
	database: {
		host: process.env.DB_HOST || 'localhost',
		port: parseInt(process.env.DB_PORT || '5432', 10),
		username: process.env.DB_USER || 'postgres',
		password: process.env.DB_PASS || 'root',
		name: process.env.DB_NAME || 't20',
	},
	jwt: {
		secret: process.env.JWT_SECRET || 'change_this_in_production',
		expiresIn: process.env.JWT_EXPIRES_IN || '7d',
	},
});


