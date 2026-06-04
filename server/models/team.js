import { Model, Op } from 'sequelize';
import _ from 'lodash';

export default function (sequelize, DataTypes) {
  class Team extends Model {
    static associate(models) {
      Team.hasMany(models.Membership);
      Team.hasMany(models.Resource);
      Team.hasMany(models.Stop);
    }

    toJSON() {
      const json = _.pick(this.get(), [
        'id',
        'name',
        'link',
        'favicon',
        'faviconURL',
        'variants',
        'font',
        'colorPrimary',
        'colorSecondary',
      ]);
      if (this.Memberships) {
        json.Memberships = this.Memberships.map((m) => m.toJSON());
      }
      return json;
    }

    async getMembership(user, options) {
      const memberships = await this.getMemberships({
        where: {
          UserId: user.id,
        },
        transaction: options?.transaction,
      });
      return memberships.length ? memberships[0] : null;
    }
  }

  Team.init(
    {
      name: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: {
            msg: 'Name cannot be blank',
          },
        },
      },
      link: {
        type: DataTypes.CITEXT,
        validate: {
          notEmpty: {
            msg: 'Link cannot be blank',
          },
          async isUnique(value) {
            if (this.changed('link')) {
              const record = await Team.findOne({
                where: {
                  id: {
                    [Op.ne]: this.id,
                  },
                  link: value,
                },
              });
              if (record) {
                throw new Error('Link already taken');
              }
            }
          },
          is: {
            args: [/^[A-Za-z0-9-]+$/],
            msg: 'Letters, numbers, and hyphen only',
          },
        },
      },
      favicon: DataTypes.TEXT,
      faviconURL: {
        type: DataTypes.VIRTUAL(DataTypes.TEXT, ['favicon']),
        get() {
          return this.assetUrl('favicon');
        },
      },
      variants: DataTypes.JSONB,
      font: DataTypes.JSONB,
      colorPrimary: DataTypes.STRING,
      colorSecondary: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'Team',
    }
  );

  Team.afterSave(async (record, options) => {
    return record.handleAssetFile('favicon', options);
  });

  Team.afterDestroy(async (record, options) => {
    record.favicon = null;
    return record.handleAssetFile('favicon', options);
  });

  return Team;
}
