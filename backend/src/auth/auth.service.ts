import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  register(body: any) {
    return {
      success: true,
      message: 'Register endpoint reserved and working',
      receivedData: body,
    };
  }

  login(body: any) {
    return {
      success: true,
      message: 'Login endpoint reserved and working',
      receivedData: body,
      token: 'temporary-demo-token',
      user: {
        id: 'demo-user-id',
        role: body.role || 'citizen',
      },
    };
  }

  me() {
    return {
      success: true,
      message: 'Current user endpoint reserved and working',
      user: {
        id: 'demo-user-id',
        role: 'citizen',
      },
    };
  }

  logout() {
    return {
      success: true,
      message: 'Logout endpoint reserved and working',
    };
  }
}