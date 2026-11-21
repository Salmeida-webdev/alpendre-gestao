# Alpendre Gestão

SaaS white label para organizar a operação de escritórios de arquitetura, da primeira conversa ao pós-obra.

## Primeira versão demonstrativa

- Landing page responsiva e painel navegável com 19 módulos.
- Indicadores, CRM, quadro de projetos, registros detalhados, tarefas, exportação CSV e formulários de demonstração.
- Dados sintéticos, sem dados de clientes reais; notas de rodapé identificam o conteúdo fictício.
- Aplicação estática em `public/`; as alterações criadas no painel de demonstração ficam no navegador atual.
- API Cloudflare Worker com consulta de saúde e leitura do resumo de amostras fictícias no D1.
- Migração D1 com organizações, usuários, associações, sessões, projetos, clientes, tarefas, financeiro, arquivos, auditoria, integrações, assinaturas e amostras de demonstração.

## Estrutura

```text
public/                 Landing page, painel, estilos, marca e manifesto PWA
cloudflare/worker.js    API de saúde e endpoint de resumo fictício
cloudflare/migrations/  Esquema multiempresa e dados de demonstração
wrangler.toml           Binding Cloudflare D1
netlify.toml            Publicação estática e cabeçalhos HTTP de segurança
```

## Desenvolvimento local

```bash
python3 -m http.server 8000 --directory public
```

O app funciona sem bundler. Se o endpoint de demonstração estiver inacessível, a interface usa somente os dados locais fictícios.

## Cloudflare

A API é `alpendre-gestao-api` e usa o banco `alpendre-gestao-prod`, com o binding `DB`. A rota pública contém somente estado de saúde e estatísticas de registros sintéticos. Endpoints privados em `/api/*` retornam 401 até a integração de autenticação ser configurada.

Para ativar escrita e dados reais, implementar fluxo de convite/login com provedor de identidade ou autenticação segura, MFA, autorização por organização e papel, proteção CSRF para cookies, rate limits, retenção e política de privacidade. Segredos de provedores devem ser guardados em secrets do Worker e nunca no repositório ou no frontend. A tabela `sessions` armazena apenas hashes de tokens e prazos; a tabela `audit_events` mantém trilha de alterações por organização.

## Netlify e publicação

A aplicação publica a pasta `public`. O projeto final deve ser conectado ao repositório `Salmeida-webdev/alpendre-gestao`, com `alpendregestao.netlify.app` como domínio principal e acesso público. Não há configuração ou dependência do selo “Powered by Netlify”. Cabeçalhos CSP, HSTS, nosniff, frame-ancestors e Permissions-Policy ficam em `netlify.toml`.

## Integrações preparadas

- D1: dados estruturados e isolamento lógico por `organization_id`.
- R2: `object_key` e metadados de arquivos preparados; bucket e política de acesso privado devem ser ligados antes de upload real.
- E-mail, assinatura digital, pagamentos SaaS, emissão fiscal, calendário e DNS: telas e pontos de configuração previstos; credenciais e contas do escritório ainda precisam ser fornecidas no ambiente apropriado.
- RRT e licenças: acompanhamento e registro de situação; o app não declara integração oficial com CAU ou municípios.

## Requisitos para produção com dados reais

Esta versão demonstra os fluxos e a arquitetura; não deve ser usada para armazenar dados reais antes de configurar autenticação, políticas de autorização, uploads privados, monitoramento e recuperação, gestão de consentimentos e retenção, além de testar os controles de segurança. A demonstração pública não solicita senha nem oferece acesso a registros de produção.

## Segurança e arquitetura

Leia [SECURITY.md](SECURITY.md), [docs/arquitetura.md](docs/arquitetura.md) e [docs/operacao.md](docs/operacao.md) para conhecer os limites desta demonstração, os controles já presentes e os requisitos antes de armazenar dados reais.
