import fs from 'fs-extra';
import inflection from 'inflection';
import mime from 'mime-types';
import path from 'path';
import Sequelize from 'sequelize';
import { fileURLToPath } from 'url';

import { optimizeImage, optimizeAudio } from '../lib/optimize.js';
import s3 from '../lib/s3.js';
import configs from '../config/config.js';

const env = process.env.NODE_ENV || 'development';
const config = configs[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await Promise.all(
  fs
    .readdirSync(__dirname)
    .filter((file) => file.indexOf('.') !== 0 && file !== 'index.js' && file.slice(-3) === '.js')
    .map((file) =>
      import(path.join(__dirname, file))
        .then(({ default: init }) => init(sequelize, Sequelize.DataTypes))
        .then((model) => (db[model.name] = model))
    )
).then(() => {
  Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// add some helpers to the Sequelize Model class for handling file attachments

Sequelize.Model.prototype.assetUrl = function assetUrl(attribute) {
  const pathPrefix = `${inflection.tableize(this.constructor.name)}/${this.id}/${attribute}`;
  const file = this.get(attribute);
  if (file) {
    return path.resolve('/api/assets/', pathPrefix, path.basename(file));
  }
  return null;
};

Sequelize.Model.prototype.getAssetPath = function getAssetPath(attribute) {
  const assetPrefix = process.env.ASSET_PATH_PREFIX || '';
  const pathPrefix = `${inflection.tableize(this.constructor.name)}/${this.id}/${attribute}`;
  let filePath = this.get(attribute);
  if (!filePath) {
    return null;
  }
  return path.join(assetPrefix, pathPrefix, path.basename(filePath));
};

Sequelize.Model.prototype.getAssetBucketUri = function getAssetBucketUri(attribute) {
  let filePath = this.getAssetPath(attribute);
  return `s3://${process.env.AWS_S3_BUCKET}/${filePath}`;
};

Sequelize.Model.prototype.getAssetFile = async function getAssetFile(attribute) {
  let filePath = this.getAssetPath(attribute);
  filePath = await s3.getObject(filePath);
  return filePath;
};

Sequelize.Model.prototype.handleAssetFile = async function handleAssetFile(attribute, options, callback) {
  const pathPrefix = `${inflection.tableize(this.constructor.name)}/${this.id}/${attribute}`;
  if (!this.changed(attribute)) {
    return;
  }
  const assetPrefix = process.env.ASSET_PATH_PREFIX || '';
  const prevFile = this.previous(attribute);
  const newFile = this.get(attribute);
  const handle = async () => {
    let prevPath;
    let newPath;
    if (prevFile) {
      prevPath = path.join(assetPrefix, pathPrefix, prevFile);
      await s3.deleteObject(prevPath);
    }
    if (newFile) {
      newPath = path.join(assetPrefix, pathPrefix, path.basename(newFile));
      await s3.copyObject(path.join(process.env.AWS_S3_BUCKET, 'uploads', newFile), newPath);
      await s3.deleteObject(path.join('uploads', newFile));
      // generate optimized variant alongside the original
      try {
        const contentType = mime.lookup(newFile) || '';
        let result;
        let localPath;
        if (contentType.startsWith('image/')) {
          localPath = await s3.getObject(newPath);
          result = await optimizeImage(localPath);
        } else if (contentType === 'audio/wav' || contentType === 'audio/x-wav' || contentType === 'audio/wave') {
          localPath = await s3.getObject(newPath);
          result = await optimizeAudio(localPath);
        }
        if (result) {
          const optimizedKey = path.join(assetPrefix, pathPrefix, path.basename(result.outputPath));
          await s3.putObject(optimizedKey, result.outputPath, result.contentType);
          await fs.remove(result.outputPath);
        }
        if (localPath) {
          await fs.remove(localPath);
        }
      } catch (err) {
        console.error('Asset optimization failed, original preserved:', err);
      }
    }
    if (callback) {
      await callback(this.id, prevPath, newPath);
    }
  };
  if (options.transaction) {
    options.transaction.afterCommit(() => handle());
  } else {
    await handle();
  }
};

Sequelize.Model.paginate = async function paginate(options) {
  const newOptions = { ...options };
  const page = parseInt(newOptions.page || '1', 10);
  delete newOptions.page;
  const perPage = newOptions.paginate || 12;
  delete newOptions.paginate;
  newOptions.offset = (page - 1) * perPage;
  newOptions.limit = perPage;
  const { count, rows } = await this.findAndCountAll(newOptions);
  return { records: rows, pages: Math.ceil(count / perPage), total: count };
};

export default db;
