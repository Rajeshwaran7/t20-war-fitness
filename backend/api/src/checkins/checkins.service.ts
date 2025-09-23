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

    async getAttendanceHistoryForAllMembers(filters: { 
        startDate?: string; 
        endDate?: string; 
        memberId?: string;
        page: number;
        limit: number;
    }) {
        // Build the base query
        let query = this.checkinsRepo
            .createQueryBuilder('checkin')
            .leftJoinAndSelect('checkin.member', 'member')
            .orderBy('checkin.checkinAt', 'DESC');

        // Apply date filters
        if (filters.startDate && filters.endDate) {
            query = query.andWhere('DATE(checkin.checkinAt) BETWEEN :startDate AND :endDate', {
                startDate: filters.startDate,
                endDate: filters.endDate
            });
        }

        // Apply member ID filter if provided
        if (filters.memberId) {
            query = query.andWhere('member.memberId = :memberId', { memberId: filters.memberId });
        }

        // Get total count for pagination
        const total = await query.getCount();

        // Apply pagination
        query = query
            .skip((filters.page - 1) * filters.limit)
            .take(filters.limit);

        // Execute the query
        const attendanceRecords = await query.getMany();
        
        // Process the records to include calculated fields
        const data = attendanceRecords.map(record => {
            let duration = null;
            let hours = null;
            
            if (record.checkoutAt) {
                const checkInTime = new Date(record.checkinAt).getTime();
                const checkOutTime = new Date(record.checkoutAt).getTime();
                duration = Math.round((checkOutTime - checkInTime) / (1000 * 60)); // in minutes
                hours = Math.round((duration / 60) * 100) / 100; // in hours with 2 decimal places
            }

            return {
                id: record.id,
                memberId: record.member.memberId,
                memberName: record.member.name,
                checkinAt: record.checkinAt,
                checkoutAt: record.checkoutAt,
                duration: duration,
                hours: hours,
                date: record.checkinAt.toISOString().split('T')[0]
            };
        });

        return {
            data,
            total,
            page: filters.page,
            limit: filters.limit
        };
    }
}



