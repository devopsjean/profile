import { useEffect, useMemo, useState, type CSSProperties } from 'react'
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

type ThemeMode = 'dark' | 'light'

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
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem('profile-theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    window.localStorage.setItem('profile-theme', theme)
  }, [theme])

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className="left-rail">
        <div className="rail-top">
          <div className="rail-title">Profile</div>
        </div>
        <SidebarTree tree={navTree} activeSlug={slug} />
      </aside>
      <main className="doc-view">
        <header className="doc-header">
          <div>
            <h1>{title}</h1>
            <p>{profileData.name}</p>
          </div>
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
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
  if (slug === 'experience-chart') return <ExperienceChartTable items={experiences} />
  if (slug === 'experience-timeline') return <ExperienceTimelineBoard items={experiences} />
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
        <h2>{profileData.role}</h2>
        <p>
          {profileData.location} | {profileData.email}
        </p>
      </article>
      <ExperienceTimelineBoard items={experiences} />
      <ExperienceChartTable items={experiences} />
    </section>
  )
}

function ExperienceTimelineBoard({ items }: { items: TimelineItem[] }) {
  const model = useMemo(() => {
    const minDate = new Date(Math.min(...items.map((item) => new Date(item.start).getTime())))
    const maxDate = new Date(Math.max(...items.map((item) => new Date(item.end).getTime())))
    const minYear = minDate.getFullYear()
    const maxYear = maxDate.getFullYear()
    const totalQuarters = (maxYear - minYear + 1) * 4

    return { minYear, maxYear, totalQuarters }
  }, [items])

  const ordered = useMemo(() => items.slice().sort((a, b) => a.start.localeCompare(b.start)), [items])

  return (
    <article className="doc-card">
      <div className="section-head">
        <h3>Experience Timeline</h3>
        <div className="timeline-controls">
          <span>Multi-Year</span>
          <span>Today</span>
          <span>Fit</span>
        </div>
      </div>

      <div className="timeline-scroll">
        <div
          className="timeline-canvas"
          style={
            {
              '--quarters': model.totalQuarters,
            } as CSSProperties
          }
        >
          <div className="timeline-years">
            {Array.from({ length: model.maxYear - model.minYear + 1 }).map((_, i) => {
              const year = model.minYear + i
              return (
                <div key={year} style={{ width: `${(4 / model.totalQuarters) * 100}%` }}>
                  {year}
                </div>
              )
            })}
          </div>

          <div className="timeline-quarters">
            {Array.from({ length: model.maxYear - model.minYear + 1 }).map((_, i) => {
              const year = model.minYear + i
              return (
                <div className="quarter-year" key={`qy-${year}`}>
                  {[1, 2, 3, 4].map((q) => (
                    <span key={`${year}-q${q}`}>{q}</span>
                  ))}
                </div>
              )
            })}
          </div>

          <div className="timeline-grid">
            {ordered.map((item, idx) => {
              const s = new Date(item.start)
              const e = new Date(item.end)
              const startQuarterIndex = (s.getFullYear() - model.minYear) * 4 + Math.floor(s.getMonth() / 3)
              const endQuarterIndex = (e.getFullYear() - model.minYear) * 4 + Math.floor(e.getMonth() / 3)
              const left = (startQuarterIndex / model.totalQuarters) * 100
              const width = ((endQuarterIndex - startQuarterIndex + 1) / model.totalQuarters) * 100

              return (
                <div className="timeline-row" key={item.id}>
                  <span
                    className="timeline-pill"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 5)}%`,
                      top: `${idx * 42 + 8}px`,
                    }}
                  >
                    {item.group} {item.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </article>
  )
}

function ExperienceChartTable({ items }: { items: TimelineItem[] }) {
  return (
    <article className="doc-card">
      <h3>Experience Chart</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="title-main">{item.group}</div>
                  <div className="title-sub">{item.title}</div>
                </td>
                <td>{item.start}</td>
                <td>{item.end}</td>
                <td>{item.tags[0] ?? item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
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
    <section className="doc-card">
      <h3>Resume</h3>
      <p>
        DevOps engineer focused on Linux operations, incident response, network troubleshooting, and
        deployment automation in production environments.
      </p>
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
