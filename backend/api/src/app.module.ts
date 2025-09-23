import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CheckinsModule } from './checkins/checkins.module';
import { PaymentsModule } from './payments/payments.module';
import { MembershipPlansModule } from './membership-plans/membership-plans.module';
import { MembersModule } from './members/members.module';
import { SeedModule } from './seeds/seed.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [configuration],
		}),
		TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
		UsersModule,
		AuthModule,
		MembershipPlansModule,
		MembersModule,
		CheckinsModule,
		PaymentsModule,
        SeedModule,
        TasksModule,
	],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
