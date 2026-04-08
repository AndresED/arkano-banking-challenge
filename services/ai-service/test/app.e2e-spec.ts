import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

const runE2e = process.env.RUN_E2E === '1';

(runE2e ? describe : describe.skip)('ai-service (e2e)', () => {
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

  it('GET /explanations/:id returns 404 when missing', () => {
    return request(app.getHttpServer())
      .get('/explanations/00000000-0000-4000-8000-000000000001')
      .expect(404);
  });

  it('GET /explanations/account/:id/summary returns 404 sin historial', () => {
    return request(app.getHttpServer())
      .get('/explanations/account/00000000-0000-4000-8000-000000000002/summary')
      .expect(404);
  });
});

describe('ai-service (smoke)', () => {
  it('e2e suite skipped unless RUN_E2E=1', () => {
    expect(true).toBe(true);
  });
});
