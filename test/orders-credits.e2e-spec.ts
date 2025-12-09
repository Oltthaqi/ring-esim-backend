import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Orders - Complete with Credits (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginResponse = await request(app.getServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.access_token;
    userId = loginResponse.body.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders/:orderId/complete-with-credits', () => {
    it('should complete order when credits + promo reduce total to 0.00', async () => {
      const orderResponse = await request(app.getServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageTemplateId: 'test-package-id',
          amount: 1.99,
          currency: 'EUR',
          promoCode: 'TEST50CENT',
          rewardType: 'NONE',
          creditsToUse: 1.49,
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      const completeResponse = await request(app.getServer())
        .post(`/orders/${orderId}/complete-with-credits`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', `test-complete-${orderId}`)
        .send({})
        .expect(200);

      expect(completeResponse.body).toMatchObject({
        orderId,
        status: 'PAID',
        creditsCaptured: '1.49',
        currency: 'EUR',
      });

      const orderCheck = await request(app.getServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(orderCheck.body.status).toBe('COMPLETED');
      expect(orderCheck.body.paymentStatus).toBe('succeeded');
    });

    it('should return 409 when credits insufficient', async () => {
      const orderResponse = await request(app.getServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageTemplateId: 'test-package-id',
          amount: 4.99,
          currency: 'EUR',
          creditsToUse: 1.0,
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      const completeResponse = await request(app.getServer())
        .post(`/orders/${orderId}/complete-with-credits`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', `test-incomplete-${orderId}`)
        .send({})
        .expect(409);

      expect(completeResponse.body).toMatchObject({
        orderId,
        status: 'AWAITING_PAYMENT',
        requires_external_payment: true,
        currency: 'EUR',
      });
      expect(parseFloat(completeResponse.body.amount_due)).toBeGreaterThan(0);
    });

    it('should be idempotent with same idempotency key', async () => {
      const orderResponse = await request(app.getServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageTemplateId: 'test-package-id',
          amount: 1.49,
          currency: 'EUR',
          creditsToUse: 1.49,
        })
        .expect(201);

      const orderId = orderResponse.body.id;
      const idempotencyKey = `idempotent-${orderId}`;

      const firstResponse = await request(app.getServer())
        .post(`/orders/${orderId}/complete-with-credits`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({})
        .expect(200);

      const secondResponse = await request(app.getServer())
        .post(`/orders/${orderId}/complete-with-credits`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({})
        .expect(200);

      expect(firstResponse.body).toEqual(secondResponse.body);
    });

    it('should handle decimal precision correctly (1.99 - 1.49 - 0.50 = 0.00)', async () => {
      const orderResponse = await request(app.getServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          packageTemplateId: 'test-package-id',
          amount: 1.99,
          currency: 'EUR',
          promoCode: 'TEST50CENT',
          creditsToUse: 1.49,
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      const completeResponse = await request(app.getServer())
        .post(`/orders/${orderId}/complete-with-credits`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', `decimal-test-${orderId}`)
        .send({})
        .expect(200);

      expect(completeResponse.body.creditsCaptured).toBe('1.49');
      expect(completeResponse.body.status).toBe('PAID');
    });
  });
});
