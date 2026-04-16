import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../users/enums/role.enum';

export function assertResellerOwnsResource(
  user: { reseller_id?: string | null; role: string },
  resource: { resellerId: string },
): void {
  if (user.role === Role.SUPER_ADMIN) return;
  if (user.reseller_id !== resource.resellerId) {
    throw new ForbiddenException('Access denied');
  }
}
