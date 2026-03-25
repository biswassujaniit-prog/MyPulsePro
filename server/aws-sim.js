// ============================================
// MyPulsePro — AWS DynamoDB Simulation Layer
// ============================================
// In-memory store with JSON file persistence
// Simulates DynamoDB API: getItem, putItem, query, scan

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

class DynamoDBSimulator {
  constructor() {
    this.tables = {};
    this._load();
  }

  _filePath(table) {
    return path.join(DATA_DIR, `${table}.json`);
  }

  _load() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const table = f.replace('.json', '');
      try {
        this.tables[table] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      } catch { this.tables[table] = []; }
    }
  }

  _persist(table) {
    try {
      fs.writeFileSync(this._filePath(table), JSON.stringify(this.tables[table] || [], null, 2));
    } catch (e) { console.error(`[AWS-Sim] Persist error for ${table}:`, e.message); }
  }

  _ensureTable(table) {
    if (!this.tables[table]) this.tables[table] = [];
  }

  putItem(table, item) {
    this._ensureTable(table);
    const idx = this.tables[table].findIndex(r =>
      r.pk === item.pk && r.sk === item.sk
    );
    if (idx >= 0) this.tables[table][idx] = item;
    else this.tables[table].push(item);
    this._persist(table);
    return item;
  }

  getItem(table, pk, sk) {
    this._ensureTable(table);
    return this.tables[table].find(r => r.pk === pk && r.sk === sk) || null;
  }

  query(table, pk, options = {}) {
    this._ensureTable(table);
    let results = this.tables[table].filter(r => r.pk === pk);
    if (options.skPrefix) {
      results = results.filter(r => r.sk && r.sk.startsWith(options.skPrefix));
    }
    if (options.skBetween) {
      const [start, end] = options.skBetween;
      results = results.filter(r => r.sk >= start && r.sk <= end);
    }
    if (options.sortDesc) results.sort((a, b) => b.sk.localeCompare(a.sk));
    else results.sort((a, b) => a.sk.localeCompare(b.sk));
    if (options.limit) results = results.slice(0, options.limit);
    return results;
  }

  scan(table, filterFn) {
    this._ensureTable(table);
    if (filterFn) return this.tables[table].filter(filterFn);
    return [...this.tables[table]];
  }

  deleteItem(table, pk, sk) {
    this._ensureTable(table);
    this.tables[table] = this.tables[table].filter(r => !(r.pk === pk && r.sk === sk));
    this._persist(table);
  }

  batchWrite(table, items) {
    this._ensureTable(table);
    for (const item of items) this.putItem(table, item);
  }
}

const db = new DynamoDBSimulator();
module.exports = db;
