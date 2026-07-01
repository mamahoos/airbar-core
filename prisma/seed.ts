import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const cities = [
    { name: 'تهران', nameEn: 'Tehran', country: 'ایران', countryCode: 'IR', latitude: 35.6892, longitude: 51.389 },
    { name: 'اصفهان', nameEn: 'Isfahan', country: 'ایران', countryCode: 'IR', latitude: 32.6546, longitude: 51.668 },
    { name: 'شیراز', nameEn: 'Shiraz', country: 'ایران', countryCode: 'IR', latitude: 29.5918, longitude: 52.5837 },
    { name: 'مشهد', nameEn: 'Mashhad', country: 'ایران', countryCode: 'IR', latitude: 36.2605, longitude: 59.6168 },
    { name: 'استانبول', nameEn: 'Istanbul', country: 'ترکیه', countryCode: 'TR', latitude: 41.0082, longitude: 28.9784 },
    { name: 'دبی', nameEn: 'Dubai', country: 'امارات', countryCode: 'AE', latitude: 25.2048, longitude: 55.2708 },
  ];

  for (const city of cities) {
    await prisma.city.upsert({
      where: { name_country: { name: city.name, country: city.country } },
      update: {},
      create: city,
    });
  }

  const airports = [
    { code: 'IKA', name: 'فرودگاه امام خمینی', nameEn: 'Imam Khomeini International', city: 'تهران', country: 'ایران', countryCode: 'IR' },
    { code: 'IST', name: 'فرودگاه استانبول', nameEn: 'Istanbul Airport', city: 'استانبول', country: 'ترکیه', countryCode: 'TR' },
    { code: 'DXB', name: 'فرودگاه دبی', nameEn: 'Dubai International', city: 'دبی', country: 'امارات', countryCode: 'AE' },
  ];

  for (const airport of airports) {
    await prisma.airport.upsert({ where: { code: airport.code }, update: {}, create: airport });
  }

  const ruleCount = await prisma.pricingRule.count();
  if (ruleCount === 0) {
    await prisma.pricingRule.createMany({
      data: [
        {
          name: 'Domestic default',
          originCountry: 'ایران',
          destinationCountry: 'ایران',
          basePrice: 100_000,
          pricePerKg: 50_000,
          platformFeePercent: 10,
          minPlatformFee: 10_000,
          priority: 10,
        },
        {
          name: 'International default',
          basePrice: 200_000,
          pricePerKg: 80_000,
          riskMultiplier: 1.2,
          platformFeePercent: 10,
          minPlatformFee: 10_000,
          priority: 5,
        },
      ],
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
