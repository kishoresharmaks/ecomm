import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { ExpireRazorpayReservationsDto } from "./dto/payment-reservation-expiry.dto";
import { PaymentsService } from "./payments.service";

@Public()
@ApiTags("Internal Operations")
@Controller("internal/payments")
export class InternalPaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {}

  @Post("expire-razorpay-reservations")
  @ApiOperation({ summary: "Expire stale unpaid Razorpay order reservations." })
  expireRazorpayReservations(
    @Headers("x-internal-secret") secret: string | undefined,
    @Body() dto: ExpireRazorpayReservationsDto,
  ) {
    if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException("Invalid internal secret.");
    }

    return this.paymentsService.expireStaleRazorpayReservations({
      ...(dto.timeoutMinutes === undefined ? {} : { timeoutMinutes: dto.timeoutMinutes }),
      ...(dto.limit === undefined ? {} : { limit: dto.limit }),
    });
  }
}
