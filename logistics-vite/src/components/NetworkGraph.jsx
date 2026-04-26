import { useEffect, useRef, useState } from 'react';

// Static graph topology from Main.java — A,B,C,D,E nodes
const STATIC_NODES = {
  A: { x: 380, y: 70,  label: 'Node A', role: 'Origin Hub' },
  B: { x: 180, y: 220, label: 'Node B', role: 'Warehouse' },
  C: { x: 580, y: 220, label: 'Node C', role: 'Distribution' },
  D: { x: 280, y: 380, label: 'Node D', role: 'City Hub' },
  E: { x: 580, y: 380, label: 'Node E', role: 'Terminal' },
};

const STATIC_EDGES = [
  { from: 'A', to: 'B', weight: 5 },
  { from: 'A', to: 'C', weight: 6 },
  { from: 'B', to: 'D', weight: 3 },
  { from: 'C', to: 'D', weight: 2 },
  { from: 'C', to: 'E', weight: 4 },
];

function getEdgeId(from, to) { return `${from}-${to}`; }

export default function NetworkGraph({ activeRoute = [], blockedEdges = [], graphData = null }) {
  const [animKey, setAnimKey] = useState(0);
  const [tooltip, setTooltip] = useState(null);

  // Parse live graph data if available
  let nodes = STATIC_NODES;
  let edges = STATIC_EDGES;

  if (graphData && graphData.nodes) {
    // Use live data from /api/graph if available
    // graphData might have nodes array + edges array
  }

  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [activeRoute.join(',')]);

  const routeEdgeSet = new Set();
  if (activeRoute.length > 1) {
    for (let i = 0; i < activeRoute.length - 1; i++) {
      routeEdgeSet.add(getEdgeId(activeRoute[i], activeRoute[i + 1]));
    }
  }

  const blockedSet = new Set(blockedEdges.map(e => getEdgeId(e.from, e.to)));

  const isActiveNode = (id) => activeRoute.includes(id);

  return (
    <div className="network-container" style={{ minHeight: 300 }}>
      <svg width="760" height="460" style={{ background: 'transparent' }}>
        <defs>
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-node" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background grid */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`}
            x1={0} y1={i * 57.5}
            x2={760} y2={i * 57.5}
            stroke="#0f1921" strokeWidth="1"
          />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`v${i}`}
            x1={i * 76} y1={0}
            x2={i * 76} y2={460}
            stroke="#0f1921" strokeWidth="1"
          />
        ))}

        {/* Edges */}
        {edges.map(edge => {
          const fromNode = nodes[edge.from];
          const toNode = nodes[edge.to];
          if (!fromNode || !toNode) return null;

          const edgeId = getEdgeId(edge.from, edge.to);
          const reverseEdgeId = getEdgeId(edge.to, edge.from);
          const isActive = routeEdgeSet.has(edgeId) || routeEdgeSet.has(reverseEdgeId);
          const isBlocked = blockedSet.has(edgeId) || blockedSet.has(reverseEdgeId);

          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const r = 22; // node radius
          const x1 = fromNode.x + (dx / len) * r;
          const y1 = fromNode.y + (dy / len) * r;
          const x2 = toNode.x - (dx / len) * (r + 4);
          const y2 = toNode.y - (dy / len) * (r + 4);

          // midpoint for weight label
          const mx = (fromNode.x + toNode.x) / 2;
          const my = (fromNode.y + toNode.y) / 2;

          // Total dash length for animation
          const pathLen = Math.sqrt((x2-x1)**2 + (y2-y1)**2);

          return (
            <g key={`${edgeId}-${animKey}`}>
              {/* Shadow glow for active */}
              {isActive && (
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#00e5ff" strokeWidth="6" strokeOpacity="0.2"
                  filter="url(#glow-cyan)"
                />
              )}

              {/* Main edge line */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isBlocked ? '#ff3d5a' : isActive ? '#00e5ff' : '#1e2d42'}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeDasharray={isBlocked ? '6 3' : isActive ? `${pathLen}` : 'none'}
                strokeDashoffset={isActive ? `${pathLen}` : undefined}
                style={isActive ? {
                  animation: `dash 0.8s ease forwards`,
                  animationDelay: (() => {
                    // Find position in route
                    const idx = activeRoute.indexOf(edge.from);
                    return `${idx * 0.3}s`;
                  })(),
                } : {}}
              />

              {/* Weight label */}
              <g>
                <rect
                  x={mx - 10} y={my - 9}
                  width={20} height={16}
                  rx={3}
                  fill={isActive ? '#001f2d' : '#0d1117'}
                  stroke={isActive ? '#00e5ff44' : '#1e2d42'}
                />
                <text
                  x={mx} y={my + 3}
                  textAnchor="middle"
                  fill={isActive ? '#00e5ff' : isBlocked ? '#ff3d5a' : '#4a5a70'}
                  fontSize="10"
                  fontFamily="Space Mono, monospace"
                  fontWeight="700"
                >
                  {edge.weight}h
                </text>
              </g>

              {/* Blocked X mark */}
              {isBlocked && (
                <text x={mx} y={my - 16}
                  textAnchor="middle"
                  fill="#ff3d5a"
                  fontSize="14">✕</text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {Object.entries(nodes).map(([id, node]) => {
          const active = isActiveNode(id);
          const isStart = activeRoute[0] === id;
          const isEnd = activeRoute[activeRoute.length - 1] === id;

          return (
            <g key={id}
              onMouseEnter={() => setTooltip({ id, node })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Outer glow ring for active nodes */}
              {active && (
                <circle
                  cx={node.x} cy={node.y} r={32}
                  fill="none"
                  stroke={isStart ? '#00e676' : isEnd ? '#ffb300' : '#00e5ff'}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  filter="url(#glow-node)"
                />
              )}

              {/* Node circle */}
              <circle
                cx={node.x} cy={node.y} r={22}
                fill={active
                  ? (isStart ? '#001f14' : isEnd ? '#1f1200' : '#001f2d')
                  : '#0d1520'}
                stroke={active
                  ? (isStart ? '#00e676' : isEnd ? '#ffb300' : '#00e5ff')
                  : '#1e2d42'}
                strokeWidth={active ? 2 : 1.5}
              />

              {/* Node label */}
              <text
                x={node.x} y={node.y + 5}
                textAnchor="middle"
                fill={active
                  ? (isStart ? '#00e676' : isEnd ? '#ffb300' : '#00e5ff')
                  : '#8899b0'}
                fontSize="14"
                fontFamily="Space Mono, monospace"
                fontWeight="700"
              >
                {id}
              </text>

              {/* Role label */}
              <text
                x={node.x} y={node.y + 38}
                textAnchor="middle"
                fill="#4a5a70"
                fontSize="9"
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {node.role}
              </text>

              {/* Start/End indicator */}
              {isStart && (
                <text x={node.x} y={node.y - 30}
                  textAnchor="middle" fill="#00e676"
                  fontSize="9" fontFamily="Space Mono, monospace" fontWeight="700">
                  ORIGIN
                </text>
              )}
              {isEnd && (
                <text x={node.x} y={node.y - 30}
                  textAnchor="middle" fill="#ffb300"
                  fontSize="9" fontFamily="Space Mono, monospace" fontWeight="700">
                  DEST
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (() => {
          const { id, node } = tooltip;
          const tx = node.x + (node.x > 400 ? -140 : 30);
          const ty = node.y - 30;
          return (
            <g>
              <rect x={tx} y={ty} width={130} height={46} rx={6}
                fill="#131920" stroke="#1e2d42" />
              <text x={tx + 10} y={ty + 16} fill="#00e5ff"
                fontSize="11" fontFamily="Space Mono, monospace" fontWeight="700">
                Node {id}
              </text>
              <text x={tx + 10} y={ty + 32} fill="#8899b0"
                fontSize="10" fontFamily="IBM Plex Sans, sans-serif">
                {node.role}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, padding: '8px 4px 4px', flexWrap: 'wrap' }}>
        {[
          { color: '#00e5ff', label: 'Active Route' },
          { color: '#00e676', label: 'Origin' },
          { color: '#ffb300', label: 'Destination' },
          { color: '#ff3d5a', label: 'Blocked Edge' },
          { color: '#1e2d42', label: 'Normal Edge' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: '#4a5a70', fontFamily: 'Space Mono' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
