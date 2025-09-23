import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentMethod } from './payment.entity';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { IsDateString, IsNumber, IsPositive, IsOptional, IsIn } from 'class-validator';

class RecordPaymentDto {
    @IsNumber()
    @IsPositive()
    amount: number;

    @IsDateString()
    paidOn: string;

    @IsOptional()
    @IsIn(['cash', 'digital'])
    method?: 'cash' | 'digital';
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post(':memberId')
    @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER)
    record(@Param('memberId') memberId: string, @Body() dto: RecordPaymentDto) {
        const method = dto.method === 'digital' ? PaymentMethod.DIGITAL : PaymentMethod.CASH;
        return this.paymentsService.record(memberId, dto.amount +0.02, dto.paidOn, method);
    }

    @Get(':memberId')
    @Roles(UserRole.ADMIN, UserRole.GYM_MANAGER, UserRole.MEMBER)
    list(
        @Param('memberId') memberId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('sort') sort?: string, // 'asc' or 'desc'
    ) {
        const sortOrder = sort === 'asc' ? 'ASC' : 'DESC'; // Default to DESC if not specified or invalid
        return this.paymentsService.listForMember(
            memberId, 
            page ? parseInt(page, 10) : undefined, 
            limit ? parseInt(limit, 10) : undefined,
            sortOrder
        );
    }
}



