import assert from 'assert';
import { StatusCodes } from 'http-status-codes';
import session from 'supertest-session';

import helper from '../../helper.js';
import app from '../../../app.js';
import models from '../../../models/index.js';

describe('/api/stops/:StopId/resources', () => {
  let testSession;

  beforeEach(async function () {
    this.timeout(10000);
    await helper.loadUploads([
      ['512x512.png', 'cdd8007d-dcaf-4163-b497-92d378679668.png'],
      ['testing123.m4a', 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a'],
    ]);
    await helper.loadFixtures([
      'users',
      'invites',
      'invites',
      'teams',
      'memberships',
      'resources',
      'files',
      'tours',
      'stops',
      'tourStops',
      'stopResources',
    ]);
    // wait for async optimization of fixture PNG to complete
    await helper.sleep(2000);
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
    it('returns StopResources for a Stop', async () => {
      const response = await testSession
        .get('/api/stops/e39b97ad-a5e9-422c-b256-d50fec355285/resources')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);

      assert.deepStrictEqual(response.body, [
        {
          id: '3f2cb117-a9d8-4d2e-80c2-5b9461b975f5',
          StopId: 'e39b97ad-a5e9-422c-b256-d50fec355285',
          ResourceId: '6ebacda9-8d33-4c3e-beb5-18dffb119046',
          start: 0,
          end: null,
          pauseAtEnd: false,
          options: {},
          Resource: {
            TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
            id: '6ebacda9-8d33-4c3e-beb5-18dffb119046',
            name: 'Resource 2',
            type: 'AUDIO',
            data: {},
            variants: [
              {
                code: 'en-us',
                displayName: 'English',
                name: 'English (US)',
              },
            ],
            Files: [
              {
                id: '84b62056-05a4-4751-953f-7854ac46bc0f',
                ResourceId: '6ebacda9-8d33-4c3e-beb5-18dffb119046',
                variant: 'en-us',
                externalURL: null,
                key: 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a',
                keyURL: '/api/assets/files/84b62056-05a4-4751-953f-7854ac46bc0f/key/d2e150be-b277-4f68-96c7-22a477e0022f.m4a',
                optimizedKey: null,
                optimizedKeyURL: null,
                originalName: null,
                duration: null,
                width: null,
                height: null,
                URL: '/api/assets/files/84b62056-05a4-4751-953f-7854ac46bc0f/key/d2e150be-b277-4f68-96c7-22a477e0022f.m4a',
              },
            ],
            createdAt: response.body[0].Resource.createdAt,
            updatedAt: response.body[0].Resource.updatedAt,
            archivedAt: null,
          },
        },
        {
          id: '407bc47d-2dfe-4567-b6ed-027deb802944',
          StopId: 'e39b97ad-a5e9-422c-b256-d50fec355285',
          ResourceId: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
          start: 0,
          end: null,
          pauseAtEnd: false,
          options: {},
          Resource: {
            TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
            id: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
            name: 'Resource 1',
            type: 'IMAGE',
            data: {},
            variants: [
              {
                code: 'en-us',
                displayName: 'English',
                name: 'English (US)',
              },
            ],
            Files: [
              {
                id: 'ed2f158a-e44e-432d-971e-e5da1a2e33b4',
                ResourceId: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
                variant: 'en-us',
                externalURL: null,
                key: 'cdd8007d-dcaf-4163-b497-92d378679668.png',
                keyURL: '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668.png',
                optimizedKey: 'cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
                optimizedKeyURL:
                  '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
                originalName: null,
                duration: null,
                width: null,
                height: null,
                URL: '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
              },
            ],
            createdAt: response.body[1].Resource.createdAt,
            updatedAt: response.body[1].Resource.updatedAt,
            archivedAt: null,
          },
        },
      ]);
    });
  });

  describe('POST /', () => {
    it('creates a new StopResource association', async () => {
      const response = await testSession
        .post('/api/stops/bba84716-633e-4593-85a0-9da4010eb99b/resources')
        .set('Accept', 'application/json')
        .send({
          ResourceId: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
        })
        .expect(StatusCodes.CREATED);

      assert.deepStrictEqual(response.body, {
        id: response.body.id,
        StopId: 'bba84716-633e-4593-85a0-9da4010eb99b',
        ResourceId: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
        start: 0,
        end: null,
        pauseAtEnd: false,
        options: {},
        Resource: {
          id: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
          TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          name: 'Resource 1',
          type: 'IMAGE',
          data: {},
          variants: [
            {
              code: 'en-us',
              displayName: 'English',
              name: 'English (US)',
            },
          ],
          Files: [
            {
              id: 'ed2f158a-e44e-432d-971e-e5da1a2e33b4',
              ResourceId: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
              variant: 'en-us',
              externalURL: null,
              key: 'cdd8007d-dcaf-4163-b497-92d378679668.png',
              keyURL: '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668.png',
              optimizedKey: 'cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
              optimizedKeyURL:
                '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
              originalName: null,
              duration: null,
              width: null,
              height: null,
              URL: '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
            },
          ],
          createdAt: response.body.Resource.createdAt,
          updatedAt: response.body.Resource.updatedAt,
          archivedAt: null,
        },
      });
    });
  });

  describe('PATCH /:id', () => {
    it('updates a StopResource association', async () => {
      const response = await testSession
        .patch('/api/stops/e39b97ad-a5e9-422c-b256-d50fec355285/resources/407bc47d-2dfe-4567-b6ed-027deb802944')
        .set('Accept', 'application/json')
        .send({
          start: 0,
          end: 30,
          options: {
            fit: 'cover',
          },
        })
        .expect(StatusCodes.OK);

      assert.deepStrictEqual(response.body, {
        id: '407bc47d-2dfe-4567-b6ed-027deb802944',
        StopId: 'e39b97ad-a5e9-422c-b256-d50fec355285',
        ResourceId: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
        start: 0,
        end: 30,
        pauseAtEnd: false,
        options: {
          fit: 'cover',
        },
        Resource: {
          Files: [
            {
              ResourceId: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
              URL: '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
              externalURL: null,
              id: 'ed2f158a-e44e-432d-971e-e5da1a2e33b4',
              key: 'cdd8007d-dcaf-4163-b497-92d378679668.png',
              keyURL: '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668.png',
              optimizedKey: 'cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
              optimizedKeyURL:
                '/api/assets/files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668-optimized.jpg',
              originalName: null,
              duration: null,
              width: null,
              height: null,
              variant: 'en-us',
            },
          ],
          TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          id: '0cb2ce76-c5ca-454f-9fb1-47051b0f21ab',
          name: 'Resource 1',
          type: 'IMAGE',
          data: {},
          variants: [
            {
              code: 'en-us',
              displayName: 'English',
              name: 'English (US)',
            },
          ],
          createdAt: response.body.Resource.createdAt,
          updatedAt: response.body.Resource.updatedAt,
          archivedAt: null,
        },
      });
    });
  });

  describe('DELETE /:id', () => {
    it('removes a StopResource association', async () => {
      await testSession
        .delete('/api/stops/e39b97ad-a5e9-422c-b256-d50fec355285/resources/407bc47d-2dfe-4567-b6ed-027deb802944')
        .set('Accept', 'application/json')
        .expect(StatusCodes.NO_CONTENT);

      assert.deepStrictEqual(await models.StopResource.findByPk('407bc47d-2dfe-4567-b6ed-027deb802944'), null);
    });
  });
});
