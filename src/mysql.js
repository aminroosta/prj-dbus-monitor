var mysql = require('mysql');
var config = require('./config.js');

var connection = null;
var logger = function() { console.warn(arguments); }

function execute(str) {
  return new Promise((resolve, reject) =>
      connection.query(str, (err, rows, fields) => {
        if(err)
          return reject(err);
        return resolve(rows, fields);
      })
  );
}

function create_tables() {
  var promises = config.tables.map(table => {
    var query = `create table \`${table.name}\` (\n`;
    for(var col in table.fields)
      query += `${col} ${table.fields[col]},\n`;
    query += `PRIMARY KEY ( ${table.primary_key} )\n`;
    query += ');';

    return execute(query);
  });
  return Promise.all(promises);
}

function init() {
    connection && connection.end();
    connection = mysql.createConnection(config.db);
    connection.connect();

    if(config.drop_and_create) { /* drop and create tables */
      return execute('drop database if exists `'+ config.database + '`;')
          .then(() => execute('create database `' + config.database + '`;'))
          .then(() => execute('use `' + config.database + '`;'))
          .then(() => create_tables())
          .catch(logger);
    }
    /* otherwise just select the database */
    return execute('use `' + config.database + '`;');
}

function insert_random_data_every(ms) {
  ms = ms || 500; /* 500 ms by default */
  var generate = () => `'${Math.random().toString(36).substr(2, 5)}'`; /* generate a random string */
  setInterval(() => {
    config.tables.forEach(table => {
      var keys = Object.keys(table.fields).filter(key => key !== table.primary_key);
      var values = keys.map(generate);
      var query = `insert into \`${table.name}\` (${keys.join(',')}) values (${values.join(',')})`;
      execute(query).catch(logger); /* insert the new row */
    })
  }, ms);
}

/* select rows from table_name where row.id > last_id
 * last_id is optional */
function select(table_name, last_id) {
  last_id = last_id || 0; /* select all rows if no last_id is provided */
    var query = `select * from \`${table_name}\` as tbl where tbl.id > ${last_id};`;
    return execute(query)
          .then((rows, fields) => {
            logger(JSON.stringify(rows));
          })
          .catch(err => {
            logger(err);
            return err;
          });
}

init()
  .then(() => insert_random_data_every(1000))
  .then(() => select('left-table', 10));
