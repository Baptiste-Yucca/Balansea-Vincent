/* global db */

const dbName = 'dca';
const user = 'username';
const pass = 'password';

const db = db.getSiblingDB(dbName);
db.createUser({
  user,
  pwd: pass,
  roles: [{ role: 'readWrite', db: dbName }],
});
