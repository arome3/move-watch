'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { CallGraphNode as CallGraphNodeType } from '@movewatch/shared';

interface CallGraphDiagramProps {
  callGraph: CallGraphNodeType;
  totalGas: number;
}

// Custom node component for the call graph
function CallNode({ data }: { data: {
  module: string;
  function: string;
  gasUsed: number;
  percentage: number;
  isEntry: boolean;
  isHot: boolean;
}}) {
  const bgColor = data.isEntry
    ? 'bg-primary-500/20 border-primary-500'
    : data.isHot
      ? 'bg-red-500/20 border-red-500'
      : 'bg-dark-800 border-dark-600';

  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${bgColor} min-w-[180px]`}>
      <Handle type="target" position={Position.Top} className="!bg-dark-500" />

      {/* Module name */}
      <div className="text-[10px] text-dark-500 uppercase tracking-wide mb-1">
        {data.module.split('::').slice(-1)[0]}
      </div>

      {/* Function name */}
      <div className="text-sm font-mono text-dark-200 font-medium truncate">
        {data.function}
      </div>

      {/* Gas info */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-700">
        <span className="text-xs text-dark-400">
          {data.gasUsed.toLocaleString()} gas
        </span>
        <span className={`text-xs font-medium ${
          data.percentage > 50 ? 'text-red-400' :
          data.percentage > 20 ? 'text-yellow-400' :
          'text-green-400'
        }`}>
          {data.percentage.toFixed(1)}%
        </span>
      </div>

      {/* Entry badge */}
      {data.isEntry && (
        <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-primary-500 text-white text-[9px] font-bold rounded">
          ENTRY
        </div>
      )}

      {/* Hot path indicator */}
      {data.isHot && !data.isEntry && (
        <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded">
          HOT
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-dark-500" />
    </div>
  );
}

const nodeTypes = {
  callNode: CallNode,
};

// Convert call graph to ReactFlow nodes and edges
function buildNodesAndEdges(
  node: CallGraphNodeType,
  parentId: string | null = null,
  depth: number = 0,
  xOffset: number = 0,
  totalGas: number = 0
): { nodes: Node[]; edges: Edge[]; width: number } {
  const nodeId = `${node.module}-${node.function}-${depth}-${xOffset}`;
  const isEntry = depth === 0;
  const isHot = node.percentage > 30;

  const currentNode: Node = {
    id: nodeId,
    type: 'callNode',
    position: { x: xOffset * 220, y: depth * 120 },
    data: {
      module: node.module,
      function: node.function,
      gasUsed: node.gasUsed,
      percentage: node.percentage,
      isEntry,
      isHot,
    },
  };

  let nodes: Node[] = [currentNode];
  let edges: Edge[] = [];

  if (parentId) {
    edges.push({
      id: `${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      type: 'smoothstep',
      animated: isHot,
      style: {
        stroke: isHot ? '#ef4444' : '#4b5563',
        strokeWidth: isHot ? 2 : 1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isHot ? '#ef4444' : '#4b5563',
      },
    });
  }

  // Process children
  let totalWidth = 1;
  if (node.children && node.children.length > 0) {
    let childXOffset = xOffset - (node.children.length - 1) / 2;

    for (const child of node.children) {
      const childResult = buildNodesAndEdges(
        child,
        nodeId,
        depth + 1,
        childXOffset,
        totalGas
      );
      nodes = [...nodes, ...childResult.nodes];
      edges = [...edges, ...childResult.edges];
      childXOffset += childResult.width;
      totalWidth = Math.max(totalWidth, childResult.width);
    }
  }

  return { nodes, edges, width: totalWidth };
}

export function CallGraphDiagram({ callGraph, totalGas }: CallGraphDiagramProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = buildNodesAndEdges(callGraph, null, 0, 0, totalGas);

    // Center the graph
    const minX = Math.min(...nodes.map(n => n.position.x));
    const maxX = Math.max(...nodes.map(n => n.position.x));
    const centerOffset = (maxX - minX) / 2;

    const centeredNodes = nodes.map(n => ({
      ...n,
      position: { ...n.position, x: n.position.x - minX + 100 },
    }));

    return { initialNodes: centeredNodes, initialEdges: edges };
  }, [callGraph, totalGas]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="h-[400px] bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background color="#374151" gap={16} />
        <Controls className="!bg-dark-800 !border-dark-700 !shadow-lg" />
        <MiniMap
          className="!bg-dark-800 !border-dark-700"
          nodeColor={(node) => {
            if (node.data?.isEntry) return '#22d3ee';
            if (node.data?.isHot) return '#ef4444';
            return '#6b7280';
          }}
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-dark-800/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-dark-700">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary-500/50 border border-primary-500" />
            <span className="text-dark-400">Entry Point</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500/50 border border-red-500" />
            <span className="text-dark-400">Hot Path (&gt;30%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-dark-700 border border-dark-600" />
            <span className="text-dark-400">Normal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
