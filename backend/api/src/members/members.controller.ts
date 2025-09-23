import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberStatus } from './member.entity';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/enums/role.enum';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('members')
export class MembersController {
	constructor(private readonly membersService: MembersService) {}

	@Post()
	@Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
	create(@Body() dto: CreateMemberDto) {
		return this.membersService.create(dto);
	}

	@Get()
	@Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
	findAll(
		@Query('id') id?: string,
		@Query('memberId') memberId?: string,
		@Query('name') name?: string,
		@Query('phone') phone?: string,
		@Query('email') email?: string,
		@Query('status') status?: MemberStatus,
		@Query('minAge') minAge?: string,
		@Query('maxAge') maxAge?: string,
		@Query('startFrom') startFrom?: string,
		@Query('startTo') startTo?: string,
		@Query('endFrom') endFrom?: string,
		@Query('endTo') endTo?: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	) {
		return this.membersService.findAll({
			id,
			memberId,
			name,
			phone,
			email,
			status,
			minAge: minAge ? parseInt(minAge, 10) : undefined,
			maxAge: maxAge ? parseInt(maxAge, 10) : undefined,
			startFrom,
			startTo,
			endFrom,
			endTo,
			page: page ? parseInt(page, 10) : undefined,
			limit: limit ? parseInt(limit, 10) : undefined,
		});
	}

	@Get(':id')
	@Roles(UserRole.ADMIN, UserRole.GYM_MANAGER, UserRole.MEMBER)
	findOne(@Param('id') id: string) {
		return this.membersService.findOne(id);
	}

	@Put(':id')
	@Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
	update(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
		return this.membersService.update(id, dto);
	}

	// Allow editing of expired members for renewal (explicit endpoint optional; update already supports it)

	@Get(':id/plan-history')
	@Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
	getPlanHistory(@Param('id') id: string) {
		return this.membersService.getPlanHistory(id);
	}

	@Get(':id/membership-periods')
	@Roles(UserRole.ADMIN, UserRole.GYM_MANAGER, UserRole.MEMBER)
	getMembershipPeriods(@Param('id') id: string) {
		return this.membersService.getMembershipPeriods(id);
	}
}


