import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
type TimelineMode = 'multi-year' | 'today' | 'fit'

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
        <div className="rail-title">Profile</div>
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
  if (slug === 'experience-chart') return <ExperienceChartTable items={experiences} selectedItemId={null} />
  if (slug === 'experience-timeline')
    return <ExperienceTimelineBoard items={experiences} onSelectItem={() => undefined} selectedItemId={null} />
  if (slug === 'resume') return <ResumePage />
  if (slug === 'cv') return <CvPage />

  return (
    <section className="doc-card">
      <h2>Not found</h2>
    </section>
  )
}

function ProfilePage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const handleSelectTimelineItem = (itemId: string) => {
    setSelectedItemId(itemId)
    requestAnimationFrame(() => {
      const row = document.getElementById(`detail-row-${itemId}`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <section className="doc-stack">
      <article className="hero-card">
        <h2>{profileData.role}</h2>
        <p>
          {profileData.location} | {profileData.email}
        </p>
      </article>
      <ExperienceTimelineBoard items={experiences} onSelectItem={handleSelectTimelineItem} selectedItemId={selectedItemId} />
      <ExperienceChartTable items={experiences} selectedItemId={selectedItemId} />
    </section>
  )
}

function ExperienceTimelineBoard({
  items,
  onSelectItem,
  selectedItemId,
}: {
  items: TimelineItem[]
  onSelectItem: (itemId: string) => void
  selectedItemId: string | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<TimelineMode>('multi-year')

  const ordered = useMemo(() => items.slice().sort((a, b) => a.start.localeCompare(b.start)), [items])
  const dataRange = useMemo(() => {
    const minDate = new Date(Math.min(...ordered.map((item) => new Date(item.start).getTime())))
    const maxDate = new Date(Math.max(...ordered.map((item) => new Date(item.end).getTime())))
    const minYear = minDate.getFullYear()
    const maxYear = maxDate.getFullYear()
    return { minYear, maxYear }
  }, [ordered])

  const model = useMemo(() => {
    const currentYear = new Date().getFullYear()
    if (mode === 'today') {
      const minYear = currentYear - 2
      const maxYear = currentYear + 2
      return { minYear, maxYear, totalQuarters: (maxYear - minYear + 1) * 4 }
    }
    if (mode === 'fit') {
      const minYear = dataRange.minYear
      const maxYear = dataRange.maxYear
      return { minYear, maxYear, totalQuarters: (maxYear - minYear + 1) * 4 }
    }
    const minYear = dataRange.minYear
    const maxYear = Math.max(dataRange.maxYear, currentYear + 2)
    return { minYear, maxYear, totalQuarters: (maxYear - minYear + 1) * 4 }
  }, [dataRange, mode])

  const rowsHeight = ordered.length * 48 + 28
  const currentQuarterIndex = quarterIndexFromModel(new Date(), model.minYear)

  const setFit = () => setMode('fit')
  const setToday = () => setMode('today')
  const setMultiYear = () => setMode('multi-year')

  return (
    <article className="doc-card">
      <div className="section-head">
        <h3>Experience Timeline</h3>
        <div className="timeline-controls">
          <button className={mode === 'multi-year' ? 'active' : ''} type="button" onClick={setMultiYear}>
            Multi-Year
          </button>
          <button className={mode === 'today' ? 'active' : ''} type="button" onClick={setToday}>
            Today
          </button>
          <button className={mode === 'fit' ? 'active' : ''} type="button" onClick={setFit}>
            Fit
          </button>
        </div>
      </div>

      <div className="timeline-panel" ref={scrollRef}>
        <div className="timeline-inner" style={{ '--quarters': `${model.totalQuarters}` } as CSSProperties}>
          <div className="timeline-sticky">
            <div className="timeline-years">
              {Array.from({ length: model.maxYear - model.minYear + 1 }).map((_, i) => {
                const year = model.minYear + i
                return (
                  <div key={year}>
                    {year}
                  </div>
                )
              })}
            </div>
            <div className="timeline-quarters">
              {Array.from({ length: model.totalQuarters }).map((_, i) => {
                const isCurrent = i === currentQuarterIndex
                return (
                  <span className={isCurrent ? 'current-quarter' : ''} key={`q-${model.minYear}-${i}`}>
                    {(i % 4) + 1}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="timeline-body" style={{ minHeight: `${rowsHeight}px` }}>
            {ordered.map((item, idx) => {
              const s = quarterIndexFromModel(new Date(item.start), model.minYear)
              const e = quarterIndexFromModel(new Date(item.end), model.minYear)
              const start = Math.max(s, 0)
              const end = Math.min(e, model.totalQuarters - 1)
              if (end < 0 || start >= model.totalQuarters) return null

              return (
                <button
                  className={`timeline-pill ${selectedItemId === item.id ? 'active' : ''}`}
                  key={item.id}
                  type="button"
                  title={`${item.title} (${item.start} - ${item.end})`}
                  onClick={() => onSelectItem(item.id)}
                  style={{
                    top: `${idx * 48 + 10}px`,
                    left: `calc((${start} / var(--quarters)) * 100% + 2px)`,
                    width: `max(calc(((${end - start + 1}) / var(--quarters)) * 100% - 4px), 92px)`,
                  }}
                >
                  {item.group} {item.title}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </article>
  )
}

function ExperienceChartTable({ items, selectedItemId }: { items: TimelineItem[]; selectedItemId: string | null }) {
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
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr id={`detail-row-${item.id}`} key={item.id} className={selectedItemId === item.id ? 'selected-row' : ''}>
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

function quarterIndexFromModel(date: Date, minYear: number) {
  return (date.getFullYear() - minYear) * 4 + Math.floor(date.getMonth() / 3)
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
