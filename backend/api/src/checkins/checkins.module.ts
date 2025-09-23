import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Checkin } from './checkin.entity';
import { Member } from '../members/member.entity';
import { CheckinsService } from './checkins.service';
import { CheckinsController } from './checkins.controller';
import { PublicCheckinsController } from './public-checkins.controller';
import { AttendanceHistoryController } from './attendance-history.controller';
import { PublicHistoryController } from './public-history.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Checkin, Member])],
    controllers: [CheckinsController, PublicCheckinsController, AttendanceHistoryController, PublicHistoryController],
    providers: [CheckinsService],
    exports: [CheckinsService],
})
export class CheckinsModule {}



