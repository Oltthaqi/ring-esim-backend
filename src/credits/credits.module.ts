import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { UserCreditsBalance } from './entities/user-credits-balance.entity';
import { UserCreditsLedger } from './entities/user-credits-ledger.entity';
import { UserCreditsReservation } from './entities/user-credits-reservation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserCreditsBalance,
      UserCreditsLedger,
      UserCreditsReservation,
    ]),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService], // Export for use in other modules (Orders, Payments)
})
export class CreditsModule {}
