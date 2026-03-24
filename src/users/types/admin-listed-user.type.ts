import { UsersEntity } from '../entitites/users.entity';

/**
 * GET /users/all list item shape.
 * JSON keys: credit_balance, credit_currency, referral_count (plus standard user fields).
 */
export type AdminListedUser = UsersEntity & {
  credit_balance: number;
  credit_currency: string;
  referral_count: number;
};
