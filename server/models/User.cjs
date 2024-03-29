// @ts-check

const BaseModel = require('./BaseModel.cjs');
const objectionUnique = require('objection-unique');
const encrypt = require('../lib/secure.cjs');

const unique = objectionUnique({ fields: ['email'] });

module.exports = class User extends unique(BaseModel) {
  static get tableName() {
    return 'users';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        id: { type: 'integer' },
        email: { type: 'string', format: 'email', minLength: 1 },
        firstName: { type: 'string', minLength: 1 },
        lastName: { type: 'string', minLength: 1 },
        password: { type: 'string', minLength: 3 },
      },
    };
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  set password(value) {
    this.passwordDigest = encrypt(value);
  }

  verifyPassword(password) {
    return encrypt(password) === this.passwordDigest;
  }

  async getTasks(db) {
    const Task = require('./Task.cjs');
    const tasksExecuting = await Task.query(db).where('executorId', this.id);
    const tasksCreated = await Task.query(db).where('creatorId', this.id);
    return [...tasksExecuting, ...tasksCreated]; // TODO: unique?
  }

  static async create(userData, db) {
    const validUser = await this.fromJson(userData);
    await this.query(db).insert(validUser);
  }

  async update(userData, db) {
    await this.$query().patch(userData);
  }
}

