import assert from 'assert';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import session from 'supertest-session';
import path from 'path';
import { fileURLToPath } from 'url';

import helper from '../../helper.js';
import app from '../../../app.js';
import models from '../../../models/index.js';
import s3 from '../../../lib/s3.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('/api/tours', () => {
  let testSession;

  beforeEach(async () => {
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
    it('returns a list of Tours for a specified Team', async () => {
      const response = await testSession
        .get('/api/tours?TeamId=1a93d46d-89bf-463b-ab23-8f22f5777907')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);
      assert.deepStrictEqual(response.body.length, 2);
      assert.deepStrictEqual(response.body[0].link, 'tour1');
      assert.deepStrictEqual(response.body[1].link, 'tour2');
    });
  });

  describe('POST /', () => {
    it('creates a new Tour', async () => {
      const data = {
        TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
        name: 'Internal New Tour Name',
        link: 'newtour',
        names: { 'en-us': 'New Tour' },
        descriptions: { 'en-us': 'New Tour description' },
        variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        visibility: 'PRIVATE',
      };
      const response = await testSession.post('/api/tours').set('Accept', 'application/json').send(data).expect(StatusCodes.CREATED);

      assert(response.body?.id);
      assert.deepStrictEqual(response.body, {
        ...data,
        id: response.body.id,
        IntroStopId: null,
        CoverResourceId: null,
        createdAt: response.body.createdAt,
        updatedAt: response.body.updatedAt,
        archivedAt: null,
      });

      const record = await models.Tour.findByPk(response.body.id);
      assert(record);
      assert.deepStrictEqual(record.name, 'Internal New Tour Name');
      assert.deepStrictEqual(record.link, 'newtour');
    });

    it('validates the presence of the Tour name', async () => {
      const response = await testSession
        .post('/api/tours')
        .set('Accept', 'application/json')
        .send({
          TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          link: 'newtour',
          names: {},
          descriptions: { 'en-us': 'New Tour description' },
          variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
          visibility: 'PRIVATE',
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

    it('validates the uniqueness of the Tour link', async () => {
      const response = await testSession
        .post('/api/tours')
        .set('Accept', 'application/json')
        .send({
          TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          link: 'tour2',
          names: { 'en-us': 'New Tour' },
          descriptions: { 'en-us': 'New Tour description' },
          variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
          visibility: 'PRIVATE',
        })
        .expect(StatusCodes.UNPROCESSABLE_ENTITY);

      assert.deepStrictEqual(response.body, {
        errors: [
          {
            message: 'Link already taken',
            path: 'link',
            value: 'tour2',
          },
        ],
        status: 422,
      });
    });

    it('validates the format of the Team link', async () => {
      const response = await testSession
        .post('/api/tours')
        .set('Accept', 'application/json')
        .send({
          TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          link: 'invalid link',
          names: { 'en-us': 'New Tour' },
          descriptions: { 'en-us': 'New Tour description' },
          variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
          visibility: 'PRIVATE',
        })
        .expect(StatusCodes.UNPROCESSABLE_ENTITY);

      assert.deepStrictEqual(response.body, {
        errors: [
          {
            message: 'Letters, numbers, and hyphen only',
            path: 'link',
            value: 'invalid link',
          },
        ],
        status: 422,
      });
    });
  });

  describe('GET /:id', () => {
    it('returns a Tour by id', async () => {
      const response = await testSession
        .get('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352')
        .set('Accept', 'application/json')
        .expect(StatusCodes.OK);

      const data = { ...response.body };
      assert.deepStrictEqual(data, {
        id: '495b18a8-ae05-4f44-a06d-c1809add0352',
        TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
        CoverResourceId: null,
        IntroStopId: null,
        name: 'Tour 2',
        link: 'tour2',
        names: { 'en-us': 'Tour 2' },
        descriptions: { 'en-us': 'Tour 2 description' },
        variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        visibility: 'PRIVATE',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        archivedAt: null,
        Team: {
          id: '1a93d46d-89bf-463b-ab23-8f22f5777907',
          link: 'regularuser',
          favicon: null,
          faviconURL: null,
          name: "Regular's Personal Team",
          variants: [
            {
              code: 'en-us',
              displayName: 'English',
              name: 'English (US)',
            },
          ],
          font: null,
          colorPrimary: null,
          colorSecondary: null,
        },
      });
    });
  });

  describe('POST /translate', () => {
    it('translates a Tour name/description', async function () {
      if (process.env.CI) {
        return this.skip();
      }
      const response = await testSession
        .post('/api/tours/translate')
        .set('Accept', 'application/json')
        .send({
          source: 'en-us',
          target: 'es',
          data: {
            name: 'Tour 2',
            description: 'Tour 2 description',
          },
        })
        .expect(StatusCodes.OK);

      assert.deepStrictEqual(response.body, {
        name: 'Vuelta 2',
        description: 'Descripción del Tour 2',
      });
    });
  });

  describe('PATCH /:id', () => {
    it('updates a Tour by id', async () => {
      const data = {
        name: 'Updated Internal Tour Name',
        link: 'updatedtour',
        names: { 'en-us': 'Updated Tour' },
        descriptions: { 'en-us': 'Updated Tour description' },
        variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        visibility: 'UNLISTED',
      };
      const response = await testSession
        .patch('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352')
        .set('Accept', 'application/json')
        .send(data)
        .expect(StatusCodes.OK);

      assert.deepStrictEqual(response.body, {
        ...data,
        id: '495b18a8-ae05-4f44-a06d-c1809add0352',
        CoverResourceId: null,
        IntroStopId: null,
        TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
        Team: response.body.Team,
        createdAt: response.body.createdAt,
        updatedAt: response.body.updatedAt,
        archivedAt: null,
      });

      const record = await models.Tour.findByPk('495b18a8-ae05-4f44-a06d-c1809add0352');
      assert(record);
      assert.deepStrictEqual(record.name, 'Updated Internal Tour Name');
      assert.deepStrictEqual(record.link, 'updatedtour');
      assert.deepStrictEqual(record.names, { 'en-us': 'Updated Tour' });
      assert.deepStrictEqual(record.descriptions, { 'en-us': 'Updated Tour description' });
      assert.deepStrictEqual(record.variants, [{ name: 'English (US)', displayName: 'English', code: 'en-us' }]);
      assert.deepStrictEqual(record.visibility, 'UNLISTED');
    });

    it('updates all Tour Stops and Resources with new variants', async () => {
      const data = {
        variants: [
          { name: 'English (US)', displayName: 'English', code: 'en-us' },
          { name: 'Spanish', displayName: 'Español', code: 'es' },
        ],
      };
      await testSession
        .patch('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352')
        .set('Accept', 'application/json')
        .send(data)
        .expect(StatusCodes.OK);

      const record = await models.Tour.findByPk('495b18a8-ae05-4f44-a06d-c1809add0352', {
        include: [
          { model: models.Resource, as: 'CoverResource', include: 'Files' },
          {
            model: models.Stop,
            as: 'IntroStop',
            include: {
              model: models.StopResource,
              as: 'Resources',
              include: { model: models.Resource, include: 'Files' },
            },
          },
          {
            model: models.TourStop,
            include: [
              {
                model: models.Stop,
                include: {
                  model: models.StopResource,
                  as: 'Resources',
                  include: { model: models.Resource, include: 'Files' },
                },
              },
              {
                model: models.Stop,
                as: 'TransitionStop',
                include: {
                  model: models.StopResource,
                  as: 'Resources',
                  include: { model: models.Resource, include: 'Files' },
                },
              },
            ],
          },
        ],
      });
      assert.deepStrictEqual(record.variants, data.variants);
      for (const ts of record.TourStops) {
        assert.deepStrictEqual(ts.Stop.variants, data.variants);
        for (const sr of ts.Stop.Resources) {
          assert.deepStrictEqual(sr.Resource.variants, data.variants);
          const Files = [...sr.Resource.Files];
          for (const variant of data.variants) {
            assert.ok(Files.find((file) => file.variant === variant.code));
          }
        }
      }
    });
  });

  describe('DELETE /:id', () => {
    it('archives a Tour and orphaned Stops and Resources', async () => {
      await testSession.delete('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352').expect(StatusCodes.NO_CONTENT);

      let record = await models.Tour.findByPk('495b18a8-ae05-4f44-a06d-c1809add0352');
      assert.ok(record.archivedAt);

      record = await models.Stop.findByPk('e39b97ad-a5e9-422c-b256-d50fec355285');
      assert.ok(record.archivedAt);

      record = await models.Stop.findByPk('bba84716-633e-4593-85a0-9da4010eb99b');
      assert.ok(record.archivedAt);

      record = await models.Resource.findByPk('0cb2ce76-c5ca-454f-9fb1-47051b0f21ab');
      assert.ok(record.archivedAt);

      record = await models.Resource.findByPk('6ebacda9-8d33-4c3e-beb5-18dffb119046');
      assert.ok(record.archivedAt);
    });

    it('permanently deletes a Tour and orphaned Stops and Resources', async () => {
      // publish first so we can test deletion of version data
      const data = {
        TourId: '495b18a8-ae05-4f44-a06d-c1809add0352',
        isStaging: false,
      };
      const { body: version } = await testSession
        .post('/api/versions')
        .set('Accept', 'application/json')
        .send(data)
        .expect(StatusCodes.CREATED);
      await testSession.delete('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352?isPermanent=true').expect(StatusCodes.NO_CONTENT);

      let record = await models.Tour.findByPk('495b18a8-ae05-4f44-a06d-c1809add0352');
      assert.deepStrictEqual(record, null);

      record = await models.Version.findByPk(version.id);
      assert.deepStrictEqual(record, null);
      assert.deepStrictEqual(
        await helper.assetPathExists(
          path.join(
            'versions',
            version.id,
            'files',
            'ed2f158a-e44e-432d-971e-e5da1a2e33b4',
            'key',
            'cdd8007d-dcaf-4163-b497-92d378679668.png'
          )
        ),
        false
      );
      assert.deepStrictEqual(
        await helper.assetPathExists(
          path.join(
            'versions',
            version.id,
            'files',
            '84b62056-05a4-4751-953f-7854ac46bc0f',
            'key',
            'd2e150be-b277-4f68-96c7-22a477e0022f.m4a'
          )
        ),
        false
      );

      record = await models.Stop.findByPk('e39b97ad-a5e9-422c-b256-d50fec355285');
      assert.deepStrictEqual(record, null);

      record = await models.Stop.findByPk('bba84716-633e-4593-85a0-9da4010eb99b');
      assert.deepStrictEqual(record, null);

      record = await models.Resource.findByPk('0cb2ce76-c5ca-454f-9fb1-47051b0f21ab');
      assert.deepStrictEqual(record, null);

      record = await models.Resource.findByPk('6ebacda9-8d33-4c3e-beb5-18dffb119046');
      assert.deepStrictEqual(record, null);

      record = await models.File.findByPk('ed2f158a-e44e-432d-971e-e5da1a2e33b4');
      assert.deepStrictEqual(record, null);
      assert.deepStrictEqual(
        await helper.assetPathExists(
          path.join('files', 'ed2f158a-e44e-432d-971e-e5da1a2e33b4', 'key', 'cdd8007d-dcaf-4163-b497-92d378679668.png')
        ),
        false
      );

      record = await models.File.findByPk('84b62056-05a4-4751-953f-7854ac46bc0f');
      assert.deepStrictEqual(record, null);
      assert.deepStrictEqual(
        await helper.assetPathExists(
          path.join('files', '84b62056-05a4-4751-953f-7854ac46bc0f', 'key', 'd2e150be-b277-4f68-96c7-22a477e0022f.m4a')
        ),
        false
      );
    });
  });

  describe('PATCH /:id/restore', () => {
    it('restores an archived a Tour and its Stops and Resources', async () => {
      await testSession.delete('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352').expect(StatusCodes.NO_CONTENT);
      await testSession.patch('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352/restore').expect(StatusCodes.NO_CONTENT);

      let record = await models.Tour.findByPk('495b18a8-ae05-4f44-a06d-c1809add0352');
      assert.deepStrictEqual(record.archivedAt, null);

      record = await models.Stop.findByPk('e39b97ad-a5e9-422c-b256-d50fec355285');
      assert.deepStrictEqual(record.archivedAt, null);

      record = await models.Stop.findByPk('bba84716-633e-4593-85a0-9da4010eb99b');
      assert.deepStrictEqual(record.archivedAt, null);

      record = await models.Resource.findByPk('0cb2ce76-c5ca-454f-9fb1-47051b0f21ab');
      assert.deepStrictEqual(record.archivedAt, null);

      record = await models.Resource.findByPk('6ebacda9-8d33-4c3e-beb5-18dffb119046');
      assert.deepStrictEqual(record.archivedAt, null);
    });
  });

  describe('GET /:id/export', () => {
    it('returns a ZIP containing tour.json and binary asset files', async () => {
      const response = await testSession
        .get('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352/export')
        .buffer(true)
        .parse((res, fn) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => fn(null, Buffer.concat(chunks)));
          res.on('error', fn);
        })
        .expect(StatusCodes.OK)
        .expect('Content-Type', /application\/zip/);

      const zip = new AdmZip(response.body);

      const tourEntry = zip.getEntry('tour.json');
      assert.ok(tourEntry);
      const tourData = JSON.parse(tourEntry.getData().toString('utf8'));
      assert.deepStrictEqual(tourData.link, 'tour2');
      assert.deepStrictEqual(tourData.TourStops.length, 2);
      assert.deepStrictEqual(tourData.TourStops[0].Stop.link, 'chsa');
      assert.deepStrictEqual(tourData.TourStops[0].Stop.Resources.length, 2);
      // Raw key values present, no virtual URL fields
      assert.ok(tourData.TourStops[0].Stop.Resources[0].Resource.Files[0].key);
      assert.deepStrictEqual(tourData.TourStops[0].Stop.Resources[0].Resource.Files[0].URL, undefined);

      // Binary asset entries present for files with keys
      const imageEntry = zip.getEntry('files/ed2f158a-e44e-432d-971e-e5da1a2e33b4/key/cdd8007d-dcaf-4163-b497-92d378679668.png');
      assert.ok(imageEntry);
      assert.ok(imageEntry.getData().length > 0);

      const audioEntry = zip.getEntry('files/84b62056-05a4-4751-953f-7854ac46bc0f/key/d2e150be-b277-4f68-96c7-22a477e0022f.m4a');
      assert.ok(audioEntry);
      assert.ok(audioEntry.getData().length > 0);
    });
  });

  describe('POST /import', () => {
    const ORIG_FILE_ID = '00000000-0000-0000-0000-000000000001';
    const ORIG_RESOURCE_ID = '00000000-0000-0000-0000-000000000010';
    const ORIG_STOP_ID = '00000000-0000-0000-0000-000000000100';
    const ORIG_TOUR_ID = '00000000-0000-0000-0000-000000001000';

    function buildExportData(link = 'imported-tour') {
      return {
        id: ORIG_TOUR_ID,
        name: 'Imported Tour',
        link,
        names: { 'en-us': 'Imported Tour' },
        descriptions: { 'en-us': 'Imported description' },
        variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        visibility: 'PRIVATE',
        TourStops: [
          {
            id: '00000000-0000-0000-0000-000000010000',
            position: 1,
            StopId: ORIG_STOP_ID,
            TransitionStopId: null,
            Stop: {
              id: ORIG_STOP_ID,
              type: 'STOP',
              link: 'imported-stop',
              name: 'Imported Stop',
              address: '965 Clay St, San Francisco, CA 94108',
              coordinate: null,
              radius: null,
              destAddress: null,
              destCoordinate: null,
              destRadius: null,
              names: { 'en-us': 'Imported Stop' },
              descriptions: { 'en-us': 'Imported stop description' },
              variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
              Resources: [
                {
                  id: '00000000-0000-0000-0000-000000100000',
                  StopId: ORIG_STOP_ID,
                  ResourceId: ORIG_RESOURCE_ID,
                  start: 0,
                  end: null,
                  pauseAtEnd: null,
                  options: null,
                  Resource: {
                    id: ORIG_RESOURCE_ID,
                    name: 'Imported Image',
                    type: 'IMAGE',
                    data: null,
                    variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
                    Files: [
                      {
                        id: ORIG_FILE_ID,
                        ResourceId: ORIG_RESOURCE_ID,
                        variant: 'en-us',
                        externalURL: null,
                        key: 'cdd8007d-dcaf-4163-b497-92d378679668.png',
                        originalName: '512x512.png',
                        duration: null,
                        width: 512,
                        height: 512,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      };
    }

    it('creates a new Tour with Stops, Resources, and Files from a ZIP', async () => {
      const exportData = buildExportData();
      const zip = new AdmZip();
      zip.addFile('tour.json', Buffer.from(JSON.stringify(exportData)));
      const fileContent = fs.readFileSync(path.resolve(__dirname, '../../fixtures/files/512x512.png'));
      zip.addFile(`files/${ORIG_FILE_ID}/key/cdd8007d-dcaf-4163-b497-92d378679668.png`, fileContent);
      await s3.putObjectData('uploads/test-import.zip', zip.toBuffer());

      const response = await testSession
        .post('/api/tours/import')
        .set('Accept', 'application/json')
        .send({ TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907', signed_id: 'test-import.zip' })
        .expect(StatusCodes.CREATED);

      assert.ok(response.body.id);
      assert.deepStrictEqual(response.body.link, 'imported-tour');
      assert.deepStrictEqual(response.body.name, 'Imported Tour');

      const tourStops = await models.TourStop.findAll({ where: { TourId: response.body.id } });
      assert.deepStrictEqual(tourStops.length, 1);

      const stop = await models.Stop.findByPk(tourStops[0].StopId);
      assert.ok(stop);
      assert.deepStrictEqual(stop.link, 'imported-stop');

      const stopResources = await models.StopResource.findAll({ where: { StopId: stop.id } });
      assert.deepStrictEqual(stopResources.length, 1);

      const resource = await models.Resource.findByPk(stopResources[0].ResourceId);
      assert.ok(resource);
      assert.deepStrictEqual(resource.name, 'Imported Image');
      assert.deepStrictEqual(resource.type, 'IMAGE');

      const files = await models.File.findAll({ where: { ResourceId: resource.id } });
      assert.deepStrictEqual(files.length, 1);
      assert.deepStrictEqual(files[0].key, 'cdd8007d-dcaf-4163-b497-92d378679668.png');
      assert.deepStrictEqual(files[0].originalName, '512x512.png');

      assert.ok(await helper.assetPathExists(`files/${files[0].id}/key/cdd8007d-dcaf-4163-b497-92d378679668.png`));
      assert.deepStrictEqual(await s3.objectExists('uploads/test-import.zip'), false);
    });

    it('resolves Tour link conflicts automatically', async () => {
      const exportData = buildExportData('tour2');
      const zip = new AdmZip();
      zip.addFile('tour.json', Buffer.from(JSON.stringify(exportData)));
      await s3.putObjectData('uploads/test-conflict.zip', zip.toBuffer());

      const response = await testSession
        .post('/api/tours/import')
        .set('Accept', 'application/json')
        .send({ TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907', signed_id: 'test-conflict.zip' })
        .expect(StatusCodes.CREATED);

      assert.deepStrictEqual(response.body.link, 'tour2-1');
    });
  });

  describe('POST /:id/copy', () => {
    it('creates a shallow copy of a Tour with its TourStops', async () => {
      const response = await testSession
        .post('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352/copy')
        .set('Accept', 'application/json')
        .expect(StatusCodes.CREATED);

      assert.ok(response.body.id);
      assert.notStrictEqual(response.body.id, '495b18a8-ae05-4f44-a06d-c1809add0352');
      assert.deepStrictEqual(response.body.link, 'tour2-copy');
      assert.deepStrictEqual(response.body.name, 'Tour 2');
      assert.deepStrictEqual(response.body.names, { 'en-us': 'Tour 2' });
      assert.deepStrictEqual(response.body.descriptions, { 'en-us': 'Tour 2 description' });
      assert.deepStrictEqual(response.body.variants, [{ name: 'English (US)', displayName: 'English', code: 'en-us' }]);
      assert.deepStrictEqual(response.body.visibility, 'PRIVATE');
      assert.deepStrictEqual(response.body.CoverResourceId, null);
      assert.deepStrictEqual(response.body.IntroStopId, null);

      const newTourStops = await models.TourStop.findAll({ where: { TourId: response.body.id }, order: [['position', 'ASC']] });
      assert.deepStrictEqual(newTourStops.length, 2);
      assert.deepStrictEqual(newTourStops[0].StopId, 'e39b97ad-a5e9-422c-b256-d50fec355285');
      assert.deepStrictEqual(newTourStops[1].StopId, 'bba84716-633e-4593-85a0-9da4010eb99b');

      const origTourStops = await models.TourStop.findAll({ where: { TourId: '495b18a8-ae05-4f44-a06d-c1809add0352' } });
      assert.deepStrictEqual(origTourStops.length, 2);
    });

    it('resolves link conflicts when copying', async () => {
      await models.Tour.create({
        TeamId: '1a93d46d-89bf-463b-ab23-8f22f5777907',
        name: 'Tour 2 Copy',
        link: 'tour2-copy',
        names: { 'en-us': 'Tour 2 Copy' },
        descriptions: {},
        variants: [{ name: 'English (US)', displayName: 'English', code: 'en-us' }],
        visibility: 'PRIVATE',
      });

      const response = await testSession
        .post('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352/copy')
        .set('Accept', 'application/json')
        .expect(StatusCodes.CREATED);

      assert.deepStrictEqual(response.body.link, 'tour2-copy-1');
    });

    it('returns 404 for an unknown tour id', async () => {
      await testSession
        .post('/api/tours/00000000-0000-0000-0000-000000000000/copy')
        .set('Accept', 'application/json')
        .expect(StatusCodes.NOT_FOUND);
    });

    it('returns 401 for a non-member user', async () => {
      const otherSession = session(app);
      await otherSession
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: 'another.user@test.com', password: 'abcd1234' })
        .expect(StatusCodes.OK);

      await otherSession
        .post('/api/tours/495b18a8-ae05-4f44-a06d-c1809add0352/copy')
        .set('Accept', 'application/json')
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
