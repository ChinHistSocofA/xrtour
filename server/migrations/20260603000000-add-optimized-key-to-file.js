/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Files', 'optimizedKey', Sequelize.TEXT);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Files', 'optimizedKey');
  },
};
