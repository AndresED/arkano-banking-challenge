import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Full e2e against AppModule requires PostgreSQL and Kafka (see README).
 * Set RUN_E2E=1 and start docker-compose to run this suite.
 */
const runE2e = process.env.RUN_E2E === '1';

(runE2e ? describe : describe.skip)('accounts-service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /clients returns clientId', () => {
    return request(app.getHttpServer())
      .post('/clients')
      .send({ name: 'E2E User', email: `e2e-${Date.now()}@test.local` })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.clientId).toBeDefined();
      });
  });

  it('POST /accounts y GET /accounts/:id (saldo inicial 0)', async () => {
    const clientRes = await request(app.getHttpServer())
      .post('/clients')
      .send({ name: 'E2E Acc', email: `e2e-acc-${Date.now()}@test.local` })
      .expect(201);
    const clientId = clientRes.body.data.clientId as string;

    const accRes = await request(app.getHttpServer())
      .post('/accounts')
      .send({ clientId })
      .expect(201);
    const accountId = accRes.body.data.accountId as string;

    await request(app.getHttpServer())
      .get(`/accounts/${accountId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.accountId).toBe(accountId);
        expect(res.body.data.clientId).toBe(clientId);
        expect(res.body.data.balance).toBe(0);
      });
  });
});

describe('accounts-service (smoke)', () => {
  it('e2e suite skipped unless RUN_E2E=1', () => {
    expect(true).toBe(true);
  });
});
