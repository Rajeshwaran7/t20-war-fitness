import { Controller, Param, Post, Get, UseGuards, Query } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums/role.enum';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('checkins')
export class CheckinsController {
    constructor(private readonly checkinsService: CheckinsService) {}

    @Post(':memberId/checkin')
    @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
    checkIn(@Param('memberId') memberId: string) {
        return this.checkinsService.checkIn(memberId);
    }

    @Post(':memberId/checkout')
    @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
    checkOut(@Param('memberId') memberId: string) {
        return this.checkinsService.checkOut(memberId);
    }

    @Get(':memberId/history')
    @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER, UserRole.MEMBER)
    history(@Param('memberId') memberId: string) {
        return this.checkinsService.history(memberId);
    }

    @Get(':memberId/attendance-history')
    @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER, UserRole.MEMBER)
    attendanceHistory(
        @Param('memberId') memberId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
    ) {
        const filters: any = {};
        if (startDate && endDate) {
            filters.startDate = startDate;
            filters.endDate = endDate;
        } else if (month && year) {
            filters.month = parseInt(month);
            filters.year = parseInt(year);
        }
        return this.checkinsService.getAttendanceHistory(memberId, filters);
    }
}



