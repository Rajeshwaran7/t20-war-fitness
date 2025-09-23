import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment, PaymentMethod } from './payment.entity';
import { Member, MemberStatus } from '../members/member.entity';
import { MembershipPeriod, PeriodStatus } from '../members/membership-period.entity';

@Injectable()
export class PaymentsService {
    constructor(
        @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
        @InjectRepository(Member) private readonly membersRepo: Repository<Member>,
        @InjectRepository(MembershipPeriod) private readonly periodsRepo: Repository<MembershipPeriod>,
        private readonly dataSource: DataSource,
    ) {}

    async record(memberId: string, amount: number, paidOn: string, method: PaymentMethod = PaymentMethod.CASH) {
        return this.dataSource.transaction(async (manager) => {
            const membersRepo = manager.getRepository(Member);
            const paymentsRepo = manager.getRepository(Payment);
            const periodsRepo = manager.getRepository(MembershipPeriod);

            const member = await membersRepo.findOne({ where: { id: memberId } });
            if (!member) throw new NotFoundException('Member not found');

            // Find the active membership period
            const activePeriod = await periodsRepo.findOne({ 
                where: { member: { id: memberId }, status: PeriodStatus.ACTIVE }
            });
            
            // If no active period, try to find the most recent period
            if (!activePeriod) {
                const latestPeriod = await periodsRepo.findOne({
                    where: { member: { id: memberId } },
                    order: { endDate: 'DESC' }
                });
                
                if (!latestPeriod) {
                    throw new NotFoundException('No membership period found for this member');
                }
                
                console.log(`No active period found. Using latest period with ID: ${latestPeriod.id}`);
                return this.recordPaymentWithPeriod(manager, member, latestPeriod, amount, paidOn, method);
            }
            
            return this.recordPaymentWithPeriod(manager, member, activePeriod, amount, paidOn, method);
        });
    }

    private async recordPaymentWithPeriod(
        manager: any, 
        member: Member, 
        membershipPeriod: MembershipPeriod, 
        amount: number, 
        paidOn: string, 
        method: PaymentMethod
    ) {
        const membersRepo = manager.getRepository(Member);
        const paymentsRepo = manager.getRepository(Payment);
        const periodsRepo = manager.getRepository(MembershipPeriod);

        // simple dedupe: same amount+date within last minute
        const dup = await paymentsRepo.findOne({ 
            where: { 
                member: { id: member.id }, 
                membershipPeriod: { id: membershipPeriod.id },
                amount, 
                paidOn 
            } 
        });
        if (dup) return dup;

        // Create payment with proper membership period reference
        const payment = paymentsRepo.create({ 
            member, 
            membershipPeriod,
            amount: amount, 
            paidOn, 
            method 
        });
        const saved = await paymentsRepo.save(payment);

        // Ensure amount is a proper number
        const paymentAmount = Number(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            throw new Error('Invalid payment amount');
        }

        // Update member's total fees paid
        const oldMemberFeesPaid = Number(member.feesPaid || 0);
        const newMemberFeesPaid = oldMemberFeesPaid + paymentAmount;
        member.feesPaid = newMemberFeesPaid;
        
        const planFees = Number((member.membershipPlan as any)?.fees ?? 0);
        const newMemberDueAmount = Math.max(0, planFees - newMemberFeesPaid);
        member.dueAmount = newMemberDueAmount;
        
        // If payment settles the due amount and member is expired/soon to expire, 
        // check if end date is in the future and update status to active
        if (newMemberDueAmount === 0 && 
            (member.status === MemberStatus.EXPIRED || member.status === MemberStatus.SOON_TO_EXPIRE)) {
            
            const endDate = new Date(member.endDate);
            const now = new Date();
            
            if (endDate > now) {
                console.log(`Payment settled dues. Updating member status to active.`);
                console.log(`  Previous status: ${member.status}`);
                console.log(`  End date: ${member.endDate} (${endDate > now ? 'future' : 'past'})`);
                
                member.status = MemberStatus.ACTIVE;
            }
        }
        
        console.log(`Payment processing - Member: ${member.id}`);
        console.log(`  Old fees paid: ${oldMemberFeesPaid}, Payment: ${paymentAmount}, New fees paid: ${newMemberFeesPaid}`);
        console.log(`  Plan fees: ${planFees}, New due amount: ${newMemberDueAmount}`);
        
        // Update the membership period's fees paid and due amount
        const oldPeriodFeesPaid = Number(membershipPeriod.feesPaid || 0);
        const newPeriodFeesPaid = oldPeriodFeesPaid + paymentAmount;
        membershipPeriod.feesPaid = newPeriodFeesPaid;
        
        const periodPlanFees = Number(membershipPeriod.planFees || 0);
        const newPeriodDueAmount = Math.max(0, periodPlanFees - newPeriodFeesPaid);
        membershipPeriod.dueAmount = newPeriodDueAmount;
        
        console.log(`Payment processing - Period: ${membershipPeriod.id}`);
        console.log(`  Old fees paid: ${oldPeriodFeesPaid}, Payment: ${paymentAmount}, New fees paid: ${newPeriodFeesPaid}`);
        console.log(`  Period plan fees: ${periodPlanFees}, New due amount: ${newPeriodDueAmount}`);
        
        // Save both entities in the correct order
        await membersRepo.save(member);
        await periodsRepo.save(membershipPeriod);

        return saved;
    }

    async listForMember(memberId: string, page?: number, limit?: number, sortOrder: 'ASC' | 'DESC' = 'DESC') {
        const qb = this.paymentsRepo.createQueryBuilder('p')
            .leftJoin('p.member', 'm')
            .where('m.id = :memberId', { memberId })
            .orderBy('p.paidOn', sortOrder)
            .addOrderBy('p.createdAt', sortOrder);
        if (page || limit) {
            const p = page && page > 0 ? page : 1;
            const l = limit && limit > 0 ? Math.min(limit, 100) : 10;
            qb.skip((p - 1) * l).take(l);
            const [data, total] = await qb.getManyAndCount();
            return { data, total, page: p, limit: l };
        }
        return qb.getMany();
    }
}



