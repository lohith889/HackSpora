import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Network,
  Share2,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Phone,
  MapPin,
  FileText,
  Eye,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react'
import { adminAPI } from '../api/client'

/**
 * SyndicateGraphPanel
 *
 * Interactive Fraud Ring Radar & Forensic Graph Investigation Panel.
 * Implements:
 *   1. Plain-English headline conclusion
 *   2. Three shapes only: Circles (Apps), Squares (Shared details), Lines (Uses detail)
 *   3. "Follow the links" reveal with step-by-step playback & score elevation
 *   4. "What rules see" vs "What the graph sees" contrast toggle
 *   5. "Look-alike control" (3-member legitimate family sharing parcel/mobile)
 *   6. Floating hover micro-cards right at the hovered node
 *   7. "Where and When" contextual telemetry strips
 */
export default function SyndicateGraphPanel({ applicationId = 1, onOpenApplication }) {
  const [mode, setMode] = useState('live') // 'live' | 'demo_ring' | 'demo_family'
  const [viewPerspective, setViewPerspective] = useState('graph') // 'rules' | 'graph'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoverCoords, setHoverCoords] = useState({ x: 0, y: 0 })
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const containerRef = useRef(null)

  // Reset to live mode whenever viewing a different application
  useEffect(() => {
    setMode('live')
  }, [applicationId])

  // Fetch data on mode / applicationId change
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    adminAPI
      .getSentinelNetwork({
        mode,
        application_id: applicationId,
      })
      .then((res) => {
        if (!cancelled && res.data) {
          setData(res.data)
          // Default step to max step for full ring, or step 1
          const maxStep = res.data.steps ? res.data.steps.length : 1
          setCurrentStep(maxStep)
          setSelectedNodeId(null)
        }
      })
      .catch((err) => {
        console.error('Failed to load sentinel network:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mode, applicationId])

  // Auto-play interval for "Follow the Links"
  useEffect(() => {
    if (!isPlaying || !data?.steps) return

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= data.steps.length) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 2800)

    return () => clearInterval(timer)
  }, [isPlaying, data])

  // Active step info
  const activeStepData = useMemo(() => {
    if (!data?.steps || data.steps.length === 0) return null
    return data.steps[Math.min(currentStep - 1, data.steps.length - 1)]
  }, [data, currentStep])

  // Node and link positions in SVG coordinate space (800 x 420)
  const layout = useMemo(() => {
    if (!data?.nodes) return { nodes: [], links: [] }

    const width = 760
    const height = 360

    if (data.mode === 'demo_family') {
      // 3 applications on top row, 2 shared resources on bottom row
      const posMap = {
        app_f1: { x: 180, y: 100 },
        app_f2: { x: 380, y: 100 },
        app_f3: { x: 580, y: 100 },
        res_f_parcel: { x: 280, y: 260 },
        res_f_mob: { x: 480, y: 260 },
      }
      return {
        nodes: data.nodes.map((n) => ({
          ...n,
          ...(posMap[n.id] || { x: width / 2, y: height / 2 }),
        })),
        links: data.links,
      }
    }

    // Default 5-App Ring Layout
    const posMap = {
      app_1: { x: 150, y: 160 },
      res_bank_1: { x: 290, y: 100 },
      app_2: { x: 440, y: 90 },
      res_doc_1: { x: 600, y: 100 },
      app_4: { x: 630, y: 240 },
      res_parcel_1: { x: 440, y: 260 },
      app_3: { x: 300, y: 280 },
      res_mob_1: { x: 160, y: 300 },
      app_5: { x: 90, y: 230 },
    }

    // Dynamic Live Layout: Center the focus target application
    if (data.mode === 'live') {
      const centerX = width / 2
      const centerY = height / 2

      const targetNode = data.nodes.find((n) => n.is_target) || data.nodes.find((n) => n.type === 'application')
      const otherApps = data.nodes.filter((n) => n.type === 'application' && n.id !== targetNode?.id)
      const resources = data.nodes.filter((n) => n.type !== 'application')

      const computedNodes = []
      if (targetNode) {
        computedNodes.push({
          ...targetNode,
          x: centerX,
          y: centerY,
        })
      }

      // Distribute resources in inner ring around target
      const resCount = resources.length
      resources.forEach((r, idx) => {
        const angle = (idx / Math.max(resCount, 1)) * 2 * Math.PI - Math.PI / 2
        const rx = resCount <= 3 ? 120 : 135
        const ry = resCount <= 3 ? 85 : 95
        computedNodes.push({
          ...r,
          x: Math.round(centerX + rx * Math.cos(angle)),
          y: Math.round(centerY + ry * Math.sin(angle)),
        })
      })

      // Distribute other co-claimants on outer ring
      const otherCount = otherApps.length
      otherApps.forEach((app, idx) => {
        const angle = (idx / Math.max(otherCount, 1)) * 2 * Math.PI + Math.PI / 4
        computedNodes.push({
          ...app,
          x: Math.round(centerX + 250 * Math.cos(angle)),
          y: Math.round(centerY + 135 * Math.sin(angle)),
        })
      })

      return {
        nodes: computedNodes,
        links: data.links,
      }
    }

    // Fallback circular layout
    const nodeCount = data.nodes.length
    const computedNodes = data.nodes.map((n, idx) => {
      if (posMap[n.id]) {
        return { ...n, ...posMap[n.id] }
      }
      const angle = (idx / Math.max(nodeCount, 1)) * 2 * Math.PI - Math.PI / 2
      const radius = n.type === 'application' ? 140 : 80
      return {
        ...n,
        x: Math.round(width / 2 + radius * Math.cos(angle)),
        y: Math.round(height / 2 + radius * Math.sin(angle)),
      }
    })

    return {
      nodes: computedNodes,
      links: data.links,
    }
  }, [data])

  // Determine visibility based on current step
  const visibleNodeIds = useMemo(() => {
    if (!activeStepData?.active_node_ids) {
      return new Set(layout.nodes.map((n) => n.id))
    }
    return new Set(activeStepData.active_node_ids)
  }, [activeStepData, layout.nodes])

  const visibleLinkIds = useMemo(() => {
    if (!activeStepData?.active_link_ids) {
      return new Set(layout.links.map((l) => l.id))
    }
    return new Set(activeStepData.active_link_ids)
  }, [activeStepData, layout.links])

  // Get 1-hop connected neighbors for selected node
  const connectedNeighbors = useMemo(() => {
    if (!selectedNodeId) return null
    const neighbors = new Set([selectedNodeId])
    layout.links.forEach((l) => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source
      const tId = typeof l.target === 'object' ? l.target.id : l.target
      if (sId === selectedNodeId) neighbors.add(tId)
      if (tId === selectedNodeId) neighbors.add(sId)
    })
    return neighbors
  }, [selectedNodeId, layout.links])

  // Helper colors for risk tiers
  const getTierColor = (tier, isSelected) => {
    switch (tier?.toLowerCase()) {
      case 'critical':
        return { fill: '#b91c1c', stroke: '#7f1d1d', text: '#ffffff', ring: 'ring-red-700' }
      case 'high':
        return { fill: '#c2410c', stroke: '#7c2d12', text: '#ffffff', ring: 'ring-orange-700' }
      case 'moderate':
        return { fill: '#b45309', stroke: '#78350f', text: '#ffffff', ring: 'ring-amber-700' }
      default:
        return { fill: '#166534', stroke: '#14532d', text: '#ffffff', ring: 'ring-green-800' }
    }
  }

  // Handle node hover
  const handleNodeMouseEnter = (node, evt) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setHoverCoords({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    })
    setHoveredNode(node)
  }

  const handleNodeMouseLeave = () => {
    setHoveredNode(null)
  }

  if (loading) {
    return (
      <div className="bg-white p-8 flex items-center justify-center space-x-3">
        <div className="w-5 h-5 border-2 border-gov-blue border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-gov-navy">Constructing Forensic Graph Network...</span>
      </div>
    )
  }

  if (!data) return null

  return (
    <div
      ref={containerRef}
      className="relative bg-white"
    >
      {/* ── 1. Top Header & Plain-English Headline ───────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-100 border border-slate-300 text-slate-700 mt-0.5 flex-shrink-0">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  ENG-08 // FORENSIC GRAPH INTELLIGENCE
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 border border-slate-400 bg-slate-800 text-white font-bold uppercase">
                  Fraud Ring Radar
                </span>
                {mode === 'demo_family' && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 border border-emerald-500 bg-emerald-50 text-emerald-800 font-bold uppercase">
                    Benign Control
                  </span>
                )}
              </div>
              <p className="text-sm font-serif font-bold text-slate-900 mt-1">
                {data.headline}
              </p>
            </div>
          </div>

          {/* Mode Switchers */}
          <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => { setMode('live'); setViewPerspective('graph') }}
              className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                mode === 'live'
                  ? 'bg-blue-900 text-white border-blue-900 font-bold'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-blue-600 hover:text-blue-800'
              }`}
              title="Live database graph centered on this specific applicant"
            >
              Live Dossier Graph
            </button>
            <button
              onClick={() => { setMode('demo_ring'); setViewPerspective('graph') }}
              className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                mode === 'demo_ring'
                  ? 'bg-slate-900 text-white border-slate-900 font-bold'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-600 hover:text-slate-900'
              }`}
              title="Exemplary 5-application syndicate ring simulation"
            >
              Ring Demo
            </button>
            <button
              onClick={() => { setMode('demo_family'); setViewPerspective('graph') }}
              className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                mode === 'demo_family'
                  ? 'bg-emerald-800 text-white border-emerald-800 font-bold'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-600 hover:text-emerald-800'
              }`}
              title="Legitimate family sharing — demonstrates false-positive prevention"
            >
              Family Control
            </button>
          </div>
        </div>

        {/* ── Sub-bar: Contrast Toggle & Walkthrough Controls ───────────────── */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* What Rules See vs What Graph Sees */}
          <div className="inline-flex border border-slate-300 bg-slate-100">
            <button
              onClick={() => setViewPerspective('rules')}
              className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 transition-colors ${
                viewPerspective === 'rules'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              📋 What Rules See
            </button>
            <button
              onClick={() => setViewPerspective('graph')}
              className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 transition-colors border-l border-slate-300 ${
                viewPerspective === 'graph'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              🕸️ What The Graph Sees
            </button>
          </div>

          {/* "Follow the Links" Walkthrough Controls */}
          {viewPerspective === 'graph' && data.steps && data.steps.length > 1 && (
            <div className="flex items-center gap-1.5 border border-slate-300 bg-slate-50 px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-600 font-semibold mr-1">Follow the Links:</span>
              <button
                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                disabled={currentStep <= 1}
                className="p-0.5 hover:bg-slate-200 disabled:opacity-30 rounded transition-colors"
                title="Step Back"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>

              <span className="font-mono text-xs font-bold text-slate-900 px-1">
                {currentStep} / {data.steps.length}
              </span>

              <button
                onClick={() => setCurrentStep((p) => Math.min(data.steps.length, p + 1))}
                disabled={currentStep >= data.steps.length}
                className="p-0.5 hover:bg-slate-200 disabled:opacity-30 rounded transition-colors"
                title="Next Link"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-0.5 hover:bg-slate-200 rounded ml-1 text-slate-700 transition-colors"
                title={isPlaying ? 'Pause' : 'Auto-Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => { setCurrentStep(1); setIsPlaying(false) }}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700 transition-colors"
                title="Reset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Perspective Mode: "What Rules See" ─────────────────────────── */}
      {viewPerspective === 'rules' ? (
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  The Single-Row Rule Blindspot
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Traditional relational rules evaluate each row in isolation. Because each applicant provides valid-looking documents, real names, and distinct Aadhaar tokens, <strong>none of the individual applications trigger statutory thresholds</strong>. Fraudsters deliberately exploit this blindspot by spreading syndicate claims across distinct straw-men.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {layout.nodes
              .filter((n) => n.type === 'application')
              .map((app) => (
                <div
                  key={app.id}
                  className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                      {app.label.split(':')[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{app.farmer_name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{app.aadhaar_masked}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Risk {app.initial_score} (Low)
                    </span>
                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Rules: PASS ✓</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        /* ── 3. Perspective Mode: "What The Graph Sees" (Interactive SVG) ── */
        <div className="p-4 bg-slate-50 border-t border-slate-200 relative">
          {/* Step Caption Banner */}
          {activeStepData && (
            <div className="mb-3 px-4 py-2.5 border border-slate-300 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
                <span className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                  {activeStepData.title}
                </span>
                <span className="text-xs text-slate-500 hidden md:inline">
                  — {activeStepData.caption}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {activeStepData.ring_flag && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 border border-red-400 bg-red-50 text-red-800 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Ring Flagged
                  </span>
                )}
                <div className="text-right font-mono text-xs">
                  <span className="text-slate-500">Score: </span>
                  <span
                    className={`font-bold ${
                      activeStepData.focus_app_score >= 70
                        ? 'text-red-700'
                        : activeStepData.focus_app_score >= 40
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {activeStepData.focus_app_score}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SVG Canvas Container */}
          <div className="relative border border-slate-300 bg-white overflow-hidden">
            <svg
              viewBox="0 0 760 360"
              className="w-full h-auto select-none"
              style={{ minHeight: '340px' }}
            >
              <defs>
                {/* Glow filter for highlighted edges */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Grid Pattern */}
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" opacity="1" />

              {/* ── Render Links / Edges ── */}
              {layout.links.map((link) => {
                const sNode = layout.nodes.find(
                  (n) => n.id === (typeof link.source === 'object' ? link.source.id : link.source)
                )
                const tNode = layout.nodes.find(
                  (n) => n.id === (typeof link.target === 'object' ? link.target.id : link.target)
                )
                if (!sNode || !tNode) return null

                const isVisible = visibleLinkIds.has(link.id)
                if (!isVisible) return null

                const isHighlighted =
                  connectedNeighbors &&
                  connectedNeighbors.has(sNode.id) &&
                  connectedNeighbors.has(tNode.id)

                const strokeColor =
                  link.resource_type === 'bank'
                    ? '#1d4ed8'
                    : link.resource_type === 'parcel'
                    ? '#15803d'
                    : link.resource_type === 'document'
                    ? '#b45309'
                    : '#7c3aed'

                return (
                  <g key={link.id}>
                    <line
                      x1={sNode.x}
                      y1={sNode.y}
                      x2={tNode.x}
                      y2={tNode.y}
                      stroke={strokeColor}
                      strokeWidth={isHighlighted ? 3.5 : 2}
                      strokeDasharray={isHighlighted ? 'none' : '4,3'}
                      strokeOpacity={
                        selectedNodeId && !isHighlighted ? 0.2 : isHighlighted ? 1 : 0.75
                      }
                      filter={isHighlighted ? 'url(#glow)' : undefined}
                      className="transition-all duration-300"
                    />
                  </g>
                )
              })}

              {/* ── Render Resource Nodes (Squares) ── */}
              {layout.nodes
                .filter((n) => n.type !== 'application')
                .map((node) => {
                  const isVisible = visibleNodeIds.has(node.id)
                  if (!isVisible) return null

                  const isSelected = selectedNodeId === node.id
                  const isNeighbor = connectedNeighbors && connectedNeighbors.has(node.id)
                  const isDimmed = selectedNodeId && !isSelected && !isNeighbor

                  const size = 32
                  const half = size / 2

                  let badgeColor = '#1d4ed8'   // bank: deep blue
                  if (node.type === 'parcel')   badgeColor = '#15803d'  // parcel: deep green
                  if (node.type === 'document') badgeColor = '#b45309'  // document: amber
                  if (node.type === 'mobile')   badgeColor = '#7c3aed'  // mobile: violet

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedNodeId(selectedNodeId === node.id ? null : node.id)
                      }
                      onMouseEnter={(e) => handleNodeMouseEnter(node, e)}
                      onMouseLeave={handleNodeMouseLeave}
                      opacity={isDimmed ? 0.25 : 1}
                    >
                      {/* Square background */}
                      <rect
                        x={-half}
                        y={-half}
                        width={size}
                        height={size}
                        rx="4"
                        fill="#ffffff"
                        stroke={badgeColor}
                        strokeWidth={isSelected ? 3 : 1.5}
                        style={{ transition: 'stroke-width 0.2s' }}
                      />
                      {/* Badge Letter inside square */}
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill={badgeColor}
                        fontSize="12"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        [{node.badge}]
                      </text>
                      {/* Sub-label text below node */}
                      <text
                        x="0"
                        y={half + 13}
                        textAnchor="middle"
                        fill="#374151"
                        fontSize="10"
                        fontWeight="500"
                      >
                        {node.label}
                      </text>
                    </g>
                  )
                })}

              {/* ── Render Application Nodes (Circles) ── */}
              {layout.nodes
                .filter((n) => n.type === 'application')
                .map((node) => {
                  const isVisible = visibleNodeIds.has(node.id)
                  if (!isVisible) return null

                  const isSelected = selectedNodeId === node.id
                  const isNeighbor = connectedNeighbors && connectedNeighbors.has(node.id)
                  const isDimmed = selectedNodeId && !isSelected && !isNeighbor
                  const isTarget = node.is_target

                  const currentScore =
                    activeStepData && activeStepData.active_node_ids.includes(node.id)
                      ? node.elevated_score
                      : node.initial_score
                  const currentTier =
                    currentScore >= 75
                      ? 'Critical'
                      : currentScore >= 50
                      ? 'High'
                      : currentScore >= 25
                      ? 'Moderate'
                      : 'Low'

                  const colors = getTierColor(currentTier, isSelected)
                  const radius = isTarget ? 24 : 20

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedNodeId(selectedNodeId === node.id ? null : node.id)
                      }
                      onMouseEnter={(e) => handleNodeMouseEnter(node, e)}
                      onMouseLeave={handleNodeMouseLeave}
                      opacity={isDimmed ? 0.25 : 1}
                    >
                      {/* Target Outer Pulse Ring */}
                      {isTarget && (
                        <circle
                          r={radius + 6}
                          fill="none"
                          stroke="#92400e"
                          strokeWidth="2"
                          strokeDasharray="3,3"
                          opacity="0.7"
                        >
                          <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0"
                            to="360"
                            dur="8s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}

                      {/* Main Application Circle */}
                      <circle
                        r={radius}
                        fill={colors.fill}
                        stroke={isTarget ? '#92400e' : isSelected ? '#0f172a' : colors.stroke}
                        strokeWidth={isTarget ? 3.5 : isSelected ? 3 : 1.5}
                        style={{ transition: 'stroke-width 0.2s, r 0.2s' }}
                      />

                      {/* Score or App ID inside circle */}
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={isTarget ? '12' : '11'}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {node.id.replace('app_', 'A')}
                      </text>

                      {/* Score Badge Pill above circle */}
                      <g transform={`translate(0, ${-radius - 8})`}>
                        <rect
                          x="-14"
                          y="-8"
                          width="28"
                          height="14"
                          rx="3"
                          fill="#ffffff"
                          stroke={colors.fill}
                          strokeWidth="1.5"
                        />
                        <text
                          x="0"
                          y="2"
                          textAnchor="middle"
                          fill={colors.fill}
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {currentScore}
                        </text>
                      </g>

                      {/* Name Label below circle */}
                      <text
                        x="0"
                        y={radius + 14}
                        textAnchor="middle"
                        fill="#1e293b"
                        fontSize="10.5"
                        fontWeight={isTarget ? 'bold' : '500'}
                      >
                        {node.label.split(':')[1] || node.label}
                      </text>
                    </g>
                  )
                })}
            </svg>

            {/* ── 4. Floating Hover Micro-Card ── */}
            {hoveredNode && (
              <div
                className="absolute z-20 pointer-events-none p-3 border border-slate-300 bg-white shadow-lg text-slate-900 text-xs max-w-xs"
                style={{
                  left: `${Math.min(hoverCoords.x + 12, 520)}px`,
                  top: `${Math.min(hoverCoords.y + 12, 220)}px`,
                }}
              >
                {hoveredNode.type === 'application' ? (
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-1.5">
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                        <Layers className="w-3 h-3" />
                        App #{hoveredNode.app_id}
                      </span>
                      <span className="font-mono text-[10px] font-bold border border-slate-400 bg-slate-100 text-slate-700 px-1.5 py-0.5 uppercase">
                        {hoveredNode.status}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-900 text-sm">{hoveredNode.farmer_name}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">Aadhaar: {hoveredNode.aadhaar_masked}</p>
                    <p className="text-[11px] text-slate-500">Village: {hoveredNode.village}</p>

                    <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-center font-mono">
                      <div className="border border-slate-200 bg-slate-50 p-1.5">
                        <span className="text-[10px] text-slate-500 block uppercase">Rule Score</span>
                        <span className="font-bold text-emerald-700 text-xs">
                          {hoveredNode.initial_score}
                        </span>
                      </div>
                      <div className="border border-slate-200 bg-slate-50 p-1.5">
                        <span className="text-[10px] text-slate-500 block uppercase">Graph Score</span>
                        <span className="font-bold text-red-700 text-xs">
                          {hoveredNode.elevated_score}
                        </span>
                      </div>
                    </div>

                    {hoveredNode.app_id && onOpenApplication && (
                      <p className="text-[10px] text-slate-500 mt-1.5 text-center">Click to inspect dossier →</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-1.5">
                      <span className="font-mono font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                        Shared {hoveredNode.type}
                      </span>
                      <span className="font-mono text-[10px] font-bold border border-blue-400 bg-blue-50 text-blue-800 px-1.5 py-0.5">
                        Degree: {hoveredNode.degree}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900">{hoveredNode.full_masked}</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {hoveredNode.degree > 3 ? (
                        <span className="text-red-700 font-semibold">⚠️ Exceeds syndicate threshold (&gt;3 claimants).</span>
                      ) : (
                        <span>Shared by {hoveredNode.degree} distinct applicants.</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Legend ── */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600 font-mono px-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-slate-700 uppercase tracking-wider">Shapes:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-800 inline-block" />
                Circle: Application
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-blue-700 bg-white inline-block" />
                [B]: Bank
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-violet-700 bg-white inline-block" />
                [M]: Mobile
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-green-700 bg-white inline-block" />
                [P]: Parcel
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-amber-700 bg-white inline-block" />
                [D]: Document
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700 uppercase tracking-wider">Risk:</span>
              <span className="text-green-800 font-semibold">● Low</span>
              <span className="text-amber-700 font-semibold">● Moderate</span>
              <span className="text-orange-700 font-semibold">● High</span>
              <span className="text-red-700 font-semibold">● Critical</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Where and When Telemetry Strips ──────────────────────────────── */}
      {data.where && data.when && (
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* WHERE Strip: Geographic density bar */}
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded bg-gov-blue/10 text-gov-blue mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">
                  Where: {data.where.village_name}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    data.where.status === 'ALERT'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {data.where.ratio}x Baseline
                </span>
              </div>
              {/* Density Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-gov-blue h-2 rounded-l-full"
                  style={{ width: `${Math.min((data.where.baseline_volume / data.where.current_volume) * 100, 100)}%` }}
                  title={`Baseline: ${data.where.baseline_volume}`}
                />
                <div
                  className="bg-rose-500 h-2 rounded-r-full"
                  style={{ width: `${Math.max(0, 100 - (data.where.baseline_volume / data.where.current_volume) * 100)}%` }}
                  title={`Surge: ${data.where.current_volume - data.where.baseline_volume}`}
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                <strong>{data.where.current_volume} applications</strong> logged vs. historical baseline of <strong>{data.where.baseline_volume}</strong> ({data.where.message}).
              </p>
            </div>
          </div>

          {/* WHEN Strip: 48h Temporal spike */}
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded bg-gov-saffron/10 text-gov-saffron mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">
                  When: {data.when.event_name}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    data.when.status === 'SPIKE_DETECTED'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {data.when.window_hours}h Pre-Event
                </span>
              </div>
              {/* Submission Timeline Dots */}
              <div className="w-full bg-slate-200 rounded-full h-2 relative flex items-center px-2">
                <span className="absolute left-3 w-2 h-2 rounded-full bg-rose-500" title="Submission 1" />
                <span className="absolute left-8 w-2 h-2 rounded-full bg-rose-500" title="Submission 2" />
                <span className="absolute left-14 w-2 h-2 rounded-full bg-rose-500" title="Submission 3" />
                <span className="absolute left-24 w-2 h-2 rounded-full bg-rose-500" title="Submission 4" />
                <span className="absolute right-4 w-2.5 h-2.5 rounded-full bg-gov-saffron" title="Event Cutoff Date" />
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                <strong>{data.when.application_count} submissions</strong> arrived within {data.when.window_hours} hours prior to cutoff ({data.when.message}).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
