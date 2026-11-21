# Operação e publicação

- Repositório: `Salmeida-webdev/alpendre-gestao` (público).
- Aplicação: diretório `public/`.
- Site Netlify planejado: `alpendregestao.netlify.app`, público, sem bloqueio por senha ou SSO.
- API: Worker `alpendre-gestao-api` em `workers.dev` com binding `DB`.
- Banco: D1 `alpendre-gestao-prod`.
- Fuso padrão: `America/Sao_Paulo`; conteúdo de exemplo usa datas ilustrativas de novembro de 2026.

## Desenvolvimento

```bash
python3 -m http.server 8000 --directory public
```

## Alterações de banco

Adicione migrations numeradas em `cloudflare/migrations/` e aplique-as com Wrangler no ambiente correto. Faça backup antes de alterações de dados e verifique o plano de restauração. Nunca rode fixtures demonstrativas sobre um banco real sem conferir `organization_id` e ambiente.

## Produção

A primeira implantação deve ser revisada com o domínio público, CSP, CORS, API e comportamento mobile. A versão demonstrativa não deve receber dados pessoais, documentos de clientes ou credenciais de integração. Não configure a senha pessoal de teste em arquivos ou variáveis públicas.
