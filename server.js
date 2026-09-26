const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Helper para obter a URL base dinâmica (Sem localhost fixo) ────────────────
function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return `http://localhost:${PORT}`;
}

// ─── Ensure directories exist ───────────────────────────────────────────────────
['uploads', 'sealed', 'data'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// ─── Middleware ──────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Multer configuration ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos.'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// ─── Validation code generation ─────────────────────────────────────────────────
function generateValidationCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateUniqueCode() {
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM documentos WHERE codigo_validacao = ?');
  let code;
  let attempts = 0;
  do {
    code = generateValidationCode();
    attempts++;
    if (attempts > 100) throw new Error('Não foi possível gerar código único.');
  } while (checkStmt.get(code).count > 0);
  return code;
}

// ─── Date formatting helper ─────────────────────────────────────────────────────
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// ─── PDF sealing ────────────────────────────────────────────────────────────────
async function sealPDF(inputPath, outputPath, code, verificationUrl, empresaNome, clienteNome, dataEmissao) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Generate QR code as PNG buffer apontando para o link real da internet
  const qrBuffer = await QRCode.toBuffer(verificationUrl, {
    width: 200,
    margin: 1,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    errorCorrectionLevel: 'H'
  });
  const qrImage = await pdfDoc.embedPng(qrBuffer);

  const pages = pdfDoc.getPages();
  const footerHeight = 85;
  const qrSize = 58;
  const marginLeft = 30;
  const marginRight = 30;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width } = page.getSize();

    // Background bar
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: footerHeight + 8,
      color: rgb(0.97, 0.97, 0.98),
    });

    // Separator line
    page.drawLine({
      start: { x: marginLeft, y: footerHeight + 6 },
      end: { x: width - marginRight, y: footerHeight + 6 },
      thickness: 1.5,
      color: rgb(0.16, 0.29, 0.84),
    });

    // QR code (right side)
    page.drawImage(qrImage, {
      x: width - marginRight - qrSize,
      y: 14,
      width: qrSize,
      height: qrSize,
    });

    // Validation code label
    page.drawText('CODIGO DE VALIDACAO', {
      x: marginLeft,
      y: footerHeight - 8,
      size: 6.5,
      font: font,
      color: rgb(0.4, 0.4, 0.5),
    });

    // Validation code value
    page.drawText(code, {
      x: marginLeft,
      y: footerHeight - 22,
      size: 13,
      font: fontBold,
      color: rgb(0.16, 0.29, 0.84),
    });

    // Verification URL (link oficial da internet, sem localhost)
    page.drawText('Verifique em: ' + verificationUrl, {
      x: marginLeft,
      y: footerHeight - 38,
      size: 5.5,
      font: font,
      color: rgb(0.45, 0.45, 0.55),
    });

    // Emission / Sealing date (usa exatamente a data de emissao informada)
    const emissaoFormatada = formatDateBR(dataEmissao);
    page.drawText('Emitido em: ' + emissaoFormatada, {
      x: marginLeft,
      y: footerHeight - 50,
      size: 6,
      font: font,
      color: rgb(0.45, 0.45, 0.55),
    });

    // Selado em: consta a data de emissao definida pelo usuario
    page.drawText('Selado em: ' + emissaoFormatada, {
      x: marginLeft,
      y: footerHeight - 62,
      size: 6,
      font: font,
      color: rgb(0.45, 0.45, 0.55),
    });

    // Company/client info
    page.drawText(empresaNome + ' | ' + clienteNome, {
      x: marginLeft,
      y: footerHeight - 74,
      size: 6,
      font: font,
      color: rgb(0.55, 0.55, 0.65),
    });

    // Page number
    const pageText = 'Pagina ' + (i + 1) + ' de ' + pages.length;
    const pageTextWidth = font.widthOfTextAtSize(pageText, 6);
    page.drawText(pageText, {
      x: width - marginRight - qrSize - 15 - pageTextWidth,
      y: 16,
      size: 6,
      font: font,
      color: rgb(0.55, 0.55, 0.65),
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

// ─── ROUTES ─────────────────────────────────────────────────────────────────────

// POST /api/documentos — Upload and seal a document
app.post('/api/documentos', upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo PDF enviado.' });
    }

    const {
      empresa_nome, empresa_cnpj,
      cliente_nome, cliente_cpf, cliente_rg,
      cliente_orgao_expedidor, data_cadastro, data_emissao
    } = req.body;

    const required = {
      empresa_nome, empresa_cnpj,
      cliente_nome, cliente_cpf, cliente_rg,
      cliente_orgao_expedidor, data_cadastro, data_emissao
    };

    const fieldNames = {
      empresa_nome: 'Nome da Empresa',
      empresa_cnpj: 'CNPJ',
      cliente_nome: 'Nome do Cliente',
      cliente_cpf: 'CPF',
      cliente_rg: 'RG',
      cliente_orgao_expedidor: 'Orgao Expedidor',
      data_cadastro: 'Data de Cadastro',
      data_emissao: 'Data de Emissao'
    };

    for (const [field, value] of Object.entries(required)) {
      if (!value || !value.trim()) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: 'Campo obrigatorio nao preenchido: ' + (fieldNames[field] || field)
        });
      }
    }

    // Identifica dinamicamente a URL pública usada pelo usuário (sem localhost)
    const baseUrl = getBaseUrl(req);
    const codigo = generateUniqueCode();
    const verificationUrl = `${baseUrl}/verificar.html?codigo=${codigo}`;

    // Seal the PDF
    const sealedFilename = 'selado-' + codigo + '-' + Date.now() + '.pdf';
    const sealedPath = path.join(__dirname, 'sealed', sealedFilename);

    await sealPDF(
      req.file.path, sealedPath, codigo, verificationUrl,
      empresa_nome.trim(), cliente_nome.trim(), data_emissao.trim()
    );

    // Save to database
    const stmt = db.prepare(`
      INSERT INTO documentos (
        codigo_validacao, empresa_nome, empresa_cnpj,
        cliente_nome, cliente_cpf, cliente_rg, cliente_orgao_expedidor,
        data_cadastro, data_emissao, arquivo_original, arquivo_selado, nome_arquivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      codigo,
      empresa_nome.trim(), empresa_cnpj.trim(),
      cliente_nome.trim(), cliente_cpf.trim(), cliente_rg.trim(),
      cliente_orgao_expedidor.trim(), data_cadastro.trim(), data_emissao.trim(),
      req.file.path, sealedPath, req.file.originalname
    );

    res.json({
      success: true,
      codigo_validacao: codigo,
      link_verificacao: verificationUrl,
      download_url: '/api/documento/' + codigo + '/download'
    });

  } catch (error) {
    console.error('Erro ao processar documento:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erro ao processar o documento: ' + error.message });
  }
});

// GET /api/verificar/:codigo — Verify a document by code
app.get('/api/verificar/:codigo', (req, res) => {
  try {
    const { codigo } = req.params;

    if (!codigo || codigo.trim().length === 0) {
      return res.status(400).json({ error: 'Codigo de validacao nao informado.' });
    }

    const stmt = db.prepare('SELECT * FROM documentos WHERE codigo_validacao = ?');
    const doc = stmt.get(codigo.toUpperCase().trim());

    if (!doc) {
      return res.status(404).json({
        error: 'Documento nao encontrado. Verifique o codigo digitado.'
      });
    }

    res.json({
      success: true,
      documento: {
        codigo_validacao: doc.codigo_validacao,
        empresa: {
          nome: doc.empresa_nome,
          cnpj: doc.empresa_cnpj
        },
        cliente: {
          nome: doc.cliente_nome,
          cpf: doc.cliente_cpf,
          rg: doc.cliente_rg,
          orgao_expedidor: doc.cliente_orgao_expedidor
        },
        data_cadastro: doc.data_cadastro,
        data_emissao: doc.data_emissao,
        nome_arquivo: doc.nome_arquivo,
        selado_em: doc.data_emissao,
        download_url: '/api/documento/' + doc.codigo_validacao + '/download'
      }
    });
  } catch (error) {
    console.error('Erro na verificacao:', error);
    res.status(500).json({ error: 'Erro interno ao verificar documento.' });
  }
});

// GET /api/documento/:codigo/download — Download sealed PDF
app.get('/api/documento/:codigo/download', (req, res) => {
  try {
    const { codigo } = req.params;

    const stmt = db.prepare('SELECT * FROM documentos WHERE codigo_validacao = ?');
    const doc = stmt.get(codigo.toUpperCase().trim());

    if (!doc) {
      return res.status(404).json({ error: 'Documento nao encontrado.' });
    }

    if (!fs.existsSync(doc.arquivo_selado)) {
      return res.status(404).json({ error: 'Arquivo selado nao encontrado no servidor.' });
    }

    const downloadName = 'validado-' + doc.codigo_validacao + '-' + doc.nome_arquivo;
    res.download(doc.arquivo_selado, downloadName);
  } catch (error) {
    console.error('Erro no download:', error);
    res.status(500).json({ error: 'Erro interno ao baixar documento.' });
  }
});

// ─── Error handling middleware ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho maximo: 20MB.' });
    }
    return res.status(400).json({ error: 'Erro no upload: ' + err.message });
  }
  if (err) {
    console.error('Erro nao tratado:', err);
    return res.status(500).json({ error: err.message });
  }
  next();
});

// ─── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('='.repeat(55));
  console.log('  Validador de Documentos PDF Ativo');
  console.log('  Detectando automaticamente link publico da requisicao');
  console.log('='.repeat(55));
});
