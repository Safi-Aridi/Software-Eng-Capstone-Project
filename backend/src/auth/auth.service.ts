import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  register(body: any) {
    return {
      success: true,
      message: 'Register endpoint reserved and working',
      receivedData: body,
    };
  }

  login(body: any) {
    const user = {
      id: body.userId || 'demo-user-id',
      email: body.email || 'demo@example.com',
      role: body.role || 'citizen',
    };

    const token = this.jwtService.sign(user);

    return {
      success: true,
      message: 'Login successful',
      token,
      user,
    };
  }

  me(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const user = this.jwtService.verify(token);

      return {
        success: true,
        message: 'Current user retrieved successfully',
        user,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  logout() {
    return {
      success: true,
      message: 'Logout endpoint reserved and working',
    };
  }
}