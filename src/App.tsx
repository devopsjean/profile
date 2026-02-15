import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import cvData from './content/cv.json'
import navData from './content/nav.json'
import profileData from './content/profile.json'
import timelineData from './content/timeline.json'

type NavFolder = { title: string; type: 'folder'; children: NavNode[] }
type NavPage = { title: string; type: 'page'; slug: string }
type NavNode = NavFolder | NavPage

type TimelineItem = {
  id: string
  group: string
  title: string
  company: string
  location: string
  start: string
  end: string
  tags: string[]
  detail: string
}

type CvSection = { title: string; items: string[] }
type CvPayload = { sections: CvSection[] }

const navTree = navData as NavNode[]
const experiences = timelineData as TimelineItem[]
const cv = cvData as CvPayload

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/profile" replace />} />
      <Route path="/:slug" element={<Workspace />} />
      <Route path="*" element={<Navigate to="/profile" replace />} />
    </Routes>
  )
}

function Workspace() {
  const { slug = 'profile' } = useParams<{ slug: string }>()
  const title = titleForSlug(slug)

  return (
    <div className="app-shell">
      <aside className="left-rail">
        <div className="rail-title">Profile</div>
        <SidebarTree tree={navTree} activeSlug={slug} />
      </aside>
      <main className="doc-view">
        <header className="doc-header">
          <h1>{title}</h1>
          <p>Static profile workspace inspired by Coda-style navigation and document pages.</p>
        </header>
        {renderPage(slug)}
      </main>
    </div>
  )
}

function SidebarTree({ tree, activeSlug }: { tree: NavNode[]; activeSlug: string }) {
  const navigate = useNavigate()
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    Profile: true,
    Experience: true,
    Documents: true,
  })

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  const renderNode = (node: NavNode, path: string) => {
    if (node.type === 'folder') {
      const open = openFolders[path] ?? false
      return (
        <li key={path}>
          <button className="tree-folder" type="button" onClick={() => toggleFolder(path)}>
            <span className="chevron">{open ? '▾' : '▸'}</span>
            {node.title}
          </button>
          {open && <ul className="tree-list">{node.children.map((child) => renderNode(child, `${path}/${child.title}`))}</ul>}
        </li>
      )
    }

    return (
      <li key={path}>
        <button
          className={`tree-page ${activeSlug === node.slug ? 'active' : ''}`}
          type="button"
          onClick={() => navigate(`/${node.slug}`)}
        >
          {node.title}
        </button>
      </li>
    )
  }

  return <ul className="tree-list">{tree.map((node) => renderNode(node, node.title))}</ul>
}

function renderPage(slug: string) {
  if (slug === 'profile') return <ProfilePage />
  if (slug === 'experience-chart') return <ExperienceChartPage items={experiences} />
  if (slug === 'experience-timeline') return <ExperienceTablePage items={experiences} />
  if (slug === 'utm-dev') return <UtmPage />
  if (slug === 'resume') return <ResumePage />
  if (slug === 'resume-ko') return <ResumeKoPage />
  if (slug === 'cv') return <CvPage />

  return (
    <section className="doc-card">
      <h2>Not found</h2>
    </section>
  )
}

function ProfilePage() {
  return (
    <section className="doc-stack">
      <article className="hero-card">
        <div>
          <h2>{profileData.name}</h2>
          <p>{profileData.role}</p>
          <p>
            {profileData.location} | {profileData.email} | {profileData.phone}
          </p>
        </div>
        <div className="focus-row">
          {profileData.focus.map((focus) => (
            <span className="chip" key={focus}>
              {focus}
            </span>
          ))}
        </div>
      </article>

      <article className="doc-card">
        <h3>Summary</h3>
        <p>{profileData.summary}</p>
      </article>

      <article className="doc-card">
        <h3>Links</h3>
        <ul className="plain-list">
          {profileData.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer">
                {link.label}: {link.url}
              </a>
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}

function ExperienceChartPage({ items }: { items: TimelineItem[] }) {
  const years = useMemo(() => {
    const starts = items.map((item) => new Date(item.start).getFullYear())
    const ends = items.map((item) => new Date(item.end).getFullYear())
    const minYear = Math.min(...starts)
    const maxYear = Math.max(...ends)
    return { minYear, maxYear, total: maxYear - minYear + 1 }
  }, [items])

  return (
    <section className="doc-card">
      <h3>Experience Chart</h3>
      <p className="muted">
        Time range: {years.minYear} - {years.maxYear}
      </p>
      <div className="year-grid">
        {Array.from({ length: years.total }).map((_, index) => (
          <span key={years.minYear + index}>{years.minYear + index}</span>
        ))}
      </div>
      <div className="bars">
        {items.map((item) => {
          const start = new Date(item.start).getFullYear()
          const end = new Date(item.end).getFullYear()
          const left = ((start - years.minYear) / years.total) * 100
          const width = ((end - start + 1) / years.total) * 100

          return (
            <div className="bar-row" key={item.id}>
              <div className="bar-title">
                <strong>{item.title}</strong>
                <span>
                  {item.company} | {item.group}
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ left: `${left}%`, width: `${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ExperienceTablePage({ items }: { items: TimelineItem[] }) {
  const ordered = items.slice().sort((a, b) => b.start.localeCompare(a.start))
  return (
    <section className="doc-card">
      <h3>Experience Timeline</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Role</th>
              <th>Group</th>
              <th>Highlights</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.start} - {item.end}
                </td>
                <td>
                  <strong>{item.title}</strong>
                  <div className="muted">
                    {item.company} | {item.location}
                  </div>
                </td>
                <td>{item.group}</td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function UtmPage() {
  return (
    <section className="doc-card">
      <h3>UTM 개발</h3>
      <ul className="plain-list">
        <li>UTM 배포 자동화 파이프라인(Bash) 설계 및 운영</li>
        <li>DNS, VPN, VLAN, 방화벽 정책 운영 및 점검</li>
        <li>패킷 분석 기반 원인 진단(tcpdump, Wireshark, iptables)</li>
        <li>운영 중단을 줄이기 위한 검증 루틴과 로그 체계 개선</li>
      </ul>
    </section>
  )
}

function ResumePage() {
  return (
    <section className="doc-stack">
      <article className="doc-card">
        <h3>Resume</h3>
        <p>
          DevOps engineer focused on Linux operations, incident response, network troubleshooting, and
          deployment automation in production environments.
        </p>
      </article>
      <article className="doc-card">
        <h3>Recent Focus</h3>
        <ul className="plain-list">
          <li>UTM operations and secure infrastructure management</li>
          <li>Kubernetes-based cost visibility and observability</li>
          <li>Reliability-first automation for daily operations</li>
        </ul>
      </article>
    </section>
  )
}

function ResumeKoPage() {
  return (
    <section className="doc-card">
      <h3>국문이력서 요약</h3>
      <p>
        리눅스 기반 인프라 운영, 네트워크 장애 분석, 배포 자동화 경험을 중심으로 DevOps/SRE 역할을 수행하고 있습니다.
        IDC 환경 운영과 실시간 대응 경험을 결합해 운영 안정성과 복구 속도를 개선하는 데 강점이 있습니다.
      </p>
    </section>
  )
}

function CvPage() {
  return (
    <section className="doc-stack">
      {cv.sections.map((section) => (
        <article className="doc-card" key={section.title}>
          <h3>{section.title}</h3>
          <ul className="plain-list">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}

function titleForSlug(slug: string) {
  return flattenPages(navTree).find((page) => page.slug === slug)?.title ?? 'Profile'
}

function flattenPages(nodes: NavNode[]): NavPage[] {
  return nodes.flatMap((node) => (node.type === 'page' ? [node] : flattenPages(node.children)))
}

export default App
