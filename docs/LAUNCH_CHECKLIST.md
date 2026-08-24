# NEYVIX — checklist de lançamento

Este checklist separa o que depende do código do que depende de provedores externos.

## Código e banco

- [x] Auth com sessão ativa e revogação após troca de senha
- [x] RBAC para CRO, admin e superadmin
- [x] Planos Start, Pro e Business no modelo canônico
- [x] Enforcement de planos em AI, Studio, Content, Automation, Estate, Mail e Approvals
- [x] Billing webhook idempotente
- [x] Mail com persistência de enviados
- [x] Mail com webhook seguro para recebidos
- [x] Estate com persistência e upload adapter
- [x] Health/Status Center sem exposição de secrets
- [x] PWA com manifest, ícones e service worker
- [x] GitHub CI com audit, typecheck e build

## Integrações externas — obrigatórias antes do lançamento comercial

- [ ] Projeto NEYVIX correto acessível na Vercel
- [ ] `NEYVIX_SESSION_SECRET` configurado em produção
- [ ] `NEYVIX_ENFORCE_PLANS=true` somente após checkout validado
- [ ] URLs HTTPS de checkout Start/Pro/Business configuradas
- [ ] `NEYVIX_BILLING_WEBHOOK_SECRET` configurado no app e no provedor
- [ ] Teste real de pagamento → webhook → assinatura ativa
- [ ] AI Gateway HTTPS + secret configurados e testados
- [ ] Mail transport HTTPS + secret configurados
- [ ] Domínio de e-mail / MX configurado no provedor
- [ ] Webhook de entrada do Mail apontando para `/api/mail/inbound`
- [ ] `MAIL_WEBHOOK_SECRET` configurado no app e no provedor
- [ ] Storage upload HTTPS + secret configurados
- [ ] Upload real do Estate validado em produção

## Smoke test final

1. Abrir `/api/health` e confirmar `ok=true` e `launchReady=true`.
2. Criar uma conta nova e confirmar trial.
3. Entrar, sair e entrar novamente.
4. Testar AI, Studio e Content.
5. Testar bloqueio por plano em recurso não contratado.
6. Realizar checkout real e confirmar mudança automática da assinatura.
7. Enviar um e-mail externo e confirmar pasta de enviados.
8. Receber um e-mail externo e confirmar inbox sem duplicação.
9. Criar um projeto Estate com upload de imagem.
10. Instalar a PWA no celular e abrir em modo standalone.
11. Redefinir senha e confirmar que a sessão antiga é invalidada.
12. Abrir Admin/User 360 com conta CRO e confirmar RBAC.

O lançamento comercial só deve ser marcado como concluído após todos os itens externos e o smoke test final estarem verdes.
