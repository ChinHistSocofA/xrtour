import assert from 'assert';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import session from 'supertest-session';

import helper from '../../helper.js';
import app from '../../../app.js';
import models from '../../../models/index.js';

describe('/api/versions', () => {
  let testSession;

  beforeEach(async () => {
    await helper.loadUploads([
      ['512x512.png', 'cdd8007d-dcaf-4163-b497-92d378679668.png'],
      ['testing123.m4a', 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a'],
    ]);
    await helper.loadFixtures([
      'users',
      'invites',
      'teams',
      'memberships',
      'tours',
      'stops',
      'tourStops',
      'resources',
      'files',
      'stopResources',
      'versions',
    ]);
    testSession = session(app);
    await testSession
      .post('/api/auth/login')
      .set('Accept', 'application/json')
      .send({ email: 'regular.user@test.com', password: 'abcd1234' })
      .expect(StatusCodes.OK);
  });

  afterEach(async () => {
    await helper.cleanAssets();
  });

  describe('GET /', () => {
    it('returns a list of Versions for a specified Tour', async () => {
      const response = await testSession
        .get('/api/versions?TourId=ae61f3e7-7de7-40e2-b9a1-c5ad9ff94806')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 2);
      assert.deepStrictEqual(response.body[0].id, '6e5fafaa-fa8e-4d46-a17a-38916f4b99e4');
      assert.deepStrictEqual(response.body[1].id, '2abf432a-9eb2-4bd9-86d9-12645c2d62c7');
    });

    it('returns a list of staging Versions for a specified Tour', async () => {
      const response = await testSession
        .get('/api/versions?TourId=ae61f3e7-7de7-40e2-b9a1-c5ad9ff94806&isStaging=true')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 1);
      assert.deepStrictEqual(response.body[0].id, '2abf432a-9eb2-4bd9-86d9-12645c2d62c7');
    });

    it('returns a list of production Versions for a specified Tour', async () => {
      const response = await testSession
        .get('/api/versions?TourId=ae61f3e7-7de7-40e2-b9a1-c5ad9ff94806&isStaging=false')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 1);
      assert.deepStrictEqual(response.body[0].id, '6e5fafaa-fa8e-4d46-a17a-38916f4b99e4');
    });
  });

  describe('POST /', () => {
    it('creates a new Version', async () => {
      const data = {
        TourId: '495b18a8-ae05-4f44-a06d-c1809add0352',
        isStaging: false,
      };
      const response = await testSession.post('/api/versions').set('Accept', 'application/json').send(data).expect(StatusCodes.CREATED);

      assert(response.body?.id);
      assert.deepStrictEqual(response.body, {
        ...data,
        id: response.body.id,
        isLive: true,
        passwordHash: null,
        createdAt: response.body.createdAt,
      });

      const record = await models.Version.findByPk(response.body.id);
      assert(record);
      assert.deepStrictEqual(record.isLive, true);
      assert.deepStrictEqual(record.isStaging, false);

      const tourData = JSON.stringify(record.data);
      const regex = /"URL":"\/api\/assets\/(versions\/[a-f0-9-]+\/files\/[a-f0-9-]+\/key\/[^"]+)"/g;
      const matches = tourData.match(regex);
      assert.deepStrictEqual(matches?.length, 2);
      assert(
        await helper.assetPathExists(
          path.join(
            'versions',
            record.id,
            'files',
            'ed2f158a-e44e-432d-971e-e5da1a2e33b4',
            'key',
            'cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg'
          )
        )
      );
      assert(
        await helper.assetPathExists(
          path.join(
            'versions',
            record.id,
            'files',
            '84b62056-05a4-4751-953f-7854ac46bc0f',
            'key',
            'd2e150be-b277-4f68-96c7-22a477e0022f.m4a'
          )
        )
      );
    });

    it('replaces any prior live Version', async () => {
      const data = {
        TourId: 'ae61f3e7-7de7-40e2-b9a1-c5ad9ff94806',
        isStaging: true,
      };
      const response = await testSession.post('/api/versions').set('Accept', 'application/json').send(data).expect(StatusCodes.CREATED);

      assert(response.body?.id);
      assert.deepStrictEqual(response.body, {
        ...data,
        id: response.body.id,
        isLive: true,
        passwordHash: null,
        createdAt: response.body.createdAt,
      });

      const record = await models.Version.findByPk(response.body.id);
      assert(record);
      assert.deepStrictEqual(record.isLive, true);
      assert.deepStrictEqual(record.isStaging, true);

      const prevRecord = await models.Version.findByPk('2abf432a-9eb2-4bd9-86d9-12645c2d62c7');
      assert.deepStrictEqual(prevRecord?.isLive, false);
    });
  });

  describe('GET /:id', () => {
    it('returns a Version by id', async () => {
      const response = await testSession
        .get('/api/versions/6e5fafaa-fa8e-4d46-a17a-38916f4b99e4')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);

      const data = { ...response.body };
      assert.deepStrictEqual(data, {
        id: '6e5fafaa-fa8e-4d46-a17a-38916f4b99e4',
        TourId: 'ae61f3e7-7de7-40e2-b9a1-c5ad9ff94806',
        isStaging: false,
        isLive: false,
        passwordHash: null,
        createdAt: '2022-01-29T22:58:56.000Z',
      });
    });
  });

  describe('PATCH /:id', () => {
    it('updates a Version by id', async () => {
      const response = await testSession
        .patch('/api/versions/6e5fafaa-fa8e-4d46-a17a-38916f4b99e4')
        .send({
          isLive: true,
        })
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.isLive, true);

      const record = await models.Version.findByPk('6e5fafaa-fa8e-4d46-a17a-38916f4b99e4');
      assert.deepStrictEqual(record.isLive, true);
    });
  });
});
