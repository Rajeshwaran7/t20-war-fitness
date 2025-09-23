import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MembershipPlan } from '../membership-plans/membership-plan.entity';
import { Payment } from '../payments/payment.entity';
import { Checkin } from '../checkins/checkin.entity';
import { MembershipPeriod } from './membership-period.entity';

export enum MemberStatus {
	ACTIVE = 'active',
	EXPIRED = 'expired',
	SOON_TO_EXPIRE = 'soon_to_expire',
}

@Entity('members')
export class Member {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar', length: 4, unique: true, name: 'member_id' })
	memberId: string;

	@Column()
	name: string;

	@Column({ type: 'int' })
	age: number;

	@Column({ nullable: true, unique: true })
	phone?: string;

	@Column({ nullable: true, unique: true })
	email?: string;

	@Column({ type: 'date', name: 'start_date' })
	startDate: string;

	@Column({ type: 'date', name: 'end_date' })
	endDate: string;

	@Column({ type: 'enum', enum: MemberStatus, default: MemberStatus.ACTIVE })
	status: MemberStatus;

	@Column({ type: 'int', name: 'balance_days', default: 0 })
	balanceDays: number;

	@Column({ type: 'decimal', precision: 10, scale: 2, name: 'fees_paid', default: 0 })
	feesPaid: number;

	@Column({ type: 'decimal', precision: 10, scale: 2, name: 'due_amount', default: 0 })
	dueAmount: number;

	@ManyToOne(() => MembershipPlan, { eager: true, nullable: false })
	@JoinColumn({ name: 'membership_plan_id' })
	membershipPlan: MembershipPlan;

	@OneToMany(() => Payment, (payment) => payment.member)
	payments: Payment[];

	@OneToMany(() => MembershipPeriod, (period) => period.member)
	membershipPeriods: MembershipPeriod[];

	@OneToMany(() => Checkin, (checkin) => checkin.member)
	checkins: Checkin[];

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt: Date;
}


