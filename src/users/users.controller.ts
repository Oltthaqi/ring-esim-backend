import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersEntity } from './entitites/users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Request } from 'express';
import { UsersService } from './users.service';
import PagableParamsDto from 'src/common/dto/pagable-params.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtRolesGuard } from 'src/auth/utils/jwt‑roles.guard';
import { Role } from './enums/role.enum';
import { Roles } from 'src/auth/utils/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async register(@Body() userDto: CreateUserDto): Promise<UsersEntity> {
    return await this.usersService.register(userDto);
  }

  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Get('/user-info')
  async getUserByToken(@Req() req: Request): Promise<UsersEntity | null> {
    const { uuid } = req.user as { uuid: string };
    return await this.usersService.getUserById(uuid);
  }

  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Get('/email/:email')
  async getUserByEmail(
    @Param('email') email: string,
  ): Promise<UsersEntity | null> {
    return await this.usersService.getUserByEmail(email);
  }
  // @Roles('Administrator')
  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Get('/all')
  async getAllUsers(
    @Query() pagableParams: PagableParamsDto,
  ): Promise<{ data: UsersEntity[]; total: number }> {
    return await this.usersService.getAllUsers(pagableParams);
  }

  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Patch('/update/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() userDto: UpdateUserDto,
  ): Promise<UsersEntity | null> {
    return await this.usersService.updateUser(id, userDto);
  }

  // @Roles('Administrator')
  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Get('/:id')
  async getUserById(@Param('id') id: string): Promise<UsersEntity | null> {
    return await this.usersService.getUserById(id);
  }

  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Patch('/status/:id')
  async changeAccountStatus(
    @Param('id') id: string,
  ): Promise<UsersEntity | null> {
    return await this.usersService.changeAccountStatus(id);
  }

  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Get('/user-companies/:user_id')
  async getUserCompanies(
    @Param('user_id') user_id: string,
  ): Promise<UsersEntity | null> {
    return await this.usersService.getUserCompanies(user_id);
  }
}
