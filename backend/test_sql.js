const initSqlJs = require('sql.js');
async function test() {
    console.log('Starting sql.js test...');
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE test (id INT)");
    console.log('Success!');
}
test().catch(console.error);
