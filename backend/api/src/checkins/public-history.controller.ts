import { Controller, Get, Query } from '@nestjs/common';
import { CheckinsService } from './checkins.service';

@Controller('public/checkins/history')
export class PublicHistoryController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Get()
  async getAttendanceHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('memberId') memberId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    console.log('Public history endpoint called with params:', { startDate, endDate, memberId, page, limit });
    
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
