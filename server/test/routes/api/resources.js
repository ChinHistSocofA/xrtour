import assert from 'assert';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import session from 'supertest-session';

import helper from '../../helper.js';
import app from '../../../app.js';
import models from '../../../models/index.js';

describe('/api/resources', () => {
  let testSession;

  beforeEach(async () => {
    await helper.loadUploads([
      ['512x512.png', 'cdd8007d-dcaf-4163-b497-92d378679668.png'],
      ['testing123.m4a', 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a'],
    ]);
    await helper.loadFixtures(['users', 'invites', 'teams', 'memberships', 'resources', 'files']);
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
    it('returns a list of Resources for a specified Team', async () => {
      const response = await testSession
        .get('/api/resources?TeamId=1a93d46d-89bf-463b-ab23-8f22f5777907')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 2);
      assert.deepStrictEqual(response.body[0].name, 'Resource 1');
      assert.deepStrictEqual(response.body[1].name, 'Resource 2');
    });

    it('returns a list of Resources of a specified type for a specified Team', async () => {
      const response = await testSession
        .get('/api/resources?TeamId=1a93d46d-89bf-463b-ab23-8f22f5777907&type=AUDIO')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 1);
      assert.deepStrictEqual(response.body[0].name, 'Resource 2');
    });

    it('returns a list of Resources of a specified type for a specified Team filtered by search query', async () => {
      let response = await testSession
        .get('/api/resources?TeamId=1a93d46d-89bf-463b-ab23-8f22f5777907&type=AUDIO&search=none')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 0);

      response = await testSession
        .get('/api/resources?TeamId=1a93d46d-89bf-463b-ab23-8f22f5777907&type=AUDIO&search=2')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 1);
      assert.deepStrictEqual(response.body[0].name, 'Resource 2');
    });
  });

  describe('POST /', () => {
    it('creates a new Resource', async () => {
      const data = {
        TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
        name: 'New Resource',
        type: 'LINK',
        variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        data: {},
      };
      const response = await testSession
        .post('/api/resources')
        .set('Accept', 'application/json')
        .send({
          ...data,
          Files: [
            {
              variant: 'en-us',
              externalURL: 'https://test.com',
            },
          ],
        })
        .expect(StatusCodes.CREATED);

      assert(response.body?.id);
      assert.deepStrictEqual(response.body, {
        ...data,
        id: response.body.id,
        createdAt: response.body.createdAt,
        updatedAt: response.body.updatedAt,
        archivedAt: null,
        Files: [response.body.Files[0]],
      });

      const record = await models.Resource.findByPk(response.body.id);
      assert(record);
      assert.deepStrictEqual(record.name, 'New Resource');
      assert.deepStrictEqual(record.type, 'LINK');

      const files = await record.getFiles();
      assert.deepStrictEqual(files.length, 1);
      assert.deepStrictEqual(files[0].variant, 'en-us');
      assert.deepStrictEqual(files[0].externalURL, 'https://test.com');
      assert.deepStrictEqual(files[0].URL, 'https://test.com');
    });

    it('validates the presence of the Resource name', async () => {
      const response = await testSession
        .post('/api/resources')
        .set('Accept', 'application/json')
        .send({
          TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          name: '',
          type: 'LINK',
          variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        })
        .expect(StatusCodes.UNPROCESSABLE_ENTITY);

      assert.deepStrictEqual(response.body, {
        errors: [
          {
            message: 'Name cannot be blank',
            path: 'name',
            value: '',
          },
        ],
        status: 422,
      });
    });

    it('validates the presence of the Resource type', async () => {
      const response = await testSession
        .post('/api/resources')
        .set('Accept', 'application/json')
        .send({
          TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          name: 'New Resource',
          type: '',
          variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        })
        .expect(StatusCodes.UNPROCESSABLE_ENTITY);

      assert.deepStrictEqual(response.body, {
        errors: [
          {
            message: 'Type cannot be blank',
            path: 'type',
            value: '',
          },
        ],
        status: 422,
      });
    });
  });

  describe('GET /:id', () => {
    it('returns a Resource by id', async () => {
      const response = await testSession
        .get('/api/resources/6ebacda9-8d33-4c3e-beb5-18dffb119046')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);

      const data = { ...response.body };
      assert.deepStrictEqual(data, {
        id: '6ebacda9-8d33-4c3e-beb5-18dffb119046',
        TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
        name: 'Resource 2',
        type: 'AUDIO',
        data: {},
        variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        Files: [
          {
            ResourceId: '6ebacda9-8d33-4c3e-beb5-18dffb119046',
            URL: '/api/assets/files/84b62056-05a4-4751-953f-7854ac46bc0f/key/d2e150be-b277-4f68-96c7-22a477e0022f.m4a',
            externalURL: null,
            id: '84b62056-05a4-4751-953f-7854ac46bc0f',
            key: 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a',
            keyURL: '/api/assets/files/84b62056-05a4-4751-953f-7854ac46bc0f/key/d2e150be-b277-4f68-96c7-22a477e0022f.m4a',
            optimizedKey: null,
            optimizedKeyURL: null,
            originalName: null,
            duration: null,
            width: null,
            height: null,
            variant: 'en-us',
          },
        ],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        archivedAt: null,
      });
    });
  });

  describe('PATCH /:id', () => {
    it('updates a Resource and its Files', async () => {
      await helper.loadUploads([['testing123.m4a', '673c0753-f913-474f-9e99-de638fe35de7.m4a']]);
      const response = await testSession
        .patch('/api/resources/6ebacda9-8d33-4c3e-beb5-18dffb119046')
        .set('Accept', 'application/json')
        .send({
          name: 'Updated Resource 2',
          Files: [
            {
              id: '84b62056-05a4-4751-953f-7854ac46bc0f',
              originalName: 'test.m4a',
            },
            {
              variant: 'es-us',
              key: '673c0753-f913-474f-9e99-de638fe35de7.m4a',
              originalName: 'new.m4a',
            },
          ],
        })
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.name, 'Updated Resource 2');
      assert.deepStrictEqual(response.body.Files?.length, 2);
      response.body.Files.sort((a, b) => a.originalName.localeCompare(b.originalName));
      assert.deepStrictEqual(response.body.Files[0].originalName, 'new.m4a');
      assert.deepStrictEqual(response.body.Files[1].originalName, 'test.m4a');

      const record = await models.Resource.findByPk('6ebacda9-8d33-4c3e-beb5-18dffb119046');
      assert.deepStrictEqual(record?.name, 'Updated Resource 2');

      const files = await record.getFiles();
      assert.deepStrictEqual(files?.length, 2);
      files.sort((a, b) => a.originalName.localeCompare(b.originalName));
      assert.deepStrictEqual(files[0].originalName, 'new.m4a');
      assert.deepStrictEqual(files[1].originalName, 'test.m4a');
    });
  });

  describe('DELETE /:id', () => {
    it('deletes a Resource and its associated files', async () => {
      await testSession
        .delete('/api/resources/6ebacda9-8d33-4c3e-beb5-18dffb119046')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(await models.File.findByPk('84b62056-05a4-4751-953f-7854ac46bc0f'), null);
      assert.deepStrictEqual(
        await helper.assetPathExists(
          path.join('files', '84b62056-05a4-4751-953f-7854ac46bc0f', 'key', 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a')
        ),
        false
      );
    });

    it('returns an error if the Resource is still referenced', async () => {
      await helper.loadFixtures(['stops', 'stopResources']);
      const response = await testSession
        .delete('/api/resources/6ebacda9-8d33-4c3e-beb5-18dffb119046')
        .set('Accept', 'application/json')
        .expect(StatusCodes.UNPROCESSABLE_ENTITY);
      assert.deepStrictEqual(response.body.message, 'Unable to delete, still being used.');
      assert(
        await helper.assetPathExists(
          path.join('files', '84b62056-05a4-4751-953f-7854ac46bc0f', 'key', 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a')
        )
      );
    });
  });
});
