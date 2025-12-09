import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '../../users/enums/role.enum';

@Injectable()
export class JwtRolesGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthed = (await super.canActivate(context)) as boolean;
    if (!isAuthed) {
      return false;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: { role: Role } }>();
    const user = req.user;
    if (!user || !user.role) {
      throw new ForbiddenException('No role assigned to user');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`You cannot access this resource`);
    }

    return true;
  }
}
