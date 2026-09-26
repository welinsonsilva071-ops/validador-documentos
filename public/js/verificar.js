/**
 * verificar.js — Lógica da página de verificação de documentos
 * Suporta: digitação de código, leitura de QR code, e acesso via URL
 *
 * SEGURANÇA: Esta página NÃO tem link para a página de cadastro.
 * O histórico do navegador é substituído para impedir navegação via "voltar".
 */

document.addEventListener('DOMContentLoaded', function () {
  // ─── Impedir navegação "voltar" para a página de cadastro ───────────────────
  // Substitui o histórico para que o botão voltar não revele o cadastro
  window.history.replaceState(null, '', window.location.href);
  window.addEventListener('popstate', function () {
    // Se o usuário clicar em "voltar", fecha a aba/janela
    // Se não conseguir fechar (restrição do browser), volta para esta mesma página
    window.history.replaceState(null, '', window.location.href);
    try {
      window.close();
    } catch (e) {
      // Browser não permite fechar — recarrega a página de verificação
      window.location.href = window.location.pathname;
    }
  });

  var verifyForm = document.getElementById('verifyForm');
  var codigoInput = document.getElementById('codigoInput');
  var scanBtn = document.getElementById('scanBtn');
  var stopScanBtn = document.getElementById('stopScanBtn');
  var scannerContainer = document.getElementById('scannerContainer');
  var loading = document.getElementById('loading');
  var errorBox = document.getElementById('errorBox');
  var errorMessage = document.getElementById('errorMessage');
  var docInfo = document.getElementById('docInfo');
  var downloadBtn = document.getElementById('downloadBtn');
  var newVerifyBtn = document.getElementById('newVerifyBtn');
  var toast = document.getElementById('toast');

  var html5QrcodeScanner = null;

  // ─── Auto-verify from URL query parameter ───────────────────────────────────
  var urlParams = new URLSearchParams(window.location.search);
  var codigoFromUrl = urlParams.get('codigo');

  if (codigoFromUrl) {
    codigoInput.value = codigoFromUrl.toUpperCase();
    verifyDocument(codigoFromUrl);
  }

  // ─── Form submit ────────────────────────────────────────────────────────────
  verifyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var codigo = codigoInput.value.trim().toUpperCase();
    if (!codigo) {
      showToast('❌ Digite o código de validação.');
      return;
    }
    verifyDocument(codigo);
  });

  // ─── Force uppercase on input ────────────────────────────────────────────────
  codigoInput.addEventListener('input', function () {
    codigoInput.value = codigoInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // ─── QR Scanner ─────────────────────────────────────────────────────────────
  scanBtn.addEventListener('click', startScanner);
  stopScanBtn.addEventListener('click', stopScanner);

  function startScanner() {
    scannerContainer.style.display = 'block';
    scanBtn.style.display = 'none';

    html5QrcodeScanner = new Html5Qrcode('qr-reader');

    var config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    html5QrcodeScanner.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      onScanFailure
    ).catch(function (err) {
      console.error('Erro ao iniciar scanner:', err);
      showToast('❌ Não foi possível acessar a câmera.');
      stopScanner();
    });
  }

  function stopScanner() {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().then(function () {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
      }).catch(function (err) {
        console.error('Erro ao parar scanner:', err);
      });
    }
    scannerContainer.style.display = 'none';
    scanBtn.style.display = '';
  }

  function onScanSuccess(decodedText) {
    stopScanner();

    var codigo = decodedText;

    try {
      var url = new URL(decodedText);
      var params = new URLSearchParams(url.search);
      if (params.has('codigo')) {
        codigo = params.get('codigo');
      }
    } catch (e) {
      // Not a URL, use as-is
    }

    codigo = codigo.toUpperCase().trim();
    codigoInput.value = codigo;

    showToast('📷 QR Code lido com sucesso!');
    verifyDocument(codigo);
  }

  function onScanFailure() {
    // Silently ignore scan failures (continuous scanning)
  }

  // ─── Verify Document ────────────────────────────────────────────────────────
  function verifyDocument(codigo) {
    errorBox.classList.remove('visible');
    docInfo.classList.remove('visible');
    loading.classList.add('visible');

    fetch('/api/verificar/' + encodeURIComponent(codigo))
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        loading.classList.remove('visible');

        if (result.ok && result.data.success) {
          displayDocumentInfo(result.data.documento);
        } else {
          errorMessage.textContent = result.data.error || 'Documento não encontrado.';
          errorBox.classList.add('visible');
        }
      })
      .catch(function (err) {
        loading.classList.remove('visible');
        errorMessage.textContent = 'Erro de conexão com o servidor.';
        errorBox.classList.add('visible');
        console.error('Erro:', err);
      });
  }

  // ─── Display Document Info ──────────────────────────────────────────────────
  function displayDocumentInfo(doc) {
    document.getElementById('infoCodigo').textContent = doc.codigo_validacao;

    // Empresa
    document.getElementById('infoEmpresaNome').textContent = doc.empresa.nome;
    document.getElementById('infoEmpresaCnpj').textContent = doc.empresa.cnpj;

    // Cliente
    document.getElementById('infoClienteNome').textContent = doc.cliente.nome;
    document.getElementById('infoClienteCpf').textContent = doc.cliente.cpf;
    document.getElementById('infoClienteRg').textContent = doc.cliente.rg;
    document.getElementById('infoClienteOrgao').textContent = doc.cliente.orgao_expedidor;

    // Dates
    document.getElementById('infoDataCadastro').textContent = formatDate(doc.data_cadastro);
    var emissaoTexto = formatDate(doc.data_emissao);
    if (doc.hora_emissao) {
      emissaoTexto += ' às ' + doc.hora_emissao;
    }
    document.getElementById('infoDataEmissao').textContent = emissaoTexto;

    // File
    document.getElementById('infoArquivo').textContent = doc.nome_arquivo;

    // Download
    downloadBtn.href = doc.download_url;

    // Show
    docInfo.classList.add('visible');
    docInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── Date formatting ───────────────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    return dateStr;
  }

  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '—';
    try {
      var date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return dateTimeStr;
      return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR');
    } catch (e) {
      return dateTimeStr;
    }
  }

  // ─── New Verification ───────────────────────────────────────────────────────
  newVerifyBtn.addEventListener('click', function () {
    codigoInput.value = '';
    errorBox.classList.remove('visible');
    docInfo.classList.remove('visible');
    loading.classList.remove('visible');

    // Clear URL params
    var url = new URL(window.location.href);
    url.searchParams.delete('codigo');
    window.history.replaceState(null, '', url.toString());

    codigoInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─── Toast ──────────────────────────────────────────────────────────────────
  var toastTimeout;
  function showToast(message) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimeout = setTimeout(function () {
      toast.classList.remove('visible');
    }, 3000);
  }
});
