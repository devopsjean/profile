import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
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
  detailsUrl?: string
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
  const [copiedEmail, setCopiedEmail] = useState(false)
  const githubUrl = profileData.links.find((link) => link.label === 'GitHub')?.url ?? 'https://github.com/devopsjean'
  const linkedinUrl = profileData.links.find((link) => link.label === 'LinkedIn')?.url ?? 'https://www.linkedin.com/in/devopsjeanmc'

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

  const handleCopyEmail = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    try {
      await navigator.clipboard.writeText(profileData.email)
      setCopiedEmail(true)
      window.setTimeout(() => setCopiedEmail(false), 1500)
    } catch {
      setCopiedEmail(false)
    }
  }

  return (
    <section className="profile-dashboard">
      <article className="hero-card">
        <h2>{profileData.role}</h2>
        <p>{profileData.location}</p>
        <div className="contact-links">
          <a href={`mailto:${profileData.email}`} onClick={handleCopyEmail} title="Click to copy email address">
            <GmailIcon /> {profileData.email}
          </a>
          <a href={githubUrl} target="_blank" rel="noreferrer">
            <GitHubIcon /> {githubUrl}
          </a>
          <a href={linkedinUrl} target="_blank" rel="noreferrer">
            <LinkedInIcon /> {linkedinUrl}
          </a>
          {copiedEmail && <span className="copy-state">Copied</span>}
        </div>
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
  const nearestEventRowIndex = useMemo(() => {
    const nowPos = quarterPositionFromModel(new Date(), model.minYear)
    let nearestIndex = -1
    let nearestDistance = Number.POSITIVE_INFINITY

    ordered.forEach((item, index) => {
      const startPos = quarterPositionFromModel(new Date(item.start), model.minYear)
      const endPos = quarterPositionFromModel(addDays(new Date(item.end), 1), model.minYear)
      const distance = nowPos < startPos ? startPos - nowPos : nowPos > endPos ? nowPos - endPos : 0
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    return nearestIndex
  }, [model.minYear, ordered])

  const scrollToQuarter = (quarter: number, width: number, behavior: ScrollBehavior = 'smooth') => {
    if (!scrollRef.current) return 0
    const viewport = scrollRef.current.clientWidth
    const targetLeft = Math.max(quarter * width - viewport / 2, 0)
    scrollRef.current.scrollTo({ left: targetLeft, top: scrollRef.current.scrollTop, behavior })
    return targetLeft
  }

  const focusNearestEventRow = (fixedLeft?: number) => {
    const node = scrollRef.current
    if (!node || nearestEventRowIndex < 0) return
    const stickyHeight = (node.querySelector('.timeline-sticky') as HTMLElement | null)?.offsetHeight ?? 64
    const targetTop = nearestEventRowIndex * 42 + 8
    node.scrollTo({
      top: Math.max(targetTop - stickyHeight - 10, 0),
      left: fixedLeft ?? node.scrollLeft,
      behavior: 'smooth',
    })
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
      const fitLeft = scrollToQuarter((start + end) / 2, width, 'auto')
      requestAnimationFrame(() => focusNearestEventRow(fitLeft))
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
              const startPos = quarterPositionFromModel(new Date(item.start), model.minYear)
              const endPos = quarterPositionFromModel(addDays(new Date(item.end), 1), model.minYear)
              const clampedStart = Math.max(startPos, 0)
              const clampedEnd = Math.min(endPos, model.totalQuarters)
              if (clampedEnd <= 0 || clampedStart >= model.totalQuarters || clampedEnd <= clampedStart) return null

              const rawLeftPx = startPos * quarterWidth + 2
              const rawRightPx = endPos * quarterWidth - 2
              const leftPx = clampedStart * quarterWidth + 2
              const widthPx = Math.max((clampedEnd - clampedStart) * quarterWidth - 4, 12)
              const topPx = idx * 42 + 8
              const hasPastOverflow = rawLeftPx < scrollLeft + 2
              const hasFutureOverflow = rawRightPx > scrollLeft + viewportWidth - 2
              const hasViewportOverlap = rawRightPx > scrollLeft && rawLeftPx < scrollLeft + viewportWidth
              const minLabelX = scrollLeft + (hasPastOverflow ? 34 : 10)
              const maxLabelX = Math.max(minLabelX, scrollLeft + viewportWidth - 180)
              const naturalLabelX = leftPx + 10
              const labelX = Math.min(Math.max(naturalLabelX, minLabelX), maxLabelX)
              const labelLeft = Math.max(10, labelX - leftPx)

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
                    {hasViewportOverlap && (
                      <span className="timeline-pill-label" style={{ left: `${labelLeft}px` }}>
                        {item.group} {item.title}
                      </span>
                    )}
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
              <th>Details</th>
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
                <td>
                  {item.detailsUrl ? (
                    <a
                      className="detail-link-btn"
                      href={item.detailsUrl}
                      target="_blank"
                      rel="noreferrer"
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      View
                    </a>
                  ) : (
                    <span className="detail-empty">-</span>
                  )}
                </td>
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

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" className="social-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0.296C5.373 0.296 0 5.67 0 12.296c0 5.302 3.438 9.8 8.205 11.387.6.111.82-.261.82-.58 0-.287-.01-1.046-.016-2.053-3.338.726-4.042-1.609-4.042-1.609-.546-1.387-1.334-1.756-1.334-1.756-1.089-.744.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.776.418-1.304.762-1.603-2.665-.303-5.467-1.333-5.467-5.931 0-1.31.468-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.323 3.3 1.23a11.5 11.5 0 0 1 3.004-.404c1.02.005 2.047.137 3.005.404 2.29-1.553 3.296-1.23 3.296-1.23.655 1.652.243 2.873.119 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.625-5.48 5.921.43.37.813 1.102.813 2.222 0 1.604-.015 2.899-.015 3.293 0 .322.216.696.825.578C20.565 22.092 24 17.596 24 12.296 24 5.67 18.627 0.296 12 0.296Z" />
    </svg>
  )
}

function GmailIcon() {
  return (
    <svg aria-hidden="true" className="social-icon" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 12.713 3.6 6.527V19.2A1.8 1.8 0 0 0 5.4 21h2.88V12.72L12 15.456l3.72-2.736V21h2.88a1.8 1.8 0 0 0 1.8-1.8V6.527L12 12.713Z" />
      <path fill="#34A853" d="M15.72 12.72V21H8.28v-8.28L12 15.456l3.72-2.736Z" />
      <path fill="#FBBC04" d="M20.4 6.527V7.2l-4.68 3.44V6.072l2.88 2.16 1.8-1.705Z" />
      <path fill="#4285F4" d="M3.6 6.527V7.2l4.68 3.44V6.072L5.4 8.232 3.6 6.527Z" />
      <path fill="#C5221F" d="M3.6 6.527 5.4 4.8 12 9.6l6.6-4.8 1.8 1.727L12 12.713 3.6 6.527Z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" className="social-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452H16.89v-5.569c0-1.328-.028-3.038-1.852-3.038-1.853 0-2.136 1.446-2.136 2.941v5.666H9.345V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.604 0 4.269 2.372 4.269 5.456v6.285ZM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126ZM7.119 20.452H3.555V9H7.12v11.452ZM22.225 0H1.771C.792 0 0 .773 0 1.729V22.27C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .773 23.2 0 22.222 0h.003Z" />
    </svg>
  )
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
