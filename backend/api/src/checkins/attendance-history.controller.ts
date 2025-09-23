import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums/role.enum';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('checkins/history')
export class AttendanceHistoryController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
  async getAttendanceHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('memberId') memberId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    return this.checkinsService.getAttendanceHistoryForAllMembers({
      startDate,
      endDate,
      memberId,
      page: pageNum,
      limit: limitNum,
    });
  }
}
