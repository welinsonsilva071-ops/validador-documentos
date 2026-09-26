/**
 * app.js — Lógica do formulário de cadastro e upload de documentos
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sealForm');
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.getElementById('uploadArea');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileRemove = document.getElementById('fileRemove');
  const submitBtn = document.getElementById('submitBtn');
  const loading = document.getElementById('loading');
  const resultSuccess = document.getElementById('resultSuccess');
  const resultError = document.getElementById('resultError');
  const resultCode = document.getElementById('resultCode');
  const resultLink = document.getElementById('resultLink');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const newDocBtn = document.getElementById('newDocBtn');
  const retryBtn = document.getElementById('retryBtn');
  const errorMessage = document.getElementById('errorMessage');
  const toast = document.getElementById('toast');

  // ─── Set today's date and current time as default ───────────────────────────
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;

  document.getElementById('data_cadastro').value = today;
  if (document.getElementById('data_emissao')) {
    document.getElementById('data_emissao').value = today;
  }
  if (document.getElementById('hora_emissao')) {
    document.getElementById('hora_emissao').value = currentTime;
  }

  // ─── Input Masks ─────────────────────────────────────────────────────────────
  function maskCNPJ(value) {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  }

  function maskCPF(value) {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14);
  }

  document.getElementById('empresa_cnpj').addEventListener('input', (e) => {
    e.target.value = maskCNPJ(e.target.value);
  });

  document.getElementById('cliente_cpf').addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value);
  });

  // ─── File Upload (Click + Drag & Drop) ───────────────────────────────────────
  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      fileInput.files = files;
      showFileInfo(files[0]);
    } else {
      showToast('❌ Apenas arquivos PDF são permitidos.');
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      showFileInfo(fileInput.files[0]);
    }
  });

  function showFileInfo(file) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileName.textContent = `${file.name} (${sizeMB} MB)`;
    fileInfo.style.display = 'flex';
    uploadArea.style.display = 'none';
  }

  fileRemove.addEventListener('click', () => {
    fileInput.value = '';
    fileInfo.style.display = 'none';
    uploadArea.style.display = 'block';
  });

  // ─── Form Submission ─────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!fileInput.files.length) {
      showToast('❌ Selecione um arquivo PDF.');
      return;
    }

    // Build FormData
    const formData = new FormData(form);

    // Show loading
    form.style.display = 'none';
    resultSuccess.classList.remove('visible');
    resultError.classList.remove('visible');
    loading.classList.add('visible');

    try {
      const response = await fetch('/api/documentos', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      loading.classList.remove('visible');

      if (response.ok && data.success) {
        // Show success
        resultCode.textContent = data.codigo_validacao;
        resultLink.textContent = data.link_verificacao;
        resultLink.href = data.link_verificacao;
        downloadBtn.href = data.download_url;
        resultSuccess.classList.add('visible');
        showToast('✅ Documento selado com sucesso!');
      } else {
        // Show error
        errorMessage.textContent = data.error || 'Erro desconhecido ao processar o documento.';
        resultError.classList.add('visible');
      }

    } catch (err) {
      loading.classList.remove('visible');
      errorMessage.textContent = 'Erro de conexão com o servidor. Tente novamente.';
      resultError.classList.add('visible');
      console.error('Erro:', err);
    }
  });

  // ─── Copy Code ───────────────────────────────────────────────────────────────
  copyCodeBtn.addEventListener('click', () => {
    const code = resultCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      showToast('📋 Código copiado!');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('📋 Código copiado!');
    });
  });

  // ─── New Document ────────────────────────────────────────────────────────────
  newDocBtn.addEventListener('click', resetForm);
  retryBtn.addEventListener('click', resetForm);

  function resetForm() {
    form.reset();
    document.getElementById('data_cadastro').value = today;
    if (document.getElementById('data_emissao')) {
      document.getElementById('data_emissao').value = today;
    }
    if (document.getElementById('hora_emissao')) {
      document.getElementById('hora_emissao').value = currentTime;
    }
    fileInput.value = '';
    fileInfo.style.display = 'none';
    uploadArea.style.display = 'block';
    resultSuccess.classList.remove('visible');
    resultError.classList.remove('visible');
    loading.classList.remove('visible');
    form.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Toast ───────────────────────────────────────────────────────────────────
  let toastTimeout;
  function showToast(message) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }
});
