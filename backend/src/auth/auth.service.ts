import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 3;
const LOCK_INTERVAL_SQL = "INTERVAL '15 minutes'";

// Server-side defence: the frontend already enforces these rules in the
// signup UI, but any direct POST to /auth/register bypasses that — so we
// re-validate here before bcrypt-hashing or touching the DB.
function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 64) return 'Password must not exceed 64 characters.';
  if (/\s/.test(password)) return 'Password must not contain spaces.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit.';
  if (!/[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/`~]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}


interface UserRow {
  user_id: string;
  role_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  password_hash: string | null;
  national_id: string | null;
  account_status: string | null;
  failed_attempts: number | null;
  locked_until: Date | null;
  role_name: string;
}

interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  nationalId?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  private mapRoleToFrontend(roleName: string): string {
    const map: Record<string, string> = {
      citizen: 'citizen',
      mukhtar: 'mukhtar',
      gs_officer: 'officer',
      admin: 'admin',
    };
    return map[roleName] ?? roleName;
  }

  async register(body: RegisterBody) {
    if (!body?.email || !body?.password) {
      throw new ConflictException('Email and password are required');
    }

    const pwError = validatePassword(body.password);
    if (pwError) {
      throw new BadRequestException(pwError);
    }

    const existing = await this.db.query(
      'SELECT user_id FROM users WHERE email = $1',
      [body.email],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const inserted = await this.db.query(
      `INSERT INTO users (
         email, password_hash, role_id, first_name, last_name,
         phone, national_id, account_status, failed_attempts
       )
       VALUES ($1, $2, 1, $3, $4, $5, $6, 'active', 0)
       RETURNING user_id, email, first_name, last_name`,
      [
        body.email,
        passwordHash,
        body.firstName,
        body.lastName,
        body.phone,
        body.nationalId ?? null,
      ],
    );
    const user = inserted.rows[0] as {
      user_id: string;
      email: string;
      first_name: string;
      last_name: string;
    };

    await this.db.query(
      `INSERT INTO citizen_profiles (citizen_id, user_id)
       VALUES ($1, $1)
       ON CONFLICT (citizen_id) DO NOTHING`,
      [user.user_id],
    );

    const token = this.jwtService.sign({
      id: user.user_id,
      email: user.email,
      role: 'citizen',
    });

    return {
      success: true,
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: 'citizen',
        fullName: `${user.first_name} ${user.last_name}`.trim(),
      },
    };
  }

  async login(body: LoginBody) {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException({ message: 'Invalid credentials' });
    }

    const result = await this.db.query(
      `SELECT u.*, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = $1`,
      [body.email],
    );
    if (!result.rowCount) {
      throw new UnauthorizedException({ message: 'Invalid credentials' });
    }
    const user = result.rows[0] as UserRow;

    // Lockout handling
    if (user.account_status === 'locked') {
      const stillLocked =
        user.locked_until && new Date(user.locked_until).getTime() > Date.now();
      if (stillLocked) {
        throw new UnauthorizedException({
          message: 'Account locked',
          isLocked: true,
          lockedUntil: user.locked_until,
        });
      }
      await this.db.query(
        `UPDATE users
         SET account_status = 'active', failed_attempts = 0, locked_until = NULL
         WHERE user_id = $1`,
        [user.user_id],
      );
      user.account_status = 'active';
      user.failed_attempts = 0;
      user.locked_until = null;
    }

    if (!user.password_hash) {
      throw new UnauthorizedException({ message: 'Invalid credentials' });
    }
    const passwordOk = await bcrypt.compare(body.password, user.password_hash);
    if (!passwordOk) {
      const next = (user.failed_attempts ?? 0) + 1;
      if (next >= MAX_LOGIN_ATTEMPTS) {
        await this.db.query(
          `UPDATE users
           SET failed_attempts = $1,
               account_status = 'locked',
               locked_until = NOW() + ${LOCK_INTERVAL_SQL}
           WHERE user_id = $2`,
          [next, user.user_id],
        );
        throw new UnauthorizedException({
          message: 'Too many failed attempts. Your account has been locked.',
          isLocked: true,
          failedAttempts: next,
          remainingAttempts: 0,
        });
      }
      await this.db.query(
        'UPDATE users SET failed_attempts = $1 WHERE user_id = $2',
        [next, user.user_id],
      );
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        isLocked: false,
        failedAttempts: next,
        remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - next),
      });
    }

    // Success
    if ((user.failed_attempts ?? 0) !== 0 || user.locked_until) {
      await this.db.query(
        `UPDATE users
         SET failed_attempts = 0, locked_until = NULL, account_status = 'active'
         WHERE user_id = $1`,
        [user.user_id],
      );
    }

    const frontendRole = this.mapRoleToFrontend(user.role_name);

    const token = this.jwtService.sign({
      id: user.user_id,
      email: user.email,
      role: frontendRole,
    });

    return {
      success: true,
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: frontendRole,
        fullName: `${user.first_name} ${user.last_name}`.trim(),
      },
    };
  }

  me(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    const token = authHeader.split(' ')[1];
    try {
      const user = this.jwtService.verify(token);
      return { success: true, user };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  logout() {
    return { success: true };
  }
}
