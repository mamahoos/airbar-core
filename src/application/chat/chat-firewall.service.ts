import { Injectable } from '@nestjs/common';

export type ChatFirewallAction = 'ALLOW' | 'MASK' | 'BLOCK';
export type ChatViolationReason =
  | 'PHONE'
  | 'URL'
  | 'SOCIAL_HANDLE'
  | 'OFF_PLATFORM_PAYMENT'
  | 'OFF_PLATFORM_CONTACT';

export interface ChatFirewallInput {
  readonly content: string;
  readonly shipmentStatus?: string | null | undefined;
}

export interface ChatFirewallDecision {
  readonly action: ChatFirewallAction;
  readonly content: string;
  readonly reasons: readonly ChatViolationReason[];
}

const PHONE_PATTERN = /(?:\+?98|0)?9(?:[\s\-_.()]?\d){9}\b|\+\d(?:[\s\-_.()]?\d){6,14}\b/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+|\b[\w.-]+\.(?:com|ir|net|org|io|app|me|co)\b/gi;
const SOCIAL_HANDLE_PATTERN = /(?:^|[\s(])@[a-zA-Z0-9_]{4,32}\b|(?:t\.me|telegram\.me|wa\.me|instagram\.com)\/\S+/gi;
const PAYMENT_PATTERN =
  /(?:کارت\s*به\s*کارت|کارت\s*بزن|شماره\s*کارت|واریز\s*کن|پرداخت\s*بیرون|بیرون\s*حساب|خارج\s*از\s*برنامه|خارج\s*از\s*پلتفرم|cash|bank\s*transfer|card\s*to\s*card)/i;
const CONTACT_PATTERN =
  /(?:واتساپ|تلگرام|اینستاگرام|شماره\s*(?:تلفن|موبایل)?|زنگ\s*بزن|تماس\s*بگیر|پیام\s*بده|whatsapp|telegram|instagram|call\s*me|text\s*me)/i;

const PAID_CHAT_STATUSES = new Set([
  'ACCEPTED',
  'PAYMENT_PENDING',
  'PAID',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CONFIRMED',
]);

@Injectable()
export class ChatFirewallService {
  evaluate(input: ChatFirewallInput): ChatFirewallDecision {
    const reasons = this.detect(input.content);
    if (reasons.length === 0) {
      return { action: 'ALLOW', content: input.content, reasons };
    }

    const paymentSecured = input.shipmentStatus
      ? PAID_CHAT_STATUSES.has(input.shipmentStatus)
      : false;
    if (!paymentSecured) {
      return { action: 'BLOCK', content: input.content, reasons };
    }

    return { action: 'MASK', content: this.mask(input.content), reasons };
  }

  private detect(content: string): ChatViolationReason[] {
    const reasons = new Set<ChatViolationReason>();
    if (PHONE_PATTERN.test(content)) reasons.add('PHONE');
    if (URL_PATTERN.test(content)) reasons.add('URL');
    if (SOCIAL_HANDLE_PATTERN.test(content)) reasons.add('SOCIAL_HANDLE');
    if (PAYMENT_PATTERN.test(content)) reasons.add('OFF_PLATFORM_PAYMENT');
    if (CONTACT_PATTERN.test(content)) reasons.add('OFF_PLATFORM_CONTACT');
    this.resetPatterns();
    return [...reasons];
  }

  private mask(content: string): string {
    const masked = content
      .replace(PHONE_PATTERN, '[شماره تماس حذف شد]')
      .replace(URL_PATTERN, '[لینک حذف شد]')
      .replace(SOCIAL_HANDLE_PATTERN, '[شناسه اجتماعی حذف شد]');
    this.resetPatterns();
    return masked;
  }

  private resetPatterns(): void {
    PHONE_PATTERN.lastIndex = 0;
    URL_PATTERN.lastIndex = 0;
    SOCIAL_HANDLE_PATTERN.lastIndex = 0;
  }
}
