import Link from 'next/link';

const modules = [
  { name: 'NEYVIX ID', status: 'Foundation', detail: 'Identity, sessions and security data model.', href: '/login' },
  { name: 'NEYVIX Mail', status: 'Foundation', detail: 'Mailbox, threads, messages, attachments and contacts.', href: '/mail' },
  { name: 'NEYVIX Admin', status: 'Foundation', detail: 'Operations, security, audit and platform visibility.', href: '/admin' },
  { name: 'NEYVIX Deploy', status: 'MVP', detail: 'Git-to-deploy product surface and deployment data model.', href: '/deploy' },
  { name: 'NEYVIX Chat', status: 'Schema ready', detail: 'Conversations, members and messages are database-ready.' },
  { name: 'NEYVIX Meet', status: 'Schema ready', detail: 'Meeting room and scheduling foundation is defined.' },
  { name: 'NEYVIX Social', status: 'Schema ready', detail: 'Profiles, posts and follow graph foundation.' },
  { name: 'NEYVIX AI', status: 'Integration ready', detail: 'Provider/model interaction audit layer without provider lock-in.' },
  { name: 'NEYVIX Drive', status: 'Schema ready', detail: 'Files, folders, storage keys and metadata model.' },
  { name: 'NEYVIX Docs', status: 'Schema ready', detail: 'Versioned document model connected to Drive.' },
  { name: 'NEYVIX Business', status: 'Schema ready', detail: 'Organizations, members and roles foundation.' },
  { name: 'NEYVIX Pay', status: 'Architecture only', detail: 'Wallet and double-entry ledger foundation. No regulated money movement.' },
  { name: 'NEYVIX Cloud', status: 'Architecture only', detail: 'Cloud resource abstraction connected to deploy projects.' },
];

export default function EcosystemPage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">NEYVIX <span>Ecosystem</span></div>
        <p className="eyebrow">ONE IDENTITY. SHARED PLATFORM.</p>
        <h1>One core, multiple products.</h1>
        <p className="lead">This page tracks the real implementation state of the NEYVIX product family. Foundation means an actual route or core data model exists; schema-ready means the backend contract is defined but the full product is not yet launched.</p>
        <div className="actions">
          <Link className="primary" href="/deploy">Open Deploy</Link>
          <Link className="secondary" href="/">Back to NEYVIX</Link>
        </div>
      </section>

      <section className="grid">
        {modules.map((module, index) => {
          const content = (
            <>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{module.name}</h2>
              <p><strong>{module.status}</strong></p>
              <p>{module.detail}</p>
            </>
          );

          return module.href ? (
            <article key={module.name}><Link href={module.href}>{content}</Link></article>
          ) : (
            <article key={module.name}>{content}</article>
          );
        })}
      </section>
    </main>
  );
}
