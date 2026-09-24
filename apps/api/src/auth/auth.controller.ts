import { Controller, Post, Body, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('passkey/register-options')
  getRegistrationOptions(@Body('email') email: string) {
    return this.authService.generateRegistrationOptions(email);
  }

  @Get('passkey/login-options')
  getLoginOptions() {
    return this.authService.generateAuthenticationOptions();
  }
}
