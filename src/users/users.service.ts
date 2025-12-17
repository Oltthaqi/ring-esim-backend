import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersEntity } from './entitites/users.entity';
import { In, Like, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import PagableParamsDto from 'src/common/dto/pagable-params.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Status } from 'src/common/enums/status.enum';
import { Role } from './enums/role.enum';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
  ) {}

  private randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generates a unique 6-character alphanumeric referral code
   */
  private async generateReferralCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!isUnique && attempts < maxAttempts) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(
          Math.floor(Math.random() * characters.length),
        );
      }

      // Check if code already exists
      const existingUser = await this.usersRepository.findOne({
        where: { referral_code: code },
      });

      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique || !code) {
      throw new Error(
        'Failed to generate unique referral code after multiple attempts',
      );
    }

    return code;
  }

  async register(
    userDto: Partial<CreateUserDto>,
    cryptedPassword?: string,
  ): Promise<UsersEntity> {
    if (!cryptedPassword) {
      const saltRounds = this.randomInteger(10, 14);
      const salt = await bcrypt.genSalt(saltRounds);
      if (!userDto.password) {
        throw new Error('Password is required for registration');
      }
      cryptedPassword = await bcrypt.hash(userDto.password, salt);
    }

    // Generate unique referral code for the new user
    const referralCode = await this.generateReferralCode();

    // Handle referral tracking if a referral code is provided
    let referredByUserId: string | null = null;
    if (userDto.referral_code) {
      const referrer = await this.usersRepository.findOne({
        where: { referral_code: userDto.referral_code.toUpperCase() },
      });

      if (referrer) {
        referredByUserId = referrer.id;
      }
      // Note: We don't throw an error if referral code is invalid,
      // we just don't set the referred_by_user_id
    }

    const user = this.usersRepository.create({
      ...userDto,
      password: cryptedPassword,
      is_verified: userDto.is_verified ?? false,
      role: userDto.role ? (userDto.role as Role) : Role.USER,
      referral_code: referralCode,
      referred_by_user_id: referredByUserId,
    });

    const registeredUser = await this.usersRepository.save(user);

    const mappedUser = await this.usersRepository.findOne({
      where: { id: registeredUser.id },
      select: [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'role',
        'is_verified',
        'referral_code',
        'created_at',
        'updated_at',
      ],
    });

    if (!mappedUser) {
      throw new NotFoundException('User not found after registration');
    }

    return mappedUser;
  }

  async getUserByEmail(email: string): Promise<UsersEntity | null> {
    const user = await this.usersRepository.findOne({
      where: {
        email,
        is_deleted: false,
      },
    });

    return user;
  }
  async getUsersByEmail(email: string[]): Promise<UsersEntity[] | null> {
    return await this.usersRepository.find({
      where: {
        email: In(email),
        is_deleted: false,
      },
    });
  }

  async getUserByEmailVerified(email: string): Promise<UsersEntity | null> {
    const user = await this.usersRepository.findOne({
      where: {
        email,
        is_deleted: false,
        is_verified: true,
      },
    });

    return user;
  }
  async getUserById(id: string): Promise<UsersEntity | null> {
    const user = await this.usersRepository.findOne({
      where: {
        id,
        is_deleted: false,
      },
      select: [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'gender',
        'is_verified',
        'created_at',
        'updated_at',
        'is_deleted',
        'status',
        'role',
        'referral_code',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getMainDataByUserId(id: string): Promise<UsersEntity | null> {
    const user = await this.usersRepository.findOne({
      where: {
        id,
        is_deleted: false,
      },
      select: [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'gender',
        'is_verified',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getUserByForVerifyId(id: string): Promise<UsersEntity | null> {
    const user = await this.usersRepository.findOne({
      where: {
        id,
        is_deleted: false,
      },
      select: [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'gender',
        'is_verified',
        'created_at',
        'updated_at',
        'is_deleted',
        'status',
      ],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
  async getAllUsers(
    params: PagableParamsDto,
  ): Promise<{ data: UsersEntity[]; total: number }> {
    const { page, limit, search, status } = params;

    const [data, total] = await this.usersRepository.findAndCount({
      where: {
        is_deleted: false,
        ...(search ? { first_name: Like(`%${search}%`) } : {}),
        ...(status ? { status: status } : {}),
      },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total };
  }

  async updateUserVerification(id: string): Promise<UsersEntity | null> {
    const user = await this.getUserByForVerifyId(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.update(id, {
      ...user,
      is_verified: true,
    });

    const updatedUser = await this.getUserByForVerifyId(id);
    return updatedUser;
  }

  async updateUserPassword(
    id: string,
    password: string,
  ): Promise<UsersEntity | null> {
    const user = await this.getUserByForVerifyId(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.update(id, {
      ...user,
      password,
    });

    const updatedUser = await this.getUserByForVerifyId(id);
    return updatedUser;
  }

  async updateUser(
    id: string,
    userDto: UpdateUserDto,
  ): Promise<UsersEntity | null> {
    console.log('userDto', userDto);
    const user = await this.getUserByForVerifyId(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.update(id, {
      ...user,
      ...userDto,
    });

    const updatedUser = await this.getUserByForVerifyId(id);
    return updatedUser;
  }

  async assignRole(user_id: string): Promise<UsersEntity | null> {
    const user = await this.usersRepository.findOne({
      where: { id: user_id, is_deleted: false },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${user_id} not found`);
    }

    return user;
  }

  async changeAccountStatus(id: string): Promise<UsersEntity | null> {
    const user = await this.getUserByForVerifyId(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.status =
      user.status === Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;

    return this.usersRepository.save(user);
  }

  async getUserCompanies(user_id: string): Promise<UsersEntity | null> {
    await this.getUserById(user_id);
    const user = await this.usersRepository.findOne({
      where: { id: user_id, is_deleted: false },
      relations: ['companies'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
