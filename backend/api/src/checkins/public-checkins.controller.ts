import { Controller, Post, Body, BadRequestException, Get, Query } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { CheckinsService } from './checkins.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from '../members/member.entity';

class CheckInOutDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // ID, phone, email, or name
}

@Controller('public/attendance')
export class PublicCheckinsController {
  constructor(
    private readonly checkinsService: CheckinsService,
    @InjectRepository(Member) private readonly membersRepo: Repository<Member>,
  ) {}

  private async findMemberByIdentifier(identifier: string): Promise<Member> {
    // Try to find by memberID first (4-digit ID) - this should be the primary lookup method
    let member = await this.membersRepo.findOne({ where: { memberId: identifier } });
    if (member) return member;

    // Try by phone
    member = await this.membersRepo.findOne({ where: { phone: identifier } });
    if (member) return member;

    // Try by email
    member = await this.membersRepo.findOne({ where: { email: identifier } });
    if (member) return member;

    // No longer searching by UUID or name as per requirements
    throw new BadRequestException('Member not found. Please enter your Member ID, phone number, or email address.');
  }

  @Post('check-in')
  async checkIn(@Body() dto: CheckInOutDto) {
    if (!dto.identifier) {
      throw new BadRequestException('Member identifier is required');
    }

    const member = await this.findMemberByIdentifier(dto.identifier);
    return this.checkinsService.checkIn(member.id);
  }

  @Post('check-out')
  async checkOut(@Body() dto: CheckInOutDto) {
    if (!dto.identifier) {
      throw new BadRequestException('Member identifier is required');
    }

    const member = await this.findMemberByIdentifier(dto.identifier);
    return this.checkinsService.checkOut(member.id);
  }

  @Get('verify')
  async verifyMember(@Query('identifier') identifier: string) {
    if (!identifier) {
      throw new BadRequestException('Member identifier is required');
    }

    try {
      const member = await this.findMemberByIdentifier(identifier);
      
      // Check if member is currently checked in
      const currentCheckin = await this.checkinsService.getCurrentCheckin(member.id);
      
      // Get recent activity (last 5 check-ins)
      const recentActivity = await this.checkinsService.getRecentActivity(member.id, 5);
      
      return { 
        success: true, 
        member: {
          id: member.id,
          name: member.name,
          status: member.status,
          isCheckedIn: !!currentCheckin,
          currentCheckin: currentCheckin,
          recentActivity: recentActivity
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
