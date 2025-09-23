import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, Between } from 'typeorm';
import { Checkin } from './checkin.entity';
import { Member } from '../members/member.entity';

@Injectable()
export class CheckinsService {
    constructor(
        @InjectRepository(Checkin) private readonly checkinsRepo: Repository<Checkin>,
        @InjectRepository(Member) private readonly membersRepo: Repository<Member>,
    ) {}

    async checkIn(memberId: string): Promise<Checkin> {
        const member = await this.membersRepo.findOne({ where: { id: memberId } });
        if (!member) throw new NotFoundException('Member not found');

        const open = await this.checkinsRepo.findOne({ where: { member: { id: memberId }, checkoutAt: IsNull() } });
        if (open) throw new BadRequestException('Member already checked in');

        const checkin = this.checkinsRepo.create({ member, checkinAt: new Date() });
        return this.checkinsRepo.save(checkin);
    }

    async checkOut(memberId: string): Promise<Checkin> {
        const member = await this.membersRepo.findOne({ where: { id: memberId } });
        if (!member) throw new NotFoundException('Member not found');

        const open = await this.checkinsRepo.findOne({ where: { member: { id: memberId }, checkoutAt: IsNull() } });
        if (!open) throw new BadRequestException('No open check-in found');

        open.checkoutAt = new Date();
        return this.checkinsRepo.save(open);
    }

    async history(memberId: string) {
        const member = await this.membersRepo.findOne({ where: { id: memberId } });
        if (!member) throw new NotFoundException('Member not found');
        return this.checkinsRepo.find({ where: { member: { id: memberId } }, order: { checkinAt: 'DESC' } });
    }

    async getCurrentCheckin(memberId: string) {
        return this.checkinsRepo.findOne({ 
            where: { member: { id: memberId }, checkoutAt: IsNull() },
            relations: ['member']
        });
    }

    async getRecentActivity(memberId: string, limit: number = 5) {
        return this.checkinsRepo.find({ 
            where: { member: { id: memberId } },
            order: { checkinAt: 'DESC' },
            take: limit,
            relations: ['member']
        });
    }

    async getAttendanceHistory(memberId: string, filters?: {
        startDate?: string;
        endDate?: string;
        month?: number;
        year?: number;
    }) {
        const member = await this.membersRepo.findOne({ where: { id: memberId } });
        if (!member) throw new NotFoundException('Member not found');

        let whereCondition: any = { member: { id: memberId } };

        if (filters) {
            if (filters.startDate && filters.endDate) {
                whereCondition.checkinAt = Between(new Date(filters.startDate), new Date(filters.endDate));
            } else if (filters.month && filters.year) {
                const startOfMonth = new Date(filters.year, filters.month - 1, 1);
                const endOfMonth = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
                whereCondition.checkinAt = Between(startOfMonth, endOfMonth);
            }
        }

        const attendanceRecords = await this.checkinsRepo.find({
            where: whereCondition,
            order: { checkinAt: 'DESC' },
            relations: ['member']
        });

        // Calculate statistics
        let totalHours = 0;
        let completedSessions = 0;

        const processedRecords = attendanceRecords.map(record => {
            let duration = null;
            let hours = null;

            if (record.checkoutAt) {
                const durationMs = record.checkoutAt.getTime() - record.checkinAt.getTime();
                duration = Math.round(durationMs / (1000 * 60)); // minutes
                hours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100; // hours with 2 decimal places
                totalHours += hours;
                completedSessions++;
            }

            return {
                id: record.id,
                checkinAt: record.checkinAt,
                checkoutAt: record.checkoutAt,
                duration: duration, // in minutes
                hours: hours, // in hours
                date: record.checkinAt.toISOString().split('T')[0]
            };
        });

        return {
            records: processedRecords,
            statistics: {
                totalSessions: attendanceRecords.length,
                completedSessions,
                incompleteSessions: attendanceRecords.length - completedSessions,
                totalHours: Math.round(totalHours * 100) / 100,
                averageHours: completedSessions > 0 ? Math.round((totalHours / completedSessions) * 100) / 100 : 0
            }
        };
    }
}



