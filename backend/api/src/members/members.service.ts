import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, DataSource } from 'typeorm';
import { Member, MemberStatus } from './member.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembershipPlan } from '../membership-plans/membership-plan.entity';
import { Payment, PaymentMethod } from '../payments/payment.entity';
import { MemberPlanHistory } from './member-plan-history.entity';
import { MembershipPeriod, PeriodStatus } from './membership-period.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class MembersService {
	constructor(
		@InjectRepository(Member) private readonly membersRepo: Repository<Member>,
		@InjectRepository(MembershipPlan) private readonly plansRepo: Repository<MembershipPlan>,
		private readonly dataSource: DataSource,
		private readonly emailService: EmailService,
	) {}

	async create(dto: CreateMemberDto): Promise<Member> {
		try {
			return await this.dataSource.transaction(async (manager) => {
				const plansRepo = manager.getRepository(MembershipPlan);
				const membersRepo = manager.getRepository(Member);
				const paymentsRepo = manager.getRepository(Payment);
				const periodsRepo = manager.getRepository(MembershipPeriod);

				// Check for existing email/phone
				if (dto.email) {
					const existingEmail = await membersRepo.findOne({ where: { email: dto.email } });
					if (existingEmail) throw new ConflictException('Email already exists');
				}
				if (dto.phone) {
					const existingPhone = await membersRepo.findOne({ where: { phone: dto.phone } });
					if (existingPhone) throw new ConflictException('Phone number already exists');
				}

				const plan = await plansRepo.findOne({ where: { id: dto.membershipPlanId } });
				if (!plan) throw new NotFoundException('Membership plan not found');

				// Generate unique 4-digit member ID
				const memberId = await this.generateUniqueMemberId(manager);
				
				// Calculate start and end dates based on plan duration
				const startDate = dto.startDate || new Date().toISOString().split('T')[0];
				const endDate = this.calculateEndDate(startDate, plan.durationDays);
				
				console.log(`Calculated dates for plan ${plan.name} (${plan.durationDays} days):`);
				console.log(`  Start: ${startDate}, End: ${endDate}`);

				const member = membersRepo.create({
					memberId,
					name: dto.name,
					age: dto.age,
					phone: dto.phone,
					email: dto.email,
					startDate: startDate,
					endDate: endDate,
					feesPaid: dto.feesPaid ?? 0,
					balanceDays: dto.balanceDays ?? this.calculateBalanceDays(startDate, endDate),
					status: dto.status ?? this.calculateStatus(endDate),
					membershipPlan: plan,
				});
				member.dueAmount = Math.max(0, Number(plan.fees) - Number(member.feesPaid || 0));
				const saved = await membersRepo.save(member);

				// Create initial membership period
				const membershipPeriod = periodsRepo.create({
					member: saved,
					membershipPlan: plan,
					startDate: dto.startDate,
					endDate: dto.endDate,
					planFees: Number(plan.fees),
					feesPaid: dto.feesPaid ?? 0,
					dueAmount: Math.max(0, Number(plan.fees) - Number(dto.feesPaid || 0)),
					status: PeriodStatus.ACTIVE,
					periodType: 'initial'
				});
				const savedPeriod = await periodsRepo.save(membershipPeriod);

				if (Number(dto.feesPaid || 0) > 0) {
					const paidOn = dto.startDate ?? new Date().toISOString().slice(0, 10);
					const payment = paymentsRepo.create({ 
						member: saved, 
						membershipPeriod: savedPeriod,
						amount: Number(dto.feesPaid), 
						paidOn, 
						method: PaymentMethod.CASH 
					});
					await paymentsRepo.save(payment);
				}

				// Send email notification
				await this.emailService.sendMemberWelcome(saved);

				return saved;
			});
		} catch (error) {
			if (error.code === '23505') { // PostgreSQL unique violation
				if (error.detail?.includes('email')) {
					throw new ConflictException('Email already exists');
				} else if (error.detail?.includes('phone')) {
					throw new ConflictException('Phone number already exists');
				}
			}
			throw error;
		}
	}

	async findAll(filter?: { id?: string; memberId?: string; name?: string; phone?: string; email?: string; status?: MemberStatus; minAge?: number; maxAge?: number; startFrom?: string; startTo?: string; endFrom?: string; endTo?: string; page?: number; limit?: number }): Promise<{ data: Member[]; total: number; page: number; limit: number }> {
		const qb = this.membersRepo.createQueryBuilder('m').leftJoinAndSelect('m.membershipPlan', 'plan');

		// Unified free-text search if front-end sent same query into multiple fields
		const q = filter?.name ?? filter?.email ?? filter?.phone ?? filter?.memberId ?? undefined;
		const sameQ = !!q &&
			(filter?.name === q) &&
			(filter?.email === undefined || filter?.email === q) &&
			(filter?.phone === undefined || filter?.phone === q) &&
			(filter?.memberId === undefined || filter?.memberId === q) &&
			(filter?.id === undefined || filter?.id === q);
		if (sameQ && q) {
			qb.andWhere(new Brackets((where) => {
				where.where('LOWER(m.name) LIKE :q', { q: `%${q.toLowerCase()}%` })
					.orWhere('LOWER(m.email) LIKE :q', { q: `%${q.toLowerCase()}%` })
					.orWhere('m.phone LIKE :q', { q: `%${q}%` })
					.orWhere('m.memberId = :exactQ', { exactQ: q });
			}));
		} else {
			if (filter?.name) qb.andWhere('LOWER(m.name) LIKE :name', { name: `%${filter.name.toLowerCase()}%` });
			if (filter?.phone) qb.andWhere('m.phone LIKE :phone', { phone: `%${filter.phone}%` });
			if (filter?.email) qb.andWhere('LOWER(m.email) LIKE :email', { email: `%${filter.email.toLowerCase()}%` });
			if (filter?.memberId) qb.andWhere('m.memberId = :memberId', { memberId: filter.memberId });
			if (filter?.id && isUuidString(filter.id)) qb.andWhere('m.id = :id', { id: filter.id });
		}
		if (filter?.status) {
			qb.andWhere('m.status = :status', { status: filter.status });
		}
		if (filter?.minAge) qb.andWhere('m.age >= :minAge', { minAge: filter.minAge });
		if (filter?.maxAge) qb.andWhere('m.age <= :maxAge', { maxAge: filter.maxAge });
		if (filter?.startFrom) qb.andWhere('m.start_date >= :startFrom', { startFrom: filter.startFrom });
		if (filter?.startTo) qb.andWhere('m.start_date <= :startTo', { startTo: filter.startTo });
		if (filter?.endFrom) qb.andWhere('m.end_date >= :endFrom', { endFrom: filter.endFrom });
		if (filter?.endTo) qb.andWhere('m.end_date <= :endTo', { endTo: filter.endTo });
		// Priority ordering: expired first, then soon_to_expire, then active; within each, most recently updated
		qb.addSelect(`CASE 
			WHEN m.status = :expired THEN 0 
			WHEN m.status = :soon THEN 1 
			ELSE 2 END`, 'status_rank')
			.setParameters({ expired: MemberStatus.EXPIRED, soon: MemberStatus.SOON_TO_EXPIRE })
			.orderBy('status_rank', 'ASC')
			.addOrderBy('m.updatedAt', 'DESC');
		const page = filter?.page && filter.page > 0 ? filter.page : 1;
		const limit = filter?.limit && filter.limit > 0 ? Math.min(filter.limit, 100) : 10;
		qb.skip((page - 1) * limit).take(limit);
		const [rows, total] = await qb.getManyAndCount();
		const data = rows.map((m) => {
			const planFees = Number((m.membershipPlan as any)?.fees ?? 0);
			const feesPaid = Number(m.feesPaid ?? 0);
			const dueAmount = Math.max(0, planFees - feesPaid);
			return { ...m, planFees, dueAmount } as any;
		});
		return { data, total, page, limit };
	}

	async findOne(id: string): Promise<Member> {
		const member = await this.membersRepo.findOne({ where: { id } });
		if (!member) throw new NotFoundException('Member not found');
		const planFees = Number((member.membershipPlan as any)?.fees ?? 0);
		const feesPaid = Number(member.feesPaid ?? 0);
		const dueAmount = Math.max(0, planFees - feesPaid);
		return { ...(member as any), planFees, dueAmount } as any;
	}

	async update(id: string, dto: UpdateMemberDto): Promise<Member> {
		try {
			return await this.dataSource.transaction(async (manager) => {
				const membersRepo = manager.getRepository(Member);
				const plansRepo = manager.getRepository(MembershipPlan);
				const planHistoryRepo = manager.getRepository(MemberPlanHistory);

				const member = await membersRepo.findOne({ where: { id }, relations: ['membershipPlan'] });
				if (!member) throw new NotFoundException('Member not found');

				// Check for existing email/phone (excluding current member)
				if (dto.email) {
					const existingEmail = await membersRepo.findOne({ where: { email: dto.email } });
					if (existingEmail && existingEmail.id !== id) throw new ConflictException('Email already exists');
				}
				if (dto.phone) {
					const existingPhone = await membersRepo.findOne({ where: { phone: dto.phone } });
					if (existingPhone && existingPhone.id !== id) throw new ConflictException('Phone number already exists');
				}

				const fromPlan = member.membershipPlan;
				let isPlanSwitch = false;
				
				if (dto.membershipPlanId) {
					const newPlan = await plansRepo.findOne({ where: { id: dto.membershipPlanId } });
					if (!newPlan) throw new NotFoundException('Membership plan not found');
					
					// Check if this is a plan switch or renewal
					isPlanSwitch = fromPlan && fromPlan.id !== newPlan.id;
					
					if (isPlanSwitch) {
						// This is a plan switch - check if member has due amount
						const currentDueAmount = Math.max(0, Number(fromPlan?.fees ?? 0) - Number(member.feesPaid ?? 0));
						if (currentDueAmount > 0) {
							throw new BadRequestException(`Cannot change plan. Member has ₹${currentDueAmount} due amount. Please clear the due amount first.`);
						}
						
						// Create new membership period for plan switch
						const periodsRepo = manager.getRepository(MembershipPeriod);
						
						// Mark current period as completed
						const currentPeriod = await periodsRepo.findOne({ 
							where: { member: { id }, status: PeriodStatus.ACTIVE } 
						});
						if (currentPeriod) {
							currentPeriod.status = PeriodStatus.COMPLETED;
							await periodsRepo.save(currentPeriod);
						}
						
						// Calculate start and end dates based on plan duration
						const startDate = dto.startDate || new Date().toISOString().split('T')[0];
						const endDate = this.calculateEndDate(startDate, newPlan.durationDays);
						
						console.log(`Plan Switch: Calculated dates for ${newPlan.name} (${newPlan.durationDays} days):`);
						console.log(`  Start: ${startDate}, End: ${endDate}`);
						
						// Update member dates
						member.startDate = startDate;
						member.endDate = endDate;
						member.status = this.calculateStatus(endDate);
						member.balanceDays = this.calculateBalanceDays(startDate, endDate);
						
						// Create new membership period for plan switch
						const newPeriod = periodsRepo.create({
							member,
							membershipPlan: newPlan,
							startDate: startDate,
							endDate: endDate,
							planFees: Number(newPlan.fees),
							feesPaid: 0, // Fresh start
							dueAmount: Number(newPlan.fees),
							status: PeriodStatus.ACTIVE,
							periodType: 'plan_switch'
						});
						await periodsRepo.save(newPeriod);
						
						// Record plan change history
						const hist = planHistoryRepo.create({ member, fromPlan: fromPlan ?? null, toPlan: newPlan });
						await planHistoryRepo.save(hist);
						
						// Send plan change notification
						await this.emailService.sendPlanChangeNotification(
							member, 
							fromPlan?.name || 'No Plan', 
							newPlan.name
						);
						
						// Reset member's feesPaid for fresh start
						member.feesPaid = 0;
						console.log(`Plan Switch: Created new membership period for member ${member.id}`);
					}
					
					member.membershipPlan = newPlan;
				}

				// Remove feesPaid from dto to prevent editing
				const { feesPaid, ...updateData } = dto;
				
				// Check if this is a renewal (same plan, new dates)
				const isRenewal = !isPlanSwitch && (dto.startDate || dto.endDate);
				
				if (isRenewal) {
					// Renewal: Create new membership period
					const periodsRepo = manager.getRepository(MembershipPeriod);
					
					// Mark current period as completed
					const currentPeriod = await periodsRepo.findOne({ 
						where: { member: { id }, status: PeriodStatus.ACTIVE } 
					});
					if (currentPeriod) {
						currentPeriod.status = PeriodStatus.COMPLETED;
						await periodsRepo.save(currentPeriod);
					}
					
					// Calculate start and end dates based on plan duration
					const startDate = dto.startDate || new Date().toISOString().split('T')[0];
					const endDate = this.calculateEndDate(startDate, member.membershipPlan.durationDays);
					
					console.log(`Renewal: Calculated dates for ${member.membershipPlan.name} (${member.membershipPlan.durationDays} days):`);
					console.log(`  Start: ${startDate}, End: ${endDate}`);
					
					// Update member dates
					member.startDate = startDate;
					member.endDate = endDate;
					member.status = this.calculateStatus(endDate);
					member.balanceDays = this.calculateBalanceDays(startDate, endDate);
					
					// Create new membership period for renewal
					const newPeriod = periodsRepo.create({
						member,
						membershipPlan: member.membershipPlan,
						startDate: startDate,
						endDate: endDate,
						planFees: Number(member.membershipPlan.fees),
						feesPaid: 0, // Fresh start
						dueAmount: Number(member.membershipPlan.fees),
						status: PeriodStatus.ACTIVE,
						periodType: 'renewal'
					});
					await periodsRepo.save(newPeriod);
					
					// Reset member's feesPaid for fresh start
					member.feesPaid = 0;
					console.log(`Renewal: Created new membership period for member ${member.id}`);
				}
				
				Object.assign(member, updateData);
				if (dto.startDate || dto.endDate) {
					const start = dto.startDate ?? member.startDate;
					const end = dto.endDate ?? member.endDate;
					member.balanceDays = this.calculateBalanceDays(start, end);
					member.status = this.calculateStatus(end);
				}
				
				// Calculate due amount based on current plan
				const currentPlanFees = Number((member.membershipPlan as any)?.fees ?? 0);
				member.dueAmount = Math.max(0, currentPlanFees - Number(member.feesPaid || 0));
				
				return membersRepo.save(member);
			});
		} catch (error) {
			if (error.code === '23505') { // PostgreSQL unique violation
				if (error.detail?.includes('email')) {
					throw new ConflictException('Email already exists');
				} else if (error.detail?.includes('phone')) {
					throw new ConflictException('Phone number already exists');
				}
			}
			throw error;
		}
	}

	async getPlanHistory(memberId: string) {
		return this.dataSource.getRepository(MemberPlanHistory).find({
			where: { member: { id: memberId } as any },
			relations: ['fromPlan', 'toPlan'],
			order: { changedAt: 'DESC' },
		});
	}

	async getMembershipPeriods(memberId: string) {
		return this.dataSource.getRepository(MembershipPeriod).find({
			where: { member: { id: memberId } as any },
			relations: ['membershipPlan', 'payments'],
			order: { createdAt: 'DESC' }
		});
	}

	private async generateUniqueMemberId(manager?: any): Promise<string> {
		const membersRepo = manager ? manager.getRepository(Member) : this.membersRepo;
		
		// Find the highest existing member ID
		const lastMember = await membersRepo
			.createQueryBuilder('member')
			.select('member.memberId')
			.where('member.memberId IS NOT NULL')
			.orderBy('CAST(member.memberId AS INTEGER)', 'DESC')
			.limit(1)
			.getOne();

		let nextId = 1001; // Start from 1001
		if (lastMember && lastMember.memberId) {
			const lastId = parseInt(lastMember.memberId, 10);
			if (!isNaN(lastId)) {
				nextId = lastId + 1;
			}
		}

		// Ensure we don't exceed 4 digits
		if (nextId > 9999) {
			throw new Error('Cannot generate more member IDs. Maximum limit (9999) reached.');
		}

		// Check if this ID already exists (safety check)
		let memberId = nextId.toString();
		let existingMember = await membersRepo.findOne({ where: { memberId } });
		
		// If it exists, find the next available ID
		while (existingMember && nextId <= 9999) {
			nextId++;
			memberId = nextId.toString();
			existingMember = await membersRepo.findOne({ where: { memberId } });
		}

		if (nextId > 9999) {
			throw new Error('Cannot generate more member IDs. Maximum limit (9999) reached.');
		}

		return memberId;
	}

	private calculateBalanceDays(startDate: string, endDate: string): number {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const diffMs = end.getTime() - start.getTime();
		return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
	}

	private calculateEndDate(startDate: string, durationDays: number): string {
		const start = new Date(startDate);
		const end = new Date(start);
		end.setDate(start.getDate() + durationDays);
		return end.toISOString().split('T')[0]; // Format as YYYY-MM-DD
	}

	private calculateStatus(endDate: string): MemberStatus {
		const end = new Date(endDate).getTime();
		const now = Date.now();
		const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
		if (daysLeft < 0) return MemberStatus.EXPIRED;
		if (daysLeft <= 7) return MemberStatus.SOON_TO_EXPIRE;
		return MemberStatus.ACTIVE;
	}
}

function isUuidString(value: string): boolean {
    // Simple UUID v4 format check
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}


