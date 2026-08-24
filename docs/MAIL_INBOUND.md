# NEYVIX Mail — entrada de mensagens

Endpoint de entrada: `POST /api/mail/inbound`

O provedor externo deve enviar o header `x-neyvix-mail-secret` com o mesmo segredo configurado em `MAIL_WEBHOOK_SECRET`.

Payload JSON aceito:

```json
{
  "providerMessageId": "provider-unique-id",
  "from": "sender@example.com",
  "to": "user@neyvix.com",
  "subject": "Assunto",
  "text": "Conteúdo em texto",
  "html": "<p>Conteúdo opcional</p>",
  "receivedAt": "2026-08-24T12:00:00Z"
}
```

Também são aceitos os aliases `messageId`/`id`, `sender`, `recipient`, `bodyText`, `bodyHtml` e `timestamp`.

Regras operacionais:

- somente HTTPS deve ser usado pelo provedor;
- o segredo nunca deve ser incluído na URL;
- o destinatário precisa corresponder a uma conta NEYVIX ativa;
- `providerMessageId` deve ser estável e único por mensagem;
- reentregas do mesmo evento são idempotentes e não duplicam a mensagem;
- mensagens recebidas entram na pasta `inbox` como não lidas;
- payloads acima dos limites ou e-mails inválidos são rejeitados;
- o endpoint não depende da sessão do usuário, somente da autenticação do provedor.

Antes do lançamento, configurar o domínio MX/roteamento do provedor para encaminhar as mensagens recebidas para esse webhook e executar um teste real de entrega.
