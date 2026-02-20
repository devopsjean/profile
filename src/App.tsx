import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import navData from './content/nav.json'
import profileData from './content/profile.json'
import timelineData from './content/timeline.json'
import roadmapData from './content/roadmap.json'

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
type RoadmapStatus = 'Not Started' | 'Studying' | 'Done'
type RoadmapItem = {
  id: string
  area: string
  topic: string
  status: RoadmapStatus
  progress: number
  priority: 'Low' | 'Medium' | 'High'
  link: string
}

type SkillLeafLayout = {
  id: string
  clusterId: string
  topic: string
  displayTopic: string
  status: RoadmapStatus
  progress: number
  link: string
  x: number
  y: number
  areaX: number
  areaY: number
  side: -1 | 1
  color: string
  statusColor: string
  radius: number
  zone: 'upper' | 'root'
  boxWidth: number
  boxHeight: number
  baseBoxY: number
  boxX: number
  boxY: number
  boxCenterY: number
  boxAnchorX: number
  textX: number
  textAnchor: 'start' | 'end'
  minY: number
  maxY: number
}

type SkillAreaLayout = {
  key: string
  area: string
  x: number
  y: number
  color: string
  side: -1 | 1
  bandTop: number
  bandBottom: number
}

const navTree = navData as NavNode[]
const experiences = timelineData as TimelineItem[]
const roadmapItems = roadmapData as RoadmapItem[]
const sidebarVersion = `${__APP_RELEASE_STAGE__} v${__APP_BUILD_VERSION__}`
const sidebarBuild = `build ${__APP_BUILD_HASH__}`

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
    if (slug === 'roadmap-mindmap') return 'Roadmap/Mindmap Demo'
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
        <div className="rail-main">
          <div className="rail-title">Profile</div>
          <SidebarTree tree={navTree} activeMenuId={activeMenuId} onMenuAction={handleMenuAction} />
        </div>
        <div className="rail-version">
          <p>{sidebarVersion}</p>
          <p>{sidebarBuild}</p>
        </div>
      </aside>

      <main className="doc-view">
        <header className="doc-header">
          <div>
            <h1>{pageTitleFromSlug(normalizedSlug)}</h1>
            <p>{profileData.name}</p>
          </div>
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        {normalizedSlug === 'profile' && <ProfilePage />}
        {normalizedSlug === 'sre-mini-project' && <SreMiniProjectPage />}
        {normalizedSlug === 'roadmap-mindmap' && <RoadmapPage items={roadmapItems} />}
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
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ Profile: true, Projects: true, Roadmap: true })
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

function RoadmapPage({ items }: { items: RoadmapItem[] }) {
  const treeScrollRef = useRef<HTMLDivElement>(null)
  const grouped = useMemo(() => {
    const map = new Map<string, RoadmapItem[]>()
    items.forEach((item) => {
      const bucket = map.get(item.area) ?? []
      bucket.push(item)
      map.set(item.area, bucket)
    })
    return Array.from(map.entries()).map(([area, tasks]) => ({
      area,
      tasks: tasks.slice().sort((a, b) => b.progress - a.progress),
    }))
  }, [items])
  const layout = useMemo(() => buildRoadmapSkillTreeLayout(grouped), [grouped])

  useEffect(() => {
    const node = treeScrollRef.current
    if (!node) return
    requestAnimationFrame(() => {
      node.scrollTop = 0
      node.scrollLeft = 0
    })
  }, [])

  return (
    <section className="skilltree-layout">
      <article className="doc-card skilltree-card">
        <div className="skilltree-head">
          <h3>DevOps & SRE Skill Tree</h3>
          <p>Start at the root zone, scroll up for advanced branches and down for root branches.</p>
        </div>

        <div className="skilltree-scroll" ref={treeScrollRef}>
          <svg
            className="skilltree-svg"
            viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
            role="img"
            aria-label="DevOps and SRE skill tree"
          >
            <defs>
              <linearGradient id="trunkGlow" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#c11a2b" />
                <stop offset="60%" stopColor="#5d2228" />
                <stop offset="100%" stopColor="#1f1f24" />
              </linearGradient>
              <radialGradient id="rootAura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(228, 48, 61, 0.65)" />
                <stop offset="100%" stopColor="rgba(228, 48, 61, 0)" />
              </radialGradient>
            </defs>

            <rect x="0" y="0" width={layout.width} height={layout.height} className="skilltree-bg" />
            <ellipse cx={layout.root.x} cy={layout.root.y} rx="220" ry="110" fill="url(#rootAura)" />

            {layout.areas.map((area) => (
              <path
                key={`trunk-${area.area}`}
                d={`M ${layout.root.x} ${layout.root.y} C ${layout.root.x + area.side * 28} ${layout.root.y - 170}, ${area.x - area.side * 34} ${area.y + 110}, ${area.x} ${area.y}`}
                className="skilltree-branch-main"
                style={{ stroke: area.color }}
              />
            ))}

            {layout.rootAreas.map((area) => (
              <path
                key={`root-lower-${area.area}`}
                d={`M ${layout.root.x} ${layout.root.y} C ${layout.root.x + area.side * 24} ${layout.root.y + 120}, ${area.x - area.side * 30} ${area.y - 82}, ${area.x} ${area.y}`}
                className="skilltree-branch-main root-zone"
                style={{ stroke: area.color }}
              />
            ))}

            {layout.topics.map((topic) => (
              <path
                key={`twig-${topic.id}`}
                d={`M ${topic.areaX} ${topic.areaY} C ${topic.areaX + topic.side * 45} ${topic.areaY - 78}, ${topic.boxAnchorX - topic.side * 54} ${topic.boxCenterY + 48}, ${topic.boxAnchorX} ${topic.boxCenterY}`}
                className="skilltree-branch-sub"
                style={{ stroke: topic.color }}
              />
            ))}

            {layout.rootTopics.map((topic) => (
              <path
                key={`root-twig-${topic.id}`}
                d={`M ${topic.areaX} ${topic.areaY} C ${topic.areaX + topic.side * 42} ${topic.areaY + 62}, ${topic.boxAnchorX - topic.side * 50} ${topic.boxCenterY - 42}, ${topic.boxAnchorX} ${topic.boxCenterY}`}
                className="skilltree-branch-sub root-zone"
                style={{ stroke: topic.color }}
              />
            ))}

            <path d={`M ${layout.root.x} ${layout.root.y + 45} L ${layout.root.x} ${layout.root.y - 220}`} className="skilltree-trunk" />
            <circle cx={layout.root.x} cy={layout.root.y} r="24" className="skilltree-root-core" />
            <text x={layout.root.x} y={layout.root.y + 58} textAnchor="middle" className="skilltree-root-label">
              Root: DevOps & SRE Journey
            </text>

            {layout.areas.map((area) => (
              <g key={area.area} transform={`translate(${area.x}, ${area.y})`}>
                <rect x="-92" y="-16" width="184" height="32" rx="16" className="skilltree-area-node" />
                <text textAnchor="middle" y="5" className="skilltree-area-label">
                  {area.area}
                </text>
              </g>
            ))}

            {layout.rootAreas.map((area) => (
              <g key={`root-node-${area.area}`} transform={`translate(${area.x}, ${area.y})`}>
                <rect x="-92" y="-16" width="184" height="32" rx="16" className="skilltree-area-node root-zone" />
                <text textAnchor="middle" y="5" className="skilltree-area-label">
                  {area.area}
                </text>
              </g>
            ))}

            {layout.topics.map((topic) => (
              <a key={topic.id} href={topic.link} target="_blank" rel="noreferrer">
                <g className="skilltree-topic-group">
                  <circle cx={topic.boxAnchorX} cy={topic.boxCenterY} r={topic.radius} className="skilltree-topic-orb" style={{ stroke: topic.statusColor }} />
                  <circle cx={topic.boxAnchorX} cy={topic.boxCenterY} r={Math.max(topic.radius - 6, 7)} className="skilltree-topic-core" style={{ fill: topic.statusColor }} />
                  <rect x={topic.boxX} y={topic.boxY} width={topic.boxWidth} height={topic.boxHeight} rx="10" className="skilltree-leaf-box" />
                  <text x={topic.textX} y={topic.boxY + 17} textAnchor={topic.textAnchor} className="skilltree-leaf-title">
                    {topic.displayTopic}
                  </text>
                  <text x={topic.textX} y={topic.boxY + 33} textAnchor={topic.textAnchor} className="skilltree-leaf-meta">
                    {topic.status} · {topic.progress}%
                  </text>
                </g>
              </a>
            ))}

            {layout.rootTopics.map((topic) => (
              <a key={`root-${topic.id}`} href={topic.link} target="_blank" rel="noreferrer">
                <g className="skilltree-topic-group">
                  <circle cx={topic.boxAnchorX} cy={topic.boxCenterY} r={topic.radius} className="skilltree-topic-orb" style={{ stroke: topic.statusColor }} />
                  <circle cx={topic.boxAnchorX} cy={topic.boxCenterY} r={Math.max(topic.radius - 6, 7)} className="skilltree-topic-core" style={{ fill: topic.statusColor }} />
                  <rect x={topic.boxX} y={topic.boxY} width={topic.boxWidth} height={topic.boxHeight} rx="10" className="skilltree-leaf-box root-zone" />
                  <text x={topic.textX} y={topic.boxY + 17} textAnchor={topic.textAnchor} className="skilltree-leaf-title">
                    {topic.displayTopic}
                  </text>
                  <text x={topic.textX} y={topic.boxY + 33} textAnchor={topic.textAnchor} className="skilltree-leaf-meta">
                    {topic.status} · {topic.progress}%
                  </text>
                </g>
              </a>
            ))}
          </svg>
        </div>
      </article>
    </section>
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

function pageTitleFromSlug(slug: string) {
  if (slug === 'sre-mini-project') return 'SRE-mini-project'
  if (slug === 'roadmap-mindmap') return 'Skill Tree'
  return 'Profile'
}

function buildRoadmapSkillTreeLayout(groups: Array<{ area: string; tasks: RoadmapItem[] }>) {
  const areaPalette = ['#b14b59', '#8a4e86', '#5f8ab6', '#5f9b7c', '#9f6f47', '#9a5f9f']
  const statusColor: Record<RoadmapStatus, string> = {
    Done: '#7be193',
    Studying: '#f8af4b',
    'Not Started': '#8892a8',
  }

  const rootZoneAreas = new Set(['Mathematics', 'Mathmatics', 'Python'])
  const lowerGroups = groups.filter((group) => rootZoneAreas.has(group.area)).sort((a, b) => a.area.localeCompare(b.area))
  const upperGroups = groups
    .filter((group) => !rootZoneAreas.has(group.area))
    .sort((a, b) => b.tasks.length - a.tasks.length || a.area.localeCompare(b.area))

  const width = 1720
  const height = 1220
  const rootX = width / 2
  const rootY = height / 2 + 10

  const areas: SkillAreaLayout[] = []
  const rootAreas: SkillAreaLayout[] = []
  const topics: SkillLeafLayout[] = []
  const rootTopics: SkillLeafLayout[] = []

  const upperAngles = buildCenteredAngles(-90, 72, upperGroups.length)
  const upperIntervalsBySide = new Map<-1 | 1, Array<{ start: number; end: number }>>()
  upperGroups.forEach((group, idx) => {
    const angle = upperAngles[idx]
    const radius = 264 + Math.floor((idx + 1) / 2) * 34
    const base = polarPoint(rootX, rootY, radius, angle)
    let side: -1 | 1 = base.x <= rootX ? -1 : 1
    if (Math.abs(base.x - rootX) < 24) side = idx % 2 === 0 ? -1 : 1

    const rowStep = 54
    const bandHeight = Math.max(108, group.tasks.length * rowStep + 36)
    let bandBottom = base.y - 18
    let bandTop = bandBottom - bandHeight
    const sideIntervals = upperIntervalsBySide.get(side) ?? []
    const shift = findBandShift(bandTop, bandBottom, sideIntervals, 112)
    bandTop += shift
    bandBottom += shift
    sideIntervals.push({ start: bandTop, end: bandBottom })
    sideIntervals.sort((a, b) => a.start - b.start)
    upperIntervalsBySide.set(side, sideIntervals)

    const color = areaPalette[idx % areaPalette.length]
    const areaY = base.y + shift
    const area = { key: group.area, area: group.area, x: base.x, y: areaY, color, side, bandTop, bandBottom }
    areas.push(area)

    group.tasks.forEach((task, taskIndex) => {
      const lane = taskIndex % 2 === 0 ? -1 : 1
      const depth = Math.floor(taskIndex / 2)
      const pointY = bandTop + 20 + taskIndex * rowStep
      const pointX = base.x + side * (88 + depth * 12) + lane * 6
      const boxWidth = Math.max(238, Math.min(320, 108 + task.topic.length * 3.9))
      const boxHeight = 40
      const boxX = side > 0 ? pointX + 16 : pointX - 16 - boxWidth
      topics.push({
        id: task.id,
        clusterId: area.key,
        topic: task.topic,
        displayTopic: shortenSkillLabel(task.topic, 40),
        status: task.status,
        progress: task.progress,
        link: task.link,
        x: pointX,
        y: pointY,
        areaX: base.x,
        areaY,
        side,
        color,
        statusColor: statusColor[task.status],
        radius: 10 + Math.round(task.progress / 26),
        zone: 'upper',
        boxWidth,
        boxHeight,
        baseBoxY: pointY - boxHeight / 2,
        boxX,
        boxY: pointY - boxHeight / 2,
        boxCenterY: pointY,
        boxAnchorX: side > 0 ? boxX : boxX + boxWidth,
        textX: side > 0 ? boxX + 10 : boxX + boxWidth - 10,
        textAnchor: side > 0 ? 'start' : 'end',
        minY: bandTop + 4,
        maxY: bandBottom - boxHeight - 4,
      })
    })
  })

  const lowerAngles = buildCenteredAngles(90, 64, lowerGroups.length)
  const lowerIntervalsBySide = new Map<-1 | 1, Array<{ start: number; end: number }>>()
  lowerGroups.forEach((group, idx) => {
    const sideHint: -1 | 1 = group.area.toLowerCase().includes('python') ? 1 : -1
    const angle = lowerGroups.length === 2 ? (sideHint > 0 ? 70 : 110) : lowerAngles[idx]
    const radius = 214 + Math.floor((idx + 1) / 2) * 34
    const base = polarPoint(rootX, rootY, radius, angle)
    const side: -1 | 1 = base.x <= rootX ? -1 : 1

    const rowStep = 54
    const bandHeight = Math.max(108, group.tasks.length * rowStep + 36)
    let bandTop = base.y + 18
    let bandBottom = bandTop + bandHeight
    const sideIntervals = lowerIntervalsBySide.get(side) ?? []
    const shift = findBandShift(bandTop, bandBottom, sideIntervals, 108)
    bandTop += shift
    bandBottom += shift
    sideIntervals.push({ start: bandTop, end: bandBottom })
    sideIntervals.sort((a, b) => a.start - b.start)
    lowerIntervalsBySide.set(side, sideIntervals)

    const color = areaPalette[(idx + upperGroups.length) % areaPalette.length]
    const areaY = base.y + shift
    const area = { key: `root:${group.area}`, area: group.area, x: base.x, y: areaY, color, side, bandTop, bandBottom }
    rootAreas.push(area)

    group.tasks.forEach((task, taskIndex) => {
      const lane = taskIndex % 2 === 0 ? -1 : 1
      const depth = Math.floor(taskIndex / 2)
      const pointY = bandTop + 20 + taskIndex * rowStep
      const pointX = base.x + side * (84 + depth * 12) + lane * 6
      const boxWidth = Math.max(238, Math.min(320, 108 + task.topic.length * 3.9))
      const boxHeight = 40
      const boxX = side > 0 ? pointX + 16 : pointX - 16 - boxWidth
      rootTopics.push({
        id: task.id,
        clusterId: area.key,
        topic: task.topic,
        displayTopic: shortenSkillLabel(task.topic, 40),
        status: task.status,
        progress: task.progress,
        link: task.link,
        x: pointX,
        y: pointY,
        areaX: base.x,
        areaY,
        side,
        color,
        statusColor: statusColor[task.status],
        radius: 10 + Math.round(task.progress / 26),
        zone: 'root',
        boxWidth,
        boxHeight,
        baseBoxY: pointY - boxHeight / 2,
        boxX,
        boxY: pointY - boxHeight / 2,
        boxCenterY: pointY,
        boxAnchorX: side > 0 ? boxX : boxX + boxWidth,
        textX: side > 0 ? boxX + 10 : boxX + boxWidth - 10,
        textAnchor: side > 0 ? 'start' : 'end',
        minY: bandTop + 4,
        maxY: bandBottom - boxHeight - 4,
      })
    })
  })

  resolveLeafOverlap(topics, buildAreaLaneBlockers(areas), 240)
  resolveLeafOverlap(rootTopics, buildAreaLaneBlockers(rootAreas), 240)
  compactClustersTowardCore(areas, topics, { x: rootX, y: rootY }, {
    width,
    height,
    zone: 'upper',
    minRadius: 124,
    zoneGap: 106,
    rootKeepout: 98,
    clusterGap: 8,
    boundaryPadding: 12,
  })
  compactClustersTowardCore(rootAreas, rootTopics, { x: rootX, y: rootY }, {
    width,
    height,
    zone: 'root',
    minRadius: 92,
    zoneGap: 84,
    rootKeepout: 98,
    clusterGap: 8,
    boundaryPadding: 12,
  })
  separateAreaNodes(areas, topics, { x: rootX, y: rootY }, { zone: 'upper', zoneGap: 106, height, boundaryPadding: 12 })
  separateAreaNodes(rootAreas, rootTopics, { x: rootX, y: rootY }, { zone: 'root', zoneGap: 84, height, boundaryPadding: 12 })
  resolveLeafOverlap(topics, buildAreaLaneBlockers(areas), 240)
  resolveLeafOverlap(rootTopics, buildAreaLaneBlockers(rootAreas), 240)
  const viewBox = computeSkillTreeViewBox({ width, height, root: { x: rootX, y: rootY }, areas, rootAreas, topics, rootTopics })

  return { width, height, root: { x: rootX, y: rootY }, areas, topics, rootAreas, rootTopics, viewBox }
}

function compactClustersTowardCore(
  areas: SkillAreaLayout[],
  leaves: SkillLeafLayout[],
  root: { x: number; y: number },
  options: {
    width: number
    height: number
    zone: 'upper' | 'root'
    minRadius: number
    zoneGap: number
    rootKeepout: number
    clusterGap: number
    boundaryPadding: number
  },
) {
  if (!areas.length) return

  const clusters = areas.map((area) => {
    const laneLeaves = leaves.filter((leaf) => leaf.clusterId === area.key)
    return {
      area,
      leaves: laneLeaves,
      bounds: getClusterBounds(area, laneLeaves),
    }
  })

  const step = 30
  const maxIterations = 320
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let moved = false
    const ordered = clusters
      .slice()
      .sort((a, b) => distanceToPoint(b.area.x, b.area.y, root.x, root.y) - distanceToPoint(a.area.x, a.area.y, root.x, root.y))

    for (const cluster of ordered) {
      const vectorX = root.x - cluster.area.x
      const vectorY = root.y - cluster.area.y
      const distance = Math.hypot(vectorX, vectorY)
      if (distance <= options.minRadius + 1) continue

      const moveLength = Math.min(step, distance - options.minRadius)
      const dx = (vectorX / distance) * moveLength
      const dy = (vectorY / distance) * moveLength
      const nextAreaY = cluster.area.y + dy

      if (options.zone === 'upper' && nextAreaY > root.y - options.zoneGap) continue
      if (options.zone === 'root' && nextAreaY < root.y + options.zoneGap) continue

      const nextBounds = shiftBounds(cluster.bounds, dx, dy)
      if (
        nextBounds.minX < options.boundaryPadding ||
        nextBounds.maxX > options.width - options.boundaryPadding ||
        nextBounds.minY < options.boundaryPadding ||
        nextBounds.maxY > options.height - options.boundaryPadding
      ) {
        continue
      }

      if (isCircleIntersectingAabb(root.x, root.y, options.rootKeepout, nextBounds)) continue

      let collides = false
      for (const other of clusters) {
        if (other === cluster) continue
        if (boxesOverlap(nextBounds, other.bounds, options.clusterGap)) {
          collides = true
          break
        }
      }
      if (collides) continue

      cluster.area.x += dx
      cluster.area.y += dy
      cluster.area.bandTop += dy
      cluster.area.bandBottom += dy
      cluster.leaves.forEach((leaf) => {
        leaf.x += dx
        leaf.y += dy
        leaf.areaX += dx
        leaf.areaY += dy
        leaf.baseBoxY += dy
        leaf.boxX += dx
        leaf.boxY += dy
        leaf.boxCenterY += dy
        leaf.boxAnchorX += dx
        leaf.textX += dx
        leaf.minY += dy
        leaf.maxY += dy
      })
      cluster.bounds = nextBounds
      moved = true
    }

    if (!moved) break
  }
}

function separateAreaNodes(
  areas: SkillAreaLayout[],
  leaves: SkillLeafLayout[],
  root: { x: number; y: number },
  options: {
    zone: 'upper' | 'root'
    zoneGap: number
    height: number
    boundaryPadding: number
  },
) {
  if (areas.length < 2) return

  const leavesByCluster = new Map<string, SkillLeafLayout[]>()
  leaves.forEach((leaf) => {
    const lane = leavesByCluster.get(leaf.clusterId) ?? []
    lane.push(leaf)
    leavesByCluster.set(leaf.clusterId, lane)
  })

  const minXGap = 202
  const minYGap = 52
  const maxIterations = 64
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let moved = false

    for (let i = 0; i < areas.length; i += 1) {
      for (let j = i + 1; j < areas.length; j += 1) {
        const a = areas[i]
        const b = areas[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const overlapX = minXGap - Math.abs(dx)
        const overlapY = minYGap - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue

        const direction = dy === 0 ? (options.zone === 'upper' ? -1 : 1) : Math.sign(dy)
        const delta = overlapY / 2 + 1
        moved = shiftAreaClusterY(a, leavesByCluster.get(a.key) ?? [], -direction * delta, root, options) || moved
        moved = shiftAreaClusterY(b, leavesByCluster.get(b.key) ?? [], direction * delta, root, options) || moved
      }
    }

    if (!moved) break
  }
}

function shiftAreaClusterY(
  area: SkillAreaLayout,
  leaves: SkillLeafLayout[],
  deltaY: number,
  root: { x: number; y: number },
  options: {
    zone: 'upper' | 'root'
    zoneGap: number
    height: number
    boundaryPadding: number
  },
) {
  const minY = options.zone === 'upper' ? options.boundaryPadding + 18 : root.y + options.zoneGap + 12
  const maxY = options.zone === 'upper' ? root.y - options.zoneGap - 12 : options.height - options.boundaryPadding - 18
  const targetY = clamp(area.y + deltaY, minY, maxY)
  const applied = targetY - area.y
  if (Math.abs(applied) < 0.1) return false

  area.y = targetY
  area.bandTop += applied
  area.bandBottom += applied
  leaves.forEach((leaf) => {
    leaf.y += applied
    leaf.areaY += applied
    leaf.baseBoxY += applied
    leaf.boxY += applied
    leaf.boxCenterY += applied
    leaf.minY += applied
    leaf.maxY += applied
  })
  return true
}

function computeSkillTreeViewBox({
  width,
  height,
  root,
  areas,
  rootAreas,
  topics,
  rootTopics,
}: {
  width: number
  height: number
  root: { x: number; y: number }
  areas: SkillAreaLayout[]
  rootAreas: SkillAreaLayout[]
  topics: SkillLeafLayout[]
  rootTopics: SkillLeafLayout[]
}) {
  let minX = root.x - 260
  let maxX = root.x + 260
  let minY = root.y - 280
  let maxY = root.y + 120

  const include = (x: number, y: number, padding = 0) => {
    minX = Math.min(minX, x - padding)
    maxX = Math.max(maxX, x + padding)
    minY = Math.min(minY, y - padding)
    maxY = Math.max(maxY, y + padding)
  }

  ;[...areas, ...rootAreas].forEach((area) => {
    include(area.x, area.y, 108)
    include(root.x + area.side * 28, root.y + (area.y < root.y ? -170 : 120), 24)
    include(area.x - area.side * 34, area.y + (area.y < root.y ? 110 : -82), 24)
  })

  ;[...topics, ...rootTopics].forEach((topic) => {
    include(topic.areaX, topic.areaY, 24)
    include(topic.boxAnchorX, topic.boxCenterY, topic.radius + 4)
    include(topic.boxX + topic.boxWidth / 2, topic.boxY + topic.boxHeight / 2, Math.max(topic.boxWidth, topic.boxHeight) / 2 + 6)
    include(topic.textX, topic.boxY + 18, 14)
    include(topic.textX, topic.boxY + 34, 14)
    include(topic.boxAnchorX - topic.side * 54, topic.boxCenterY + (topic.zone === 'upper' ? 48 : -42), 18)
  })

  include(root.x, root.y, 28)
  include(root.x, root.y + 62, 20)

  const padding = 30
  const x = clamp(Math.floor(minX - padding), 0, width - 1)
  const y = clamp(Math.floor(minY - padding), 0, height - 1)
  const viewWidth = clamp(Math.ceil(maxX - minX + padding * 2), 960, width)
  const viewHeight = clamp(Math.ceil(maxY - minY + padding * 2), 640, height)
  return {
    x: clamp(x, 0, Math.max(0, width - viewWidth)),
    y: clamp(y, 0, Math.max(0, height - viewHeight)),
    width: viewWidth,
    height: viewHeight,
  }
}

function getClusterBounds(area: SkillAreaLayout, leaves: SkillLeafLayout[]) {
  let minX = area.x - 92
  let maxX = area.x + 92
  let minY = area.y - 16
  let maxY = area.y + 16

  leaves.forEach((leaf) => {
    minX = Math.min(minX, leaf.boxX, leaf.boxAnchorX - leaf.radius - 2)
    maxX = Math.max(maxX, leaf.boxX + leaf.boxWidth, leaf.boxAnchorX + leaf.radius + 2)
    minY = Math.min(minY, leaf.boxY, leaf.boxCenterY - leaf.radius - 2)
    maxY = Math.max(maxY, leaf.boxY + leaf.boxHeight, leaf.boxCenterY + leaf.radius + 2)
  })

  return { minX, maxX, minY, maxY }
}

function shiftBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }, dx: number, dy: number) {
  return {
    minX: bounds.minX + dx,
    maxX: bounds.maxX + dx,
    minY: bounds.minY + dy,
    maxY: bounds.maxY + dy,
  }
}

function boxesOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number },
  gap: number,
) {
  return !(a.maxX + gap < b.minX || a.minX > b.maxX + gap || a.maxY + gap < b.minY || a.minY > b.maxY + gap)
}

function isCircleIntersectingAabb(
  cx: number,
  cy: number,
  radius: number,
  box: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const nearestX = clamp(cx, box.minX, box.maxX)
  const nearestY = clamp(cy, box.minY, box.maxY)
  const dx = cx - nearestX
  const dy = cy - nearestY
  return dx * dx + dy * dy <= radius * radius
}

function distanceToPoint(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1)
}

function resolveLeafOverlap(
  nodes: SkillLeafLayout[],
  blockers: Map<string, Array<{ start: number; end: number }>>,
  maxShift: number,
) {
  const laneGap = 12
  const occupied: Array<{ top: number; bottom: number; left: number; right: number }> = []
  const ordered = nodes.slice().sort((a, b) => a.baseBoxY - b.baseBoxY || a.boxX - b.boxX)

  ordered.forEach((node) => {
    const laneBlockers = blockers.get(node.clusterId) ?? []
    const candidateY = findNearestAvailableYForNode(node, occupied, laneBlockers, laneGap, maxShift, node.minY, node.maxY)
    node.boxY = candidateY
    node.boxCenterY = candidateY + node.boxHeight / 2
    node.boxAnchorX = node.side > 0 ? node.boxX : node.boxX + node.boxWidth
    node.textX = node.side > 0 ? node.boxX + 10 : node.boxX + node.boxWidth - 10
    occupied.push({
      top: node.boxY,
      bottom: node.boxY + node.boxHeight,
      left: node.boxX,
      right: node.boxX + node.boxWidth,
    })
  })
}

function findNearestAvailableYForNode(
  node: SkillLeafLayout,
  occupied: Array<{ top: number; bottom: number; left: number; right: number }>,
  laneBlockers: Array<{ start: number; end: number }>,
  gap: number,
  maxShift: number,
  minY: number,
  maxY: number,
) {
  const step = 6
  for (let distance = 0; distance <= maxShift; distance += step) {
    const offsets = distance === 0 ? [0] : [distance, -distance]
    for (const offset of offsets) {
      const candidate = clamp(node.baseBoxY + offset, minY, maxY)
      if (isYFreeForNode(candidate, node, occupied, laneBlockers, gap)) return candidate
    }
  }

  for (let candidate = minY; candidate <= maxY; candidate += step) {
    if (isYFreeForNode(candidate, node, occupied, laneBlockers, gap)) return candidate
  }
  return clamp(node.baseBoxY, minY, maxY)
}

function findBandShift(
  bandTop: number,
  bandBottom: number,
  occupied: Array<{ start: number; end: number }>,
  maxShift: number,
) {
  const step = 8
  for (let distance = 0; distance <= maxShift; distance += step) {
    const offsets = distance === 0 ? [0] : [distance, -distance]
    for (const offset of offsets) {
      const shiftedTop = bandTop + offset
      const shiftedBottom = bandBottom + offset
      const overlaps = occupied.some((interval) => shiftedBottom > interval.start && shiftedTop < interval.end)
      if (!overlaps) return offset
    }
  }
  return 0
}

function isYFreeForNode(
  y: number,
  node: SkillLeafLayout,
  occupied: Array<{ top: number; bottom: number; left: number; right: number }>,
  blockers: Array<{ start: number; end: number }>,
  gap: number,
) {
  const bottom = y + node.boxHeight
  const left = node.boxX
  const right = node.boxX + node.boxWidth
  const blockedByArea = blockers.some((interval) => bottom + gap > interval.start && y < interval.end + gap)
  if (blockedByArea) return false

  return !occupied.some(
    (interval) =>
      bottom + gap > interval.top &&
      y < interval.bottom + gap &&
      right + gap > interval.left &&
      left < interval.right + gap,
  )
}

function buildAreaLaneBlockers(
  areas: Array<{ key: string; y: number }>,
) {
  const blockers = new Map<string, Array<{ start: number; end: number }>>()
  areas.forEach((area) => {
    const key = area.key
    const lane = blockers.get(key) ?? []
    lane.push({ start: area.y - 30, end: area.y + 30 })
    blockers.set(key, lane)
  })
  return blockers
}

function buildCenteredAngles(centerDeg: number, spreadDeg: number, count: number) {
  if (count <= 1) return [centerDeg]
  const start = centerDeg - spreadDeg / 2
  const step = spreadDeg / (count - 1)
  return Array.from({ length: count }, (_, i) => start + i * step)
}

function polarPoint(cx: number, cy: number, radius: number, degree: number) {
  const rad = (degree * Math.PI) / 180
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function shortenSkillLabel(text: string, max = 46) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
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
  if (slug === 'sre-mini-project' || slug === 'roadmap-mindmap' || slug === 'profile') return slug
  return 'profile'
}

function scrollToTarget(targetId: string) {
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default App
