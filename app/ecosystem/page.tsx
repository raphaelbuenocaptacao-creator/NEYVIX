import Link from "next/link";

const modules = [
  { name: "NEYVIX ID", status: "Beta", detail: "Identidade única, sessão assinada, trial e validação de conta ativa.", href: "/login" },
  { name: "NEYVIX AI", status: "Beta", detail: "Assistente com gateway configurável, persistência e histórico de mensagens.", href: "/ai" },
  { name: "NEYVIX Studio", status: "Beta", detail: "Transforma ideias em blueprints e mantém uma biblioteca persistida de projetos.", href: "/studio" },
  { name: "NEYVIX Content", status: "Beta", detail: "Geração de campanhas e conteúdo com histórico persistido.", href: "/content" },
  { name: "NEYVIX Automation", status: "Beta", detail: "Workflows, execuções e aprovações para ações sensíveis.", href: "/automation" },
  { name: "NEYVIX Estate", status: "Beta", detail: "Builder imobiliário com múltiplos imóveis, publicação e página pública.", href: "/estate" },
  { name: "NEYVIX Mail", status: "MVP", detail: "Base autenticada de caixa postal e mensagens; transporte externo ainda será conectado.", href: "/mail" },
  { name: "NEYVIX Admin", status: "Beta", detail: "User 360, operação, acesso, atividade e visibilidade administrativa.", href: "/admin" },
  { name: "NEYVIX Deploy", status: "MVP", detail: "Superfície de publicação e acompanhamento da camada de deploy.", href: "/deploy" },
  { name: "NEYVIX PWA", status: "Installable-ready", detail: "Manifest, service worker, modo standalone e atalhos do ecossistema.", href: "/dashboard" },
  { name: "NEYVIX Drive", status: "MVP", detail: "Pastas privadas persistidas com navegação, renomeação e exclusão segura; upload de arquivos ainda não está habilitado.", href: "/drive" },
  { name: "NEYVIX Docs", status: "MVP", detail: "Documentos privados persistidos, editáveis e versionados com proteção contra sobrescrita concorrente.", href: "/docs" },
  { name: "NEYVIX Calendar", status: "Planejado", detail: "Agenda compartilhada para pessoas, equipes e automações." },
  { name: "NEYVIX Meet", status: "Planejado", detail: "Reuniões e salas conectadas ao NEYVIX ID e Calendar." },
  { name: "NEYVIX Business", status: "Planejado", detail: "Organizações, membros, funções e administração empresarial." },
  { name: "NEYVIX Pay", status: "Arquitetura", detail: "Camada futura de cobrança e ledger; sem movimentação financeira regulada neste estágio." },
  { name: "NEYVIX Cloud", status: "Arquitetura", detail: "Abstração futura de recursos de infraestrutura conectados ao Deploy." },
];

export default function EcosystemPage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>ECOSSISTEMA</span></div>
        <p className="eyebrow">UMA IDENTIDADE. UMA PLATAFORMA.</p>
        <h1>Um núcleo. Produtos que trabalham juntos.</h1>
        <p className="lead">Este mapa mostra o estado real da família NEYVIX. Beta indica produto funcional em evolução; MVP indica a primeira experiência utilizável; Planejado e Arquitetura identificam os próximos produtos sem apresentá-los como concluídos.</p>
        <div className="actions">
          <Link className="primary" href="/dashboard">Abrir Central de Comando</Link>
          <Link className="secondary" href="/">Voltar ao NEYVIX</Link>
        </div>
      </section>

      <section className="grid">
        {modules.map((module, index) => {
          const content = <><span>{String(index + 1).padStart(2, "0")}</span><h2>{module.name}</h2><p><strong>{module.status}</strong></p><p>{module.detail}</p></>;
          return module.href ? <article key={module.name}><Link href={module.href}>{content}</Link></article> : <article key={module.name}>{content}</article>;
        })}
      </section>
    </main>
  );
}
