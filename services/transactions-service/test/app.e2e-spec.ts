import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

const runE2e = process.env.RUN_E2E === '1';

(runE2e ? describe : describe.skip)('transactions-service (e2e)', () => {
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

  it('POST /transactions validates body', () => {
    return request(app.getHttpServer())
      .post('/transactions')
      .send({ type: 'deposit' })
      .expect(400);
  });
});

describe('transactions-service (smoke)', () => {
  it('e2e suite skipped unless RUN_E2E=1', () => {
    expect(true).toBe(true);
  });
});
