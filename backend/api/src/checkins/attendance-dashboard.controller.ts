import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Checkin } from './checkin.entity';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums/role.enum';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('attendance-dashboard')
export class AttendanceDashboardController {
  constructor(
    @InjectRepository(Checkin) private readonly checkinsRepo: Repository<Checkin>,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
  async getAttendanceRecords(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    let dateFilter = {};
    
    if (startDate && endDate) {
      // Custom date range filter
      dateFilter = {
        checkinAt: Between(new Date(startDate), new Date(endDate))
      };
    } else if (month && year) {
      // Month filter
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(yearNum)) {
        return { error: 'Invalid month or year' };
      }
      
      const startOfMonth = new Date(yearNum, monthNum - 1, 1);
      const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      
      dateFilter = {
        checkinAt: Between(startOfMonth, endOfMonth)
      };
    }

    const attendanceRecords = await this.checkinsRepo.find({
      where: dateFilter,
      relations: ['member'],
      order: { checkinAt: 'DESC' }
    });

    return attendanceRecords.map(record => ({
      id: record.id,
      memberId: record.member.id,
      memberName: record.member.name,
      checkinAt: record.checkinAt,
      checkoutAt: record.checkoutAt,
      duration: record.checkoutAt ? 
        Math.round((record.checkoutAt.getTime() - record.checkinAt.getTime()) / (1000 * 60)) : 
        null,
    }));
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
  async getAttendanceSummary(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    let dateFilter = {};
    let periodLabel = 'All time';
    
    if (startDate && endDate) {
      // Custom date range filter
      dateFilter = {
        checkinAt: Between(new Date(startDate), new Date(endDate))
      };
      periodLabel = `${startDate} to ${endDate}`;
    } else if (month && year) {
      // Month filter
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(yearNum)) {
        return { error: 'Invalid month or year' };
      }
      
      const startOfMonth = new Date(yearNum, monthNum - 1, 1);
      const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      
      dateFilter = {
        checkinAt: Between(startOfMonth, endOfMonth)
      };
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      periodLabel = `${monthNames[monthNum - 1]} ${yearNum}`;
    }

    const attendanceRecords = await this.checkinsRepo.find({
      where: dateFilter,
      relations: ['member'],
    });

    // Calculate unique members
    const uniqueMembers = new Set(attendanceRecords.map(record => record.member.id));
    
    // Calculate total check-ins
    const totalCheckins = attendanceRecords.length;
    
    // Calculate average duration
    let totalDuration = 0;
    let completedCheckouts = 0;
    
    attendanceRecords.forEach(record => {
      if (record.checkoutAt) {
        totalDuration += (record.checkoutAt.getTime() - record.checkinAt.getTime()) / (1000 * 60);
        completedCheckouts++;
      }
    });
    
    const averageDuration = completedCheckouts > 0 ? Math.round(totalDuration / completedCheckouts) : 0;
    
    // Get most active days
    const dayCount: Record<string, number> = {};
    attendanceRecords.forEach(record => {
      const day = record.checkinAt.toISOString().split('T')[0];
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    
    const mostActiveDays = Object.entries(dayCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([day, count]) => ({ day, count: count as number }));

    return {
      periodLabel,
      totalCheckins,
      uniqueMembers: uniqueMembers.size,
      averageDurationMinutes: averageDuration,
      completedCheckouts,
      incompleteCheckouts: totalCheckins - completedCheckouts,
      mostActiveDays
    };
  }
}
