const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'validador.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create documents table
db.exec(`
  CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_validacao TEXT UNIQUE NOT NULL,
    empresa_nome TEXT NOT NULL,
    empresa_cnpj TEXT NOT NULL,
    cliente_nome TEXT NOT NULL,
    cliente_cpf TEXT NOT NULL,
    cliente_rg TEXT NOT NULL,
    cliente_orgao_expedidor TEXT NOT NULL,
    data_cadastro TEXT NOT NULL,
    data_emissao TEXT NOT NULL,
    hora_emissao TEXT DEFAULT '',
    arquivo_original TEXT NOT NULL,
    arquivo_selado TEXT NOT NULL,
    nome_arquivo TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

// Migration to ensure hora_emissao column exists if table was created previously
try {
  db.exec(`ALTER TABLE documentos ADD COLUMN hora_emissao TEXT DEFAULT ''`);
} catch (e) {
  // Column already exists
}

// Create index for faster lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_codigo_validacao ON documentos(codigo_validacao)
`);

module.exports = db;
