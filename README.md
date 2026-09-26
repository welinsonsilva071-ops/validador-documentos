# 🔐 Validador de Documentos PDF com QR Code

Sistema web profissional para emissão, selagem e verificação pública de autenticidade de documentos PDF.

---

## 🌟 Recursos

- **Cadastro Completo**:
  - Dados da Empresa (Razão Social, CNPJ com máscara).
  - Dados do Cliente (Nome completo, CPF com máscara, RG, Órgão Expedidor, Data de Cadastro).
  - **Data de Emissão do Documento**: Permite cadastrar datas atuais ou **retroativas**.
- **Selagem Automática em PDF**:
  - Geração de **QR Code de alta definição** e **Código de Validação único** (alfanumérico de 8 caracteres).
  - Rodapé estilizado impresso em todas as páginas contendo data de emissão, data de selagem, informações da empresa, cliente e link direto de validação.
- **Página de Verificação Isolada**:
  - Acesso público exclusivo para consulta (`/verificar.html`).
  - Sem atalhos ou links para o painel de emissão.
  - Bloqueio de histórico: pressionar "Voltar" no navegador não permite entrar na tela de emissão.
  - Consulta manual digitando o código ou leitura instantânea com câmera via scanner QR Code.
  - Exibição de todos os dados registrados e botão para download do PDF original selado.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18+)
- NPM ou Yarn

### Passos
```bash
# Clone o repositório
git clone https://github.com/SEU-USUARIO/validador-documentos.git
cd validador-documentos

# Instale as dependências
npm install

# Inicie o servidor
npm start
```

Acesse:
- **Painel de Emissão / Cadastro**: `http://localhost:3000/`
- **Página Pública de Verificação**: `http://localhost:3000/verificar.html`

---

## 🌐 Como Colocar em Produção (Sem Localhost)

Para que o QR Code e o link funcionem em qualquer celular e computador do mundo com seu domínio profissional:

1. **Defina a variável `BASE_URL`**:
   No arquivo `.env` ou nas variáveis de ambiente da sua hospedagem:
   ```env
   PORT=3000
   BASE_URL=https://validador.suaempresa.com.br
   ```
2. **Opções recomendadas de deploy**:
   - **Render / Railway / Fly.io**: Basta conectar seu repositório do GitHub e definir a variável `BASE_URL`.
   - **VPS (Ubuntu / Debian / Nginx)**: Instale com `pm2` e configure Nginx com SSL grátis (Let's Encrypt).
