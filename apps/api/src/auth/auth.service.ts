import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async generateRegistrationOptions(email: string) {
    return {
      challenge: 'mock-challenge-phase-0',
      rp: { name: 'REKA', id: 'localhost' },
      user: { id: 'mock-id', name: email, displayName: email },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    };
  }

  async generateAuthenticationOptions() {
    return {
      challenge: 'mock-challenge-phase-0',
      rpId: 'localhost',
    };
  }
}
