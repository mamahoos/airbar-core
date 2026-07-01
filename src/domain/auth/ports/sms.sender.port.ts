export interface SmsSenderPort {
  sendOtp(phone: string, code: string): Promise<boolean>;
}

export const SMS_SENDER = Symbol('SMS_SENDER');
