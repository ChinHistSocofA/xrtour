import AdmZip from 'adm-zip';
import { ZipArchive } from 'archiver';
import express from 'express';
import { StatusCodes } from 'http-status-codes';
import _ from 'lodash';
import path from 'path';
import { v4 as uuid } from 'uuid';

import helpers from '../helpers.js';
import interceptors from '../interceptors.js';
import { translateText } from '../../lib/translate.js';
import models from '../../models/index.js';
import s3 from '../../lib/s3.js';

import tourStopsRouter from './tourStops.js';

const router = express.Router();

function buildFileData(file) {
  return _.pick(file.get(), ['id', 'ResourceId', 'variant', 'externalURL', 'key', 'originalName', 'duration', 'width', 'height']);
}

function buildResourceData(resource) {
  const data = _.pick(resource.get(), ['id', 'name', 'type', 'data', 'variants']);
  if (resource.Files) {
    data.Files = resource.Files.map(buildFileData);
  }
  return data;
}

function buildStopResourceData(sr) {
  const data = _.pick(sr.get(), ['id', 'StopId', 'ResourceId', 'start', 'end', 'pauseAtEnd', 'options']);
  if (sr.Resource) {
    data.Resource = buildResourceData(sr.Resource);
  }
  return data;
}

function buildStopData(stop) {
  const data = _.pick(stop.get(), [
    'id',
    'type',
    'link',
    'name',
    'address',
    'coordinate',
    'radius',
    'destAddress',
    'destCoordinate',
    'destRadius',
    'names',
    'descriptions',
    'variants',
  ]);
  if (stop.Resources) {
    data.Resources = stop.Resources.map(buildStopResourceData);
  }
  return data;
}

function buildExportData(tour) {
  const data = _.pick(tour.get(), ['id', 'name', 'link', 'names', 'descriptions', 'variants', 'visibility']);
  if (tour.CoverResource) {
    data.CoverResource = buildResourceData(tour.CoverResource);
  }
  if (tour.IntroStop) {
    data.IntroStop = buildStopData(tour.IntroStop);
  }
  if (tour.TourStops) {
    data.TourStops = tour.TourStops.sort((a, b) => Math.sign(a.position - b.position)).map((ts) => {
      const tourStop = _.pick(ts.get(), ['id', 'position', 'StopId', 'TransitionStopId']);
      if (ts.Stop) tourStop.Stop = buildStopData(ts.Stop);
      if (ts.TransitionStop) tourStop.TransitionStop = buildStopData(ts.TransitionStop);
      return tourStop;
    });
  }
  return data;
}

function collectFileInstances(tour) {
  const files = new Map();
  function addFiles(resource) {
    if (resource?.Files) {
      resource.Files.forEach((f) => {
        if (f.key && !files.has(f.id)) files.set(f.id, f);
      });
    }
  }
  function addStop(stop) {
    if (stop?.Resources) stop.Resources.forEach((sr) => addFiles(sr.Resource));
  }
  addFiles(tour.CoverResource);
  addStop(tour.IntroStop);
  tour.TourStops?.forEach((ts) => {
    addStop(ts.Stop);
    addStop(ts.TransitionStop);
  });
  return Array.from(files.values());
}

router.get('/', interceptors.requireLogin, async (req, res) => {
  const { page = '1', show = 'active', TeamId } = req.query;
  const team = await models.Team.findByPk(TeamId);
  const membership = await team.getMembership(req.user);
  if (!membership) {
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }
  const options = {
    include: [{ model: models.Resource, as: 'CoverResource', include: 'Files' }],
    page,
    order: [['name', 'ASC']],
    where: { TeamId },
  };
  if (show === 'active') {
    options.where.archivedAt = null;
  } else if (show === 'archived') {
    options.where.archivedAt = { [models.Sequelize.Op.ne]: null };
  }
  const { records, pages, total } = await models.Tour.paginate(options);
  helpers.setPaginationHeaders(req, res, page, pages, total);
  res.json(records.map((record) => record.toJSON()));
});

router.post('/', interceptors.requireLogin, async (req, res) => {
  const { TeamId } = req.body;
  const team = await models.Team.findByPk(TeamId);
  const membership = await team.getMembership(req.user);
  if (!membership || !membership.isEditor) {
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }
  const record = models.Tour.build(_.pick(req.body, ['TeamId', 'name', 'link', 'names', 'descriptions', 'variants', 'visibility']));
  try {
    await record.save();
    res.status(StatusCodes.CREATED).json(record.toJSON());
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        status: StatusCodes.UNPROCESSABLE_ENTITY,
        errors: error.errors.map((e) => _.pick(e, ['path', 'message', 'value'])),
      });
    } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).end();
    }
  }
});

router.use('/:TourId/stops', tourStopsRouter);

router.post('/import', interceptors.requireLogin, async (req, res) => {
  const { TeamId, signed_id } = req.body;
  if (!TeamId || !signed_id) {
    res.status(StatusCodes.BAD_REQUEST).end();
    return;
  }
  const team = await models.Team.findByPk(TeamId);
  if (!team) {
    res.status(StatusCodes.NOT_FOUND).end();
    return;
  }
  const membership = await team.getMembership(req.user);
  if (!membership || !membership.isEditor) {
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }
  let newTour;
  try {
    const zipData = await s3.getObjectData(path.join('uploads', signed_id));
    const zip = new AdmZip(Buffer.from(zipData));
    const tourJsonEntry = zip.getEntry('tour.json');
    if (!tourJsonEntry) {
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ errors: [{ message: 'Invalid export file: missing tour.json' }] });
      return;
    }
    const exportData = JSON.parse(tourJsonEntry.getData().toString('utf8'));
    const assetPrefix = process.env.ASSET_PATH_PREFIX || '';

    await models.sequelize.transaction(async (transaction) => {
      // Collect unique resources and stops from all positions in the hierarchy
      const resourceMap = new Map();
      const stopMap = new Map();

      function collectResource(resource) {
        if (resource && !resourceMap.has(resource.id)) resourceMap.set(resource.id, resource);
      }
      function collectStop(stop) {
        if (stop && !stopMap.has(stop.id)) {
          stopMap.set(stop.id, stop);
          stop.Resources?.forEach((sr) => collectResource(sr.Resource));
        }
      }
      if (exportData.CoverResource) collectResource(exportData.CoverResource);
      if (exportData.IntroStop) collectStop(exportData.IntroStop);
      exportData.TourStops?.forEach((ts) => {
        if (ts.Stop) collectStop(ts.Stop);
        if (ts.TransitionStop) collectStop(ts.TransitionStop);
      });

      // Create Resources + Files
      const newResourceIdMap = new Map();
      for (const [oldResourceId, resourceData] of resourceMap) {
        const newResourceId = uuid();
        newResourceIdMap.set(oldResourceId, newResourceId);
        await models.Resource.create(
          {
            id: newResourceId,
            TeamId,
            name: resourceData.name,
            type: resourceData.type,
            data: resourceData.data ?? {},
            variants: resourceData.variants,
          },
          { transaction }
        );
        for (const fileData of resourceData.Files ?? []) {
          const newFileId = uuid();
          if (fileData.key) {
            const zipEntry = zip.getEntry(`files/${fileData.id}/key/${fileData.key}`);
            if (zipEntry) {
              await s3.putObjectData(path.join(assetPrefix, 'files', newFileId, 'key', fileData.key), zipEntry.getData());
            }
          }
          // hooks: false prevents File.afterSave from trying to move uploads/{key} which doesn't exist here
          await models.File.create(
            {
              id: newFileId,
              ResourceId: newResourceId,
              variant: fileData.variant,
              externalURL: fileData.externalURL,
              key: fileData.key,
              originalName: fileData.originalName,
              duration: fileData.duration,
              width: fileData.width,
              height: fileData.height,
            },
            { hooks: false, transaction }
          );
        }
      }

      // Create Stops + StopResources
      const newStopIdMap = new Map();
      for (const [oldStopId, stopData] of stopMap) {
        const newStopId = uuid();
        newStopIdMap.set(oldStopId, newStopId);
        let { link } = stopData;
        if (link) {
          let suffix = 1;
          // eslint-disable-next-line no-await-in-loop
          while (await models.Stop.findOne({ where: { TeamId, link }, transaction })) {
            link = `${stopData.link}-${suffix++}`;
          }
        }
        // eslint-disable-next-line no-await-in-loop
        await models.Stop.create(
          {
            id: newStopId,
            TeamId,
            type: stopData.type,
            link,
            name: stopData.name,
            address: stopData.address ?? '',
            coordinate: stopData.coordinate,
            radius: stopData.radius,
            destAddress: stopData.destAddress,
            destCoordinate: stopData.destCoordinate,
            destRadius: stopData.destRadius,
            names: stopData.names,
            descriptions: stopData.descriptions,
            variants: stopData.variants,
          },
          { transaction }
        );
        for (const sr of stopData.Resources ?? []) {
          // eslint-disable-next-line no-await-in-loop
          await models.StopResource.create(
            {
              StopId: newStopId,
              ResourceId: newResourceIdMap.get(sr.Resource?.id),
              start: sr.start ?? 0,
              end: sr.end,
              pauseAtEnd: sr.pauseAtEnd ?? false,
              options: sr.options ?? {},
            },
            { transaction }
          );
        }
      }

      // Create Tour (resolve link conflict)
      let { link } = exportData;
      let suffix = 1;
      // eslint-disable-next-line no-await-in-loop
      while (await models.Tour.findOne({ where: { TeamId, link }, transaction })) {
        link = `${exportData.link}-${suffix++}`;
      }
      newTour = await models.Tour.create(
        {
          TeamId,
          name: exportData.name,
          link,
          names: exportData.names,
          descriptions: exportData.descriptions,
          variants: exportData.variants,
          visibility: exportData.visibility,
          CoverResourceId: exportData.CoverResource ? newResourceIdMap.get(exportData.CoverResource.id) : null,
          IntroStopId: exportData.IntroStop ? newStopIdMap.get(exportData.IntroStop.id) : null,
        },
        { transaction }
      );

      // Create TourStops
      for (const ts of exportData.TourStops ?? []) {
        // eslint-disable-next-line no-await-in-loop
        await models.TourStop.create(
          {
            TourId: newTour.id,
            StopId: ts.Stop ? newStopIdMap.get(ts.Stop.id) : null,
            TransitionStopId: ts.TransitionStop ? newStopIdMap.get(ts.TransitionStop.id) : null,
            position: ts.position,
          },
          { transaction }
        );
      }
    });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).end();
    return;
  } finally {
    await s3.deleteObject(path.join('uploads', signed_id)).catch(() => {});
  }
  res.status(StatusCodes.CREATED).json(newTour.toJSON());
});

router.post('/translate', interceptors.requireLogin, async (req, res) => {
  const { source, target, data } = req.body;
  if (!source || !target || !data) {
    res.status(StatusCodes.BAD_REQUEST).end();
    return;
  }
  let name = '';
  if (data.name) {
    name = await translateText(data.name, source, target);
  }
  let description = '';
  if (data.description) {
    description = await translateText(data.description, source, target);
  }
  res.json({ name, description });
});

router.get('/:id/export', interceptors.requireLogin, async (req, res) => {
  const record = await models.Tour.findByPk(req.params.id, {
    include: [
      'Team',
      { model: models.Resource, as: 'CoverResource', include: 'Files' },
      {
        model: models.Stop,
        as: 'IntroStop',
        include: { model: models.StopResource, as: 'Resources', include: { model: models.Resource, include: 'Files' } },
      },
      {
        model: models.TourStop,
        include: [
          {
            model: models.Stop,
            include: { model: models.StopResource, as: 'Resources', include: { model: models.Resource, include: 'Files' } },
          },
          {
            model: models.Stop,
            as: 'TransitionStop',
            include: { model: models.StopResource, as: 'Resources', include: { model: models.Resource, include: 'Files' } },
          },
        ],
      },
    ],
  });
  if (!record) {
    res.status(StatusCodes.NOT_FOUND).end();
    return;
  }
  const membership = await record.Team.getMembership(req.user);
  if (!membership) {
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }
  const exportData = buildExportData(record);
  const fileInstances = collectFileInstances(record);
  try {
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="tour-${record.link}.zip"`);
    const archive = new ZipArchive();
    archive.pipe(res);
    archive.append(JSON.stringify(exportData, null, 2), { name: 'tour.json' });
    for (const f of fileInstances) {
      archive.append(Buffer.from(await s3.getObjectData(f.getAssetPath('key'))), { name: `files/${f.id}/key/${f.key}` });
    }
    await new Promise((resolve, reject) => {
      archive.on('finish', resolve);
      archive.on('error', reject);
      archive.finalize();
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).end();
    } else {
      res.end();
    }
  }
});

router.get('/:id', interceptors.requireLogin, async (req, res) => {
  const record = await models.Tour.findByPk(req.params.id, {
    include: [
      'Team',
      { model: models.Resource, as: 'CoverResource', include: 'Files' },
      {
        model: models.Stop,
        as: 'IntroStop',
        include: { model: models.StopResource, as: 'Resources', include: { model: models.Resource, include: 'Files' } },
      },
    ],
  });
  if (record) {
    const membership = await record.Team.getMembership(req.user);
    if (!membership) {
      res.status(StatusCodes.UNAUTHORIZED).end();
    } else {
      res.json(record.toJSON());
    }
  } else {
    res.status(StatusCodes.NOT_FOUND).end();
  }
});

router.patch('/:id', interceptors.requireLogin, async (req, res) => {
  const record = await models.Tour.findByPk(req.params.id, { include: 'Team' });
  if (record) {
    const membership = await record.Team.getMembership(req.user);
    if (!membership || !membership.isEditor) {
      res.status(StatusCodes.UNAUTHORIZED).end();
    } else {
      try {
        if (req.body.CoverResourceId) {
          const resource = await models.Resource.findOne({
            where: {
              id: req.body.CoverResourceId,
              TeamId: membership.TeamId,
            },
          });
          if (!resource) {
            res.status(StatusCodes.NOT_FOUND).end();
            return;
          }
        }
        if (req.body.IntroStopId) {
          const stop = await models.Stop.findOne({
            where: {
              id: req.body.IntroStopId,
              TeamId: membership.TeamId,
            },
          });
          if (!stop) {
            res.status(StatusCodes.NOT_FOUND).end();
            return;
          }
        }
        record.set(_.pick(req.body, ['name', 'link', 'names', 'descriptions', 'variants', 'visibility', 'CoverResourceId', 'IntroStopId']));
        await models.sequelize.transaction(async (transaction) => {
          if (record.changed('variants')) {
            await record.updateVariants({ transaction });
          }
          await record.save({ transaction });
        });
        res.json(record.toJSON());
      } catch (error) {
        if (error.name === 'SequelizeValidationError') {
          res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
            status: StatusCodes.UNPROCESSABLE_ENTITY,
            errors: error.errors.map((e) => _.pick(e, ['path', 'message', 'value'])),
          });
        } else {
          console.log(error);
          res.status(StatusCodes.INTERNAL_SERVER_ERROR).end();
        }
      }
    }
  } else {
    res.status(StatusCodes.NOT_FOUND).end();
  }
});

router.patch('/:id/restore', interceptors.requireLogin, async (req, res) => {
  let status = StatusCodes.INTERNAL_SERVER_ERROR;
  await models.sequelize.transaction(async (transaction) => {
    const record = await models.Tour.findByPk(req.params.id, { include: 'Team', transaction });
    if (!record) {
      status = StatusCodes.NOT_FOUND;
      return;
    }
    const membership = await record.Team.getMembership(req.user, { transaction });
    if (!membership || !membership.isEditor) {
      status = StatusCodes.FORBIDDEN;
      return;
    }
    try {
      await record.restore({ transaction });
      status = StatusCodes.NO_CONTENT;
    } catch (error) {
      console.log(error);
    }
  });
  res.status(status).end();
});

router.delete('/:id', interceptors.requireLogin, async (req, res) => {
  const { isPermanent = 'false' } = req.query;
  let status = StatusCodes.INTERNAL_SERVER_ERROR;
  await models.sequelize.transaction(async (transaction) => {
    const record = await models.Tour.findByPk(req.params.id, { include: 'Team', transaction });
    if (!record) {
      status = StatusCodes.NOT_FOUND;
      return;
    }
    const membership = await record.Team.getMembership(req.user, { transaction });
    if (!membership || !membership.isEditor) {
      status = StatusCodes.FORBIDDEN;
      return;
    }
    try {
      await record.delete({ isPermanent: isPermanent === 'true', transaction });
      status = StatusCodes.NO_CONTENT;
    } catch (error) {
      console.log(error);
    }
  });
  res.status(status).end();
});

export default router;
