# Segurança e limites da demonstração

## Estado desta versão

O site público é uma demonstração com dados sintéticos. O painel permite experimentar cadastros no navegador e exportar registros; esses dados ficam no `localStorage` do navegador. Não insira dados pessoais ou documentos reais. O endpoint público do Worker lê somente estatísticas do conjunto fictício do D1. Rotas `/api/*` fora dessa leitura respondem `401`; escritas na API não estão habilitadas.

O projeto ainda não está aprovado para produção com dados de clientes. O modelo de identidade, os limites de tenant e a estrutura de auditoria estão documentados e parte deles já existe no esquema D1, mas a autenticação e autorização para sessões reais ainda precisam ser implementadas e revisadas antes de abrir cadastros reais.

## Controles já presentes

- CORS da API limitado ao domínio Netlify planejado e origens locais de desenvolvimento.
- Worker responde somente a `GET` para saúde e resumo demonstrativo; demais métodos recebem `405`.
- Respostas JSON não armazenáveis em cache, `nosniff`, `no-referrer`, `frame` negado e HSTS.
- Cabeçalhos de segurança, CSP restritiva para scripts, política de permissões e sem uso de credenciais no frontend.
- Banco D1 com chaves estrangeiras, índices e `organization_id` nas entidades operacionais.
- Tabelas separadas para organizações, usuários, associações, sessões com hash, auditoria, integrações e assinatura SaaS.
- Conteúdo digitado no painel é escapado antes de renderizar HTML.
- Sem login/senha de teste embutidos no código, fixtures ou README.

## Requisitos antes de dados reais

1. Adotar OIDC ou autenticação confiável, MFA e recuperação de conta; armazenar sessão em cookie `HttpOnly`, `Secure` e `SameSite`, com CSRF para operações mutáveis.
2. Criar autorização central no Worker. Cada consulta deve derivar `organization_id` da sessão verificada, nunca de um parâmetro confiado do browser; testar isolamento entre tenants e acesso mínimo por papel.
3. Adicionar trilha de auditoria imutável para leitura/exportação sensível, mudanças de permissão, alterações financeiras e operações administrativas.
4. Guardar segredos só como secrets do Worker. Fazer rotação e limitar escopos; nenhuma chave privada ou token em Netlify, JavaScript do browser, commits ou logs.
5. Mover documentos para R2 privado, usar URLs curtas assinadas, validar extensão/MIME/tamanho, antivírus, autorização por organização e expiração de link.
6. Aplicar rate limits, proteção contra abuso, limites de payload, validação de entrada no servidor, idempotência de webhooks e assinatura/verificação de callbacks.
7. Definir backup e restauração testados, retenção, exportação e exclusão sob solicitação, plano de incidentes, monitoramento e alertas.
8. Publicar política de privacidade, termos, base legal, subprocessadores e fluxo LGPD; retirar analytics e formulários de produção até definir consentimento e retenção.
9. Executar revisão de segurança e testes de autorização antes de habilitar clientes, equipe ou integrações de terceiros.

## Papéis previstos

- `owner` e `admin`: gestão da organização e equipe com auditoria.
- `architect`: projetos e documentos autorizados.
- `assistant`: agenda, CRM e tarefas conforme concessões da organização.
- `finance`: financeiro e relatórios financeiros, sem privilégios de gestão de acesso.
- `client`: apenas aprovações e arquivos compartilhados daquele projeto.
- `platform_operator`: acesso operacional separado, justificado e auditado; sem leitura ampla de documentos por padrão.

Os papéis ainda não representam autorização ativa no front-end de demonstração. A aplicação real deve aplicar permissões no Worker em toda rota e consulta.
