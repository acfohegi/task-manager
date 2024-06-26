// @ts-check

import { faker } from '@faker-js/faker';

import testFastify from './helpers/app.js';
import { prepareData } from './helpers/data.js';

describe('test statuses CRUD', () => {
  let app;
  let knex;
  let models;

  beforeAll(async () => {
    app = await testFastify({ auth: true });
    knex = app.objection.knex;
    models = app.objection.models;
  });

  beforeEach(async () => {
    await knex.migrate.latest();
    await prepareData(app);
  });

  it('index', async () => {
    const response = await app.testGet(app.reverse('statuses'));
    expect(response.statusCode).toBe(200);
  });

  it('new', async () => {
    const response = await app.testGet(app.reverse('newStatus'));
    expect(response.statusCode).toBe(200);
  });

  it('create with no name', async () => {
    const params = { name: '' };
    const response = await app.testPost(app.reverse('statuses'), { data: params });

    const statusesCount = await models.status.query().count();
    expect(response.statusCode).toBe(200);
    const result = await models.status.query().count();
    expect(statusesCount).toStrictEqual(result);
  });

  it('create', async () => {
    const params = { name: faker.lorem.word() };
    const response = await app.testPost(app.reverse('statuses'), { data: params });

    expect(response.statusCode).toBe(302);
    const expected = params;
    const status = await models.status.query().findOne(params);
    expect(status).toMatchObject(expected);
  });

  afterEach(async () => {
    await knex.migrate.rollback();
  });

  afterAll(async () => {
    await app.close();
  });
});
