import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import navData from './content/nav.json'
import profileData from './content/profile.json'
import timelineData from './content/timeline.json'

type NavFolder = { title: string; type: 'folder'; slug?: string; children: NavNode[] }
type NavPage = { title: string; type: 'page'; slug: string }
type NavAnchor = { title: string; type: 'anchor'; slug: string; targetId: string }
type NavNode = NavFolder | NavPage | NavAnchor

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

type ThemeMode = 'dark' | 'light'
type TimelineMode = 'multi-year' | 'today' | 'fit'

const navTree = navData as NavNode[]
const experiences = timelineData as TimelineItem[]

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
  const navigate = useNavigate()
  const normalizedSlug = normalizeSlug(slug)
  const [activeMenuId, setActiveMenuId] = useState(() => {
    if (slug === 'experience-timeline') return 'Profile/Timeline'
    if (slug === 'experience-chart') return 'Profile/Timetable'
    if (slug === 'sre-mini-project') return 'Projects/SRE-mini-project'
    return 'Profile'
  })
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem('profile-theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    window.localStorage.setItem('profile-theme', theme)
  }, [theme])

  useEffect(() => {
    if (normalizedSlug !== slug) {
      navigate(`/${normalizedSlug}`, { replace: true })
      return
    }

    if (normalizedSlug === 'profile') {
      const sectionToFocus = activeMenuId === 'Profile/Timetable' ? 'timetable-section' : 'timeline-section'
      requestAnimationFrame(() => scrollToTarget(sectionToFocus))
    }
  }, [activeMenuId, navigate, normalizedSlug, slug])

  const handleMenuAction = (node: NavPage | NavAnchor, menuId: string) => {
    setActiveMenuId(menuId)

    if (node.type === 'page') {
      navigate(`/${node.slug}`)
      return
    }

    if (normalizedSlug !== node.slug) {
      navigate(`/${node.slug}`)
      setTimeout(() => scrollToTarget(node.targetId), 120)
      return
    }
    scrollToTarget(node.targetId)
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className="left-rail">
        <div className="rail-title">Profile</div>
        <SidebarTree tree={navTree} activeMenuId={activeMenuId} onMenuAction={handleMenuAction} />
      </aside>

      <main className="doc-view">
        <header className="doc-header">
          <div>
            <h1>{normalizedSlug === 'sre-mini-project' ? 'SRE-mini-project' : 'Profile'}</h1>
            <p>{profileData.name}</p>
          </div>
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        {normalizedSlug === 'profile' ? <ProfilePage /> : <SreMiniProjectPage />}
      </main>
    </div>
  )
}

function SidebarTree({
  tree,
  activeMenuId,
  onMenuAction,
}: {
  tree: NavNode[]
  activeMenuId: string
  onMenuAction: (node: NavPage | NavAnchor, menuId: string) => void
}) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ Profile: true, Projects: true })
  const toggleFolder = (path: string) => setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }))

  const renderNode = (node: NavNode, path: string) => {
    if (node.type === 'folder') {
      const open = openFolders[path] ?? false
      return (
        <li key={path}>
          <div className={`tree-folder-row ${activeMenuId === path ? 'active' : ''}`}>
            <button
              className="tree-folder-link"
              type="button"
              onClick={() => {
                if (node.slug) onMenuAction({ title: node.title, type: 'page', slug: node.slug }, path)
                else toggleFolder(path)
              }}
            >
              {node.title}
            </button>
            <button className="tree-folder-toggle" type="button" onClick={() => toggleFolder(path)} aria-label="Toggle section">
              {open ? '▾' : '▸'}
            </button>
          </div>
          {open && <ul className="tree-list">{node.children.map((child) => renderNode(child, `${path}/${child.title}`))}</ul>}
        </li>
      )
    }

    return (
      <li key={path}>
        <button className={`tree-page ${activeMenuId === path ? 'active' : ''}`} type="button" onClick={() => onMenuAction(node, path)}>
          {node.title}
        </button>
      </li>
    )
  }

  return <ul className="tree-list">{tree.map((node) => renderNode(node, node.title))}</ul>
}

function ProfilePage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [timelineJumpItemId, setTimelineJumpItemId] = useState<string | null>(null)

  const handleSelectTimelineItem = (itemId: string) => {
    setSelectedItemId(itemId)
    requestAnimationFrame(() => {
      document.getElementById(`detail-row-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const handleTableDoubleClick = (itemId: string) => {
    setSelectedItemId(itemId)
    setTimelineJumpItemId(itemId)
    requestAnimationFrame(() => {
      document.getElementById('timeline-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <section className="profile-dashboard">
      <article className="hero-card">
        <h2>{profileData.role}</h2>
        <p>
          {profileData.location} | {profileData.email}
        </p>
      </article>

      <article id="timeline-section" className="doc-card dashboard-timeline">
        <ExperienceTimelineBoard
          items={experiences}
          onSelectItem={handleSelectTimelineItem}
          selectedItemId={selectedItemId}
          jumpToItemId={timelineJumpItemId}
        />
      </article>

      <article id="timetable-section" className="doc-card dashboard-table">
        <ExperienceChartTable items={experiences} selectedItemId={selectedItemId} onDoubleClickItem={handleTableDoubleClick} />
      </article>
    </section>
  )
}

function ExperienceTimelineBoard({
  items,
  onSelectItem,
  selectedItemId,
  jumpToItemId,
}: {
  items: TimelineItem[]
  onSelectItem: (itemId: string) => void
  selectedItemId: string | null
  jumpToItemId: string | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<TimelineMode>('fit')
  const [quarterWidth, setQuarterWidth] = useState(58)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)

  const ordered = useMemo(() => items.slice().sort((a, b) => a.start.localeCompare(b.start)), [items])
  const baseRange = useMemo(() => {
    const minDate = new Date(Math.min(...ordered.map((item) => new Date(item.start).getTime())))
    const maxDate = new Date(Math.max(...ordered.map((item) => new Date(item.end).getTime())))
    return { minYear: minDate.getFullYear(), maxYear: maxDate.getFullYear() }
  }, [ordered])

  const model = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const minYear = Math.min(baseRange.minYear, currentYear) - 20
    const maxYear = Math.max(baseRange.maxYear, currentYear) + 20
    return { minYear, maxYear, totalQuarters: (maxYear - minYear + 1) * 4 }
  }, [baseRange])

  const dataQuarters = (baseRange.maxYear - baseRange.minYear + 1) * 4
  const rowsHeight = ordered.length * 42 + 20
  const currentQuarterIndex = quarterIndexFromModel(new Date(), model.minYear)
  const canvasWidth = model.totalQuarters * quarterWidth
  const nowX = quarterPositionFromModel(new Date(), model.minYear) * quarterWidth

  const scrollToQuarter = (quarter: number, width: number) => {
    if (!scrollRef.current) return
    const viewport = scrollRef.current.clientWidth
    scrollRef.current.scrollTo({ left: Math.max(quarter * width - viewport / 2, 0), behavior: 'smooth' })
  }

  const setMultiYear = () => {
    const width = 58
    setQuarterWidth(width)
    setMode('multi-year')
    requestAnimationFrame(() => {
      const start = quarterIndexFromModel(new Date(`${baseRange.minYear}-01-01`), model.minYear)
      const end = quarterIndexFromModel(new Date(`${baseRange.maxYear}-12-31`), model.minYear)
      scrollToQuarter((start + end) / 2, width)
    })
  }

  const setToday = () => {
    const width = 92
    setQuarterWidth(width)
    setMode('today')
    requestAnimationFrame(() => scrollToQuarter(currentQuarterIndex, width))
  }

  const setFit = () => {
    const viewport = scrollRef.current?.clientWidth ?? 1100
    const width = Math.max(24, Math.min(140, Math.floor(viewport / dataQuarters)))
    setQuarterWidth(width)
    setMode('fit')
    requestAnimationFrame(() => {
      const start = quarterIndexFromModel(new Date(`${baseRange.minYear}-01-01`), model.minYear)
      const end = quarterIndexFromModel(new Date(`${baseRange.maxYear}-12-31`), model.minYear)
      scrollToQuarter((start + end) / 2, width)
    })
  }

  useEffect(() => {
    setFit()
    // Initial view must open in fit mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const syncScroll = () => {
      setScrollLeft(node.scrollLeft)
      setViewportWidth(node.clientWidth)
    }
    syncScroll()
    node.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('resize', syncScroll)
    return () => {
      node.removeEventListener('scroll', syncScroll)
      window.removeEventListener('resize', syncScroll)
    }
  }, [])

  useEffect(() => {
    if (!jumpToItemId || !scrollRef.current) return
    const target = ordered.find((item) => item.id === jumpToItemId)
    if (!target) return
    const s = quarterIndexFromModel(new Date(target.start), model.minYear)
    const e = quarterIndexFromModel(new Date(target.end), model.minYear)
    scrollToQuarter((s + e) / 2, quarterWidth)
  }, [jumpToItemId, model.minYear, ordered, quarterWidth])

  return (
    <>
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
        <div className="timeline-inner" style={{ '--quarters': `${model.totalQuarters}`, '--q-width': `${quarterWidth}px`, width: `${canvasWidth}px` } as CSSProperties}>
          <div className="timeline-sticky">
            <div className="timeline-years">
              {Array.from({ length: model.maxYear - model.minYear + 1 }).map((_, i) => (
                <div key={model.minYear + i}>{model.minYear + i}</div>
              ))}
            </div>
            <div className="timeline-quarters">
              {Array.from({ length: model.totalQuarters }).map((_, i) => (
                <span className={i === currentQuarterIndex ? 'current-quarter' : ''} key={`q-${i}`}>
                  {(i % 4) + 1}
                </span>
              ))}
            </div>
          </div>

          <div className="timeline-body" style={{ minHeight: `${rowsHeight}px` }}>
            <div className="timeline-now-line" style={{ left: `${nowX}px` }} aria-hidden />
            {ordered.map((item, idx) => {
              const s = quarterIndexFromModel(new Date(item.start), model.minYear)
              const e = quarterIndexFromModel(new Date(item.end), model.minYear)
              const start = Math.max(s, 0)
              const end = Math.min(e, model.totalQuarters - 1)
              if (end < 0 || start >= model.totalQuarters) return null
              const leftPx = start * quarterWidth + 2
              const widthPx = Math.max((end - start + 1) * quarterWidth - 4, 86)
              const topPx = idx * 42 + 8
              const hasPastOverflow = leftPx < scrollLeft + 2
              const hasFutureOverflow = leftPx + widthPx > scrollLeft + viewportWidth - 2

              return (
                <div key={item.id}>
                  {hasPastOverflow && (
                    <button
                      className="timeline-overflow-arrow"
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      title={`Earlier segment exists: ${item.group} ${item.title}`}
                      style={{ top: `${topPx + 4}px`, left: `${scrollLeft + 6}px` }}
                    >
                      ←
                    </button>
                  )}
                  {hasFutureOverflow && (
                    <button
                      className="timeline-overflow-arrow right"
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      title={`Future segment exists: ${item.group} ${item.title}`}
                      style={{ top: `${topPx + 4}px`, left: `${Math.max(scrollLeft + viewportWidth - 28, scrollLeft + 6)}px` }}
                    >
                      →
                    </button>
                  )}
                  <button
                    className={`timeline-pill ${selectedItemId === item.id ? 'active' : ''}`}
                    type="button"
                    title={`${item.title} (${item.start} - ${item.end})`}
                    onClick={() => onSelectItem(item.id)}
                    style={{ top: `${topPx}px`, left: `${leftPx}px`, width: `${widthPx}px` }}
                  >
                    <span className="timeline-pill-label">
                      {item.group} {item.title}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

function ExperienceChartTable({
  items,
  selectedItemId,
  onDoubleClickItem,
}: {
  items: TimelineItem[]
  selectedItemId: string | null
  onDoubleClickItem: (itemId: string) => void
}) {
  return (
    <>
      <h3>Experience Timetable</h3>
      <div className="table-wrap compact">
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
              <tr
                id={`detail-row-${item.id}`}
                key={item.id}
                className={selectedItemId === item.id ? 'selected-row' : ''}
                onDoubleClick={() => onDoubleClickItem(item.id)}
                title="Double-click to move to timeline block"
              >
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
    </>
  )
}

function SreMiniProjectPage() {
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const repoBlobBase = 'https://github.com/devopsjean/mini-project/blob/main/'
  const repoRawBase = 'https://raw.githubusercontent.com/devopsjean/mini-project/main/'

  useEffect(() => {
    const controller = new AbortController()
    const readmeUrl = 'https://raw.githubusercontent.com/devopsjean/mini-project/main/README.md'
    fetch(readmeUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load README (${response.status})`)
        return response.text()
      })
      .then((text) => {
        setMarkdown(text)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return (
    <section className="doc-card markdown-card">
      <h3>SRE-mini-project README Preview</h3>
      {loading && <p>Loading README preview...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              img: ({ src, alt }) => <img src={resolveReadmeUrl(src, repoRawBase, repoBlobBase, true)} alt={alt ?? ''} loading="lazy" />,
              a: ({ href, children }) => (
                <a href={resolveReadmeUrl(href, repoRawBase, repoBlobBase, false)} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      )}
    </section>
  )
}

function resolveReadmeUrl(
  url: string | undefined,
  rawBase: string,
  blobBase: string,
  preferRaw: boolean,
) {
  if (!url) return ''
  if (/^[a-z]+:/i.test(url) || url.startsWith('//') || url.startsWith('#')) return url
  const clean = url.replace(/^\.\//, '').replace(/^\/+/, '')
  return `${preferRaw ? rawBase : blobBase}${clean}`
}

function quarterIndexFromModel(date: Date, minYear: number) {
  return (date.getFullYear() - minYear) * 4 + Math.floor(date.getMonth() / 3)
}

function quarterPositionFromModel(date: Date, minYear: number) {
  const monthsFromMin = (date.getFullYear() - minYear) * 12 + date.getMonth()
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const monthProgress = (date.getDate() - 1) / daysInMonth
  return (monthsFromMin + monthProgress) / 3
}

function normalizeSlug(slug: string) {
  if (slug === 'experience-timeline' || slug === 'experience-chart') return 'profile'
  if (slug === 'sre-mini-project' || slug === 'profile') return slug
  return 'profile'
}

function scrollToTarget(targetId: string) {
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default App
