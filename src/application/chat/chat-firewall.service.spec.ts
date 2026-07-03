import { describe, expect, it } from '@jest/globals';

import { ChatFirewallService } from './chat-firewall.service.js';

describe('ChatFirewallService', () => {
  const firewall = new ChatFirewallService();

  it('allows normal operational messages', () => {
    const decision = firewall.evaluate({
      content: 'سلام، بسته سبک است و فردا تحویل می‌دهم.',
      shipmentStatus: 'MATCHED',
    });

    expect(decision.action).toBe('ALLOW');
    expect(decision.reasons).toEqual([]);
  });

  it('blocks phone numbers before payment is secured', () => {
    const decision = firewall.evaluate({
      content: 'شماره من 09123456789 است تماس بگیر',
      shipmentStatus: 'MATCHED',
    });

    expect(decision.action).toBe('BLOCK');
    expect(decision.reasons).toEqual(expect.arrayContaining(['PHONE', 'OFF_PLATFORM_CONTACT']));
  });

  it('blocks links and social handles before payment is secured', () => {
    const decision = firewall.evaluate({
      content: 'تلگرام بیا @airbar_test یا t.me/airbar',
      shipmentStatus: 'MATCHED',
    });

    expect(decision.action).toBe('BLOCK');
    expect(decision.reasons).toEqual(expect.arrayContaining(['SOCIAL_HANDLE', 'OFF_PLATFORM_CONTACT']));
  });

  it('masks contact details after offer acceptance', () => {
    const decision = firewall.evaluate({
      content: 'بعدا با 09123456789 هماهنگ کنیم و سایت example.com را ببین',
      shipmentStatus: 'ACCEPTED',
    });

    expect(decision.action).toBe('MASK');
    expect(decision.content).toContain('[شماره تماس حذف شد]');
    expect(decision.content).toContain('[لینک حذف شد]');
  });
});
