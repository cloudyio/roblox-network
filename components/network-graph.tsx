'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NetworkData, NetworkNode, NetworkLink, User } from '@/types/user';

interface NetworkGraphProps {
  onNodeClick?: (nodeId: number) => void;
  username?: string;
  onUserChange?: (username: string) => void;
  shortestPath?: number[];
  pathNodes?: any[];
  pathLinks?: any[];
}

export function NetworkGraph({ onNodeClick, username, onUserChange, shortestPath = [], pathNodes = [], pathLinks = [] }: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [networkData, setNetworkData] = useState<NetworkData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [mainUser, setMainUser] = useState<{ id: number; username: string; friendCount: number } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  
  // Zoom and Pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pinnedNodes, setPinnedNodes] = useState<Set<number>>(new Set());
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  // Simulation state
  const animationRef = useRef<number | undefined>(undefined);
  const simulationRef = useRef({
    nodes: [] as (NetworkNode & { x: number; y: number; vx: number; vy: number; pinned?: boolean })[],
    links: [] as NetworkLink[]
  });

  // Stable function refs
  const updateSimulationRef = useRef<() => void>(() => {});
  const drawRef = useRef<() => void>(() => {});
  const startSimulationRef = useRef<() => void>(() => {});
  const initializeSimulationRef = useRef<(data: NetworkData) => void>(() => {});

  // Coordinate conversion helpers
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom,
    };
  };

  const worldToScreen = (worldX: number, worldY: number) => {
    return {
      x: worldX * zoom + panOffset.x,
      y: worldY * zoom + panOffset.y,
    };
  };

  // Add frame counter for debugging
  const frameCountRef = useRef(0);

  // Initialize stable functions
  updateSimulationRef.current = () => {
    const { nodes, links } = simulationRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Apply forces
    for (const node of nodes) {
      // Skip physics for pinned nodes
      if (node.pinned || pinnedNodes.has(node.id)) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }

      // Center force - ensure positions are finite before calculation
      if (isFinite(node.x) && isFinite(node.y)) {
        node.vx += (width / 2 - node.x) * 0.0001;
        node.vy += (height / 2 - node.y) * 0.0001;
      }

      // Repulsion between nodes
      for (const other of nodes) {
        if (node === other) continue;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 100 && distance > 0.1) { // Avoid division by zero
          const force = 100 / (distance + 1);
          node.vx += (dx / distance) * force * 0.01;
          node.vy += (dy / distance) * force * 0.01;
        }
      }
    }

    // Link forces
    for (const link of links) {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Avoid division by zero
      if (distance < 0.1) continue;
      
      const targetDistance = 150;
      const force = (distance - targetDistance) * 0.001;

      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      // Only apply forces to non-pinned nodes
      if (!source.pinned && !pinnedNodes.has(source.id)) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.pinned && !pinnedNodes.has(target.id)) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Update positions and apply friction
    for (const node of nodes) {
      // Skip movement for pinned nodes
      if (node.pinned || pinnedNodes.has(node.id)) continue;

      // Ensure velocities are finite
      if (!isFinite(node.vx)) node.vx = 0;
      if (!isFinite(node.vy)) node.vy = 0;

      node.vx *= 0.99;
      node.vy *= 0.99;
      node.x += node.vx;
      node.y += node.vy;

      // Ensure positions are finite
      if (!isFinite(node.x)) node.x = width / 2;
      if (!isFinite(node.y)) node.y = height / 2;

      // Keep nodes in bounds
      node.x = Math.max(20, Math.min(width - 20, node.x));
      node.y = Math.max(20, Math.min(height - 20, node.y));
    }
  };

  drawRef.current = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    frameCountRef.current++;
    
    // Only log every 300 frames (about once every 5 seconds at 60fps) and only if there are issues
    const shouldLog = frameCountRef.current % 300 === 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context state
    ctx.save();
    
    // Apply zoom and pan transformations
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    const { nodes, links } = simulationRef.current;

    // Draw links
    for (const link of links) {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (!source || !target) continue;

      // Check if this link is part of the shortest path
      const isPathLink = shortestPath.length > 1 && (
        (shortestPath.includes(source.id) && shortestPath.includes(target.id) &&
         Math.abs(shortestPath.indexOf(source.id) - shortestPath.indexOf(target.id)) === 1)
      );

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      
      if (isPathLink) {
        // Highlight path links
        ctx.strokeStyle = '#ff6b6b'; // Bright red for path
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = link.color || '#6b7280';
        ctx.lineWidth = link.width || 1;
        ctx.shadowBlur = 0;
      }
      
      ctx.stroke();
    }

    let invalidNodeCount = 0;

    // Draw nodes
    for (const node of nodes) {
      const radius = Math.max(node.val || 4, 8);
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode === node.id;
      const isMainUser = mainUser && node.id === mainUser.id;
      const isExpanded = expandedNodes.has(node.id);
      const isExpandable = !isMainUser && !isExpanded;
      const isPinned = pinnedNodes.has(node.id);
      const isInPath = shortestPath.includes(node.id);

      // Skip nodes that are way off screen or have invalid positions
      if (!isFinite(node.x) || !isFinite(node.y)) {
        invalidNodeCount++;
        continue;
      }

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      
      if (isInPath) {
        // Highlight path nodes
        ctx.fillStyle = '#ff6b6b'; // Bright red for path nodes
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = node.color || '#3b82f6';
        ctx.shadowBlur = 0;
      }
      
      ctx.fill();

      // Draw border for hover/selection
      if (isHovered || isSelected) {
        ctx.strokeStyle = isSelected ? '#ffffff' : '#e5e7eb';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();
      }

      // Draw path order number for path nodes
      if (isInPath && shortestPath.length > 1) {
        const pathIndex = shortestPath.indexOf(node.id);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${10}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((pathIndex + 1).toString(), node.x, node.y);
      }

      // Draw expansion indicator for expandable nodes
      if (isExpandable && !isMainUser && !isInPath) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fbbf24'; // Yellow ring for expandable
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]); // Dashed line
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
      }

      // Draw "expanded" indicator for expanded nodes (but not main user)
      if (isExpanded && !isMainUser && !isInPath) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = '#10b981'; // Green ring for expanded
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Add a second inner ring for more visibility
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 1, 0, 2 * Math.PI);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw "pinned" indicator for pinned nodes
      if (isPinned) {
        ctx.beginPath();
        ctx.arc(node.x, node.y - radius - 5, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444'; // Red pin indicator
        ctx.fill();
        // Draw pin "stick"
        ctx.beginPath();
        ctx.moveTo(node.x, node.y - radius - 2);
        ctx.lineTo(node.x, node.y - radius + 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Always draw username below node
      ctx.fillStyle = isInPath ? '#ff6b6b' : '#ffffff';
      ctx.font = isInPath ? 'bold 12px sans-serif' : '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Add text outline for better visibility
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(node.name, node.x, node.y + radius + 5);
      ctx.fillText(node.name, node.x, node.y + radius + 5);
    }

    // Skip nodes with invalid positions (logged count: invalidNodeCount)

    // Restore context state to remove transformations for next frame
    ctx.restore();
  };

  startSimulationRef.current = () => {
    const animate = () => {
      updateSimulationRef.current?.();
      drawRef.current?.();
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  initializeSimulationRef.current = (newData: NetworkData) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }

    // Force canvas to update its size first
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Ensure canvas has valid dimensions - wait if not ready
    if (width <= 0 || height <= 0) {
      setTimeout(() => initializeSimulationRef.current?.(newData), 100);
      return;
    }

    const existingNodesMap = new Map(
      simulationRef.current.nodes.map(node => [node.id, node])
    );

    const newSimNodes = newData.nodes.map((newNodeData, index) => {
      const existingNode = existingNodesMap.get(newNodeData.id);
      if (existingNode && 
          typeof existingNode.x === 'number' && 
          typeof existingNode.y === 'number' &&
          isFinite(existingNode.x) && 
          isFinite(existingNode.y)) {
        return {
          ...newNodeData, 
          x: existingNode.x,
          y: existingNode.y,
          vx: existingNode.vx || 0,
          vy: existingNode.vy || 0,
          pinned: existingNode.pinned || pinnedNodes.has(newNodeData.id)
        };
      } else {
        // Simple positioning: place nodes in a circle around the center
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Validate center coordinates
        if (!isFinite(centerX) || !isFinite(centerY)) {
          return {
            ...newNodeData,
            x: 100, // fallback position
            y: 100,
            vx: 0,
            vy: 0,
            pinned: pinnedNodes.has(newNodeData.id)
          };
        }

        let initialX = centerX;
        let initialY = centerY;

        // If this is not the main user, place in circle
        if (!mainUser || newNodeData.id !== mainUser.id) {
          const angle = (index / Math.max(newData.nodes.length, 1)) * 2 * Math.PI;
          const radius = Math.min(width, height) * 0.3; // 30% of the smaller dimension
          initialX = centerX + Math.cos(angle) * radius;
          initialY = centerY + Math.sin(angle) * radius;
        }

        // Validate final positions
        if (!isFinite(initialX) || !isFinite(initialY)) {
          initialX = centerX;
          initialY = centerY;
        }

        return {
          ...newNodeData,
          x: initialX,
          y: initialY,
          vx: 0,
          vy: 0,
          pinned: pinnedNodes.has(newNodeData.id)
        };
      }
    });

    // Validate all nodes have valid positions before proceeding
    const invalidNodes = newSimNodes.filter(node => !isFinite(node.x) || !isFinite(node.y));
    if (invalidNodes.length > 0) {
      // Fix invalid nodes
      invalidNodes.forEach(node => {
        node.x = width / 2;
        node.y = height / 2;
      });
    }

    simulationRef.current = { nodes: newSimNodes, links: newData.links };
    startSimulationRef.current?.();
  };

  const fetchNetworkData = useCallback(async () => {
    if (!username) {
      setNetworkData({ nodes: [], links: [] });
      setMainUser(null);
      setExpandedNodes(new Set());
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setPinnedNodes(new Set());
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      // Don't reset zoom and pan when fetching network data
      // Only reset these when username changes (handled elsewhere)
      setPinnedNodes(new Set());
      setExpandedNodes(new Set());
      
      const response = await fetch(`/api/network/${encodeURIComponent(username)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Username not found in database');
        }
        throw new Error('Failed to fetch network data');
      }
      
      const data = await response.json();
      setNetworkData(data.networkData);
      setMainUser(data.mainUser);
      
      if (data.networkData.nodes.length > 0) {
        initializeSimulationRef.current?.(data.networkData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setNetworkData({ nodes: [], links: [] });
      setMainUser(null);
      setExpandedNodes(new Set());
      setPinnedNodes(new Set());
    } finally {
      setLoading(false);
    }
  }, [username]);

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    const { nodes } = simulationRef.current;
    
    setMouseDownPos({ x: screenX, y: screenY }); // Use screen coordinates for drag distance check
    setHasDragged(false);
    
    let clickedOnNode = null;
    for (const node of nodes) {
      const distance = Math.sqrt((worldPos.x - node.x) ** 2 + (worldPos.y - node.y) ** 2);
      const radius = Math.max(node.val || 4, 8);
      
      if (distance <= radius) {
        clickedOnNode = node.id;
        break;
      }
    }

    if (clickedOnNode !== null) {
      setDraggedNode(clickedOnNode);
      // Calculate drag offset in world coordinates, then convert to screen for initial placement if needed
      // Or, more simply, store world offset from node center
      const nodeToDrag = nodes.find(n => n.id === clickedOnNode);
      if (nodeToDrag) {
        setDragOffset({
          x: worldPos.x - nodeToDrag.x, 
          y: worldPos.y - nodeToDrag.y
        });
      }
    } else {
      // Clicked on empty space, start panning
      setIsPanning(true);
      setLastPanPosition({ x: screenX, y: screenY });
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    
    if (draggedNode !== null) {
      const moveDistance = Math.sqrt(
        Math.pow(screenX - mouseDownPos.x, 2) + Math.pow(screenY - mouseDownPos.y, 2)
      );
      
      if (moveDistance > 5 && !isDragging) {
        setIsDragging(true);
        setHasDragged(true);
        setPinnedNodes(prev => new Set([...prev, draggedNode]));
      }
      
      if (isDragging) {
        const { nodes } = simulationRef.current;
        const node = nodes.find(n => n.id === draggedNode);
        if (node) {
          // Drag offset is in world coords, apply to node's world coords
          node.x = worldPos.x - dragOffset.x;
          node.y = worldPos.y - dragOffset.y;
          node.vx = 0;
          node.vy = 0;
        }
        canvas.style.cursor = 'grabbing';
        return;
      }
    } else if (isPanning) {
      const dx = screenX - lastPanPosition.x;
      const dy = screenY - lastPanPosition.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPosition({ x: screenX, y: screenY });
      canvas.style.cursor = 'grabbing';
      return;
    }
    
    const { nodes } = simulationRef.current;
    let foundNode = null;
    for (const node of nodes) {
      const distance = Math.sqrt((worldPos.x - node.x) ** 2 + (worldPos.y - node.y) ** 2);
      const radius = Math.max(node.val || 4, 8);
      if (distance <= radius) {
        foundNode = node.id;
        break;
      }
    }
    setHoveredNode(foundNode);
    canvas.style.cursor = foundNode ? 'grab' : (isPanning ? 'grabbing' : 'default');
  };

  const handleCanvasMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasDragged && draggedNode !== null) {
      handleNodeClick(draggedNode);
    }
    
    setIsDragging(false);
    setDraggedNode(null);
    // dragOffset reset is not strictly needed here as it's recalculated on next drag
    setHasDragged(false);
    setIsPanning(false);
    canvasRef.current?.style.setProperty('cursor', 'default');
  };

  const handleNodeClick = (nodeId: number) => {
    setSelectedNode(nodeId);
    
    // Check if this is the main user - don't allow collapsing the main user
    if (mainUser && nodeId === mainUser.id) {
      onNodeClick?.(nodeId);
      return;
    }
    
    // Toggle expansion state
    if (!expandedNodes.has(nodeId)) {
      // Expand the node
      const { nodes } = simulationRef.current;
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        expandFriendNetwork(nodeId, node.name);
      }
    } else {
      // Collapse the node - remove its friends from the network
      collapseFriendNetwork(nodeId);
    }
  };

  const handleCanvasMouseLeave = () => {
    // Stop dragging if mouse leaves canvas
    if (isDragging) {
      setIsDragging(false);
      setDraggedNode(null);
      setDragOffset({ x: 0, y: 0 });
      setHasDragged(false);
    }
    setHoveredNode(null);
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);
    const { nodes } = simulationRef.current;
    
    // Check if double-clicking on a pinned node to unpin it
    for (const node of nodes) {
      const distance = Math.sqrt((worldPos.x - node.x) ** 2 + (worldPos.y - node.y) ** 2);
      const radius = Math.max(node.val || 4, 8);
      
      if (distance <= radius && pinnedNodes.has(node.id)) {
        setPinnedNodes(prev => {
          const newSet = new Set(prev);
          newSet.delete(node.id);
          return newSet;
        });
        // Also clear the node's explicit pinned flag if it exists from dragging
        const simNode = simulationRef.current.nodes.find(n => n.id === node.id);
        if (simNode) simNode.pinned = false;
        break;
      }
    }
  };

  const expandFriendNetwork = async (friendId: number, friendName: string) => {
    if (!username || !mainUser) return;
    
    try {
      // Determine the new complete set of expanded nodes that should be active
      const newExpandedSet = new Set(expandedNodes);
      newExpandedSet.add(friendId);
      const finalDesiredExpandedNodeIds = Array.from(newExpandedSet);
      
      const response = await fetch(`/api/network/${encodeURIComponent(username)}/expand/${friendId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          finalDesiredExpandedNodeIds: finalDesiredExpandedNodeIds
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to expand friend network');
      }
      
      const data = await response.json();
      
      // API returns the new complete graph state
      setNetworkData(data.networkData);
      // Update client's source of truth for expanded nodes
      setExpandedNodes(newExpandedSet);
      
      if (data.networkData.nodes.length > 0) {
        initializeSimulationRef.current?.(data.networkData);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to expand network');
    }
  };

  const collapseFriendNetwork = async (nodeId: number) => {
    if (!username || !mainUser) return;
    
    try {
      // Determine the new complete set of expanded nodes that should be active
      const newExpandedSet = new Set(expandedNodes);
      newExpandedSet.delete(nodeId);
      const finalDesiredExpandedNodeIds = Array.from(newExpandedSet);
      
      const response = await fetch(`/api/network/${encodeURIComponent(username)}/collapse/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          finalDesiredExpandedNodeIds: finalDesiredExpandedNodeIds // Send the complete desired state
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to collapse friend network');
      }
      
      const data = await response.json();
      
      // API returns the new complete graph state
      setNetworkData(data.networkData);
      // Update client's source of truth for expanded nodes
      setExpandedNodes(newExpandedSet);
      
      if (data.networkData.nodes.length > 0) {
        initializeSimulationRef.current?.(data.networkData);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collapse network');
    }
  };

  // Reset zoom and pan when username changes
  useEffect(() => {
    if (username) {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [username]);

  useEffect(() => {
    fetchNetworkData();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [fetchNetworkData]);

  // Effect 2: Initialize simulation when networkData structure actually changes, or on initial load
  useEffect(() => {
    if (networkData.nodes.length > 0) {
      const timerId = setTimeout(() => {
          initializeSimulationRef.current?.(networkData);
      }, 50); 
      return () => clearTimeout(timerId);
    } else if (username && networkData.nodes.length === 0 && !loading && !error) {
       const timerId = setTimeout(() => { // Added timeout here too for consistency
        initializeSimulationRef.current?.({ nodes: [], links: [] });
      }, 50);
      return () => clearTimeout(timerId);
    }
  }, [networkData.nodes.length, networkData.links.length, username, loading, error]);

  // Effect: When a shortest path is found, clear expanded nodes and show only the path
  // When path is cleared, reload the original network
  useEffect(() => {
    if (pathNodes && pathNodes.length > 0) {
      setExpandedNodes(new Set());
      setNetworkData({ nodes: pathNodes, links: pathLinks || [] });
    } else if (pathNodes && pathNodes.length === 0 && username) {
      // Path was cleared, reload original network
      fetchNetworkData();
    }
  }, [pathNodes, pathLinks, fetchNetworkData, username]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Set canvas size to match its display size
      const rect = canvas.getBoundingClientRect();
      
      // Only update if dimensions are valid
      if (rect.width > 0 && rect.height > 0) {
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Canvas dimensions updated
        
        // Don't reinitialize simulation on resize - just let it adapt to new canvas size
        // The simulation will naturally adjust to the new bounds
      }
    };

    const handleWheel = (event: WheelEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Check if the event target is the canvas
      if (event.target !== canvas) return;

      event.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Get world coordinates before zoom
      const worldBeforeZoom = screenToWorld(mouseX, mouseY);

      // Zoom factor (adjust sensitivity as needed)
      const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.1, Math.min(zoom * zoomFactor, 5)); // Clamp zoom level

      setZoom(newZoom);

      // Adjust panOffset to keep the point under the mouse stationary
      setPanOffset(prevPanOffset => ({
        x: mouseX - worldBeforeZoom.x * newZoom,
        y: mouseY - worldBeforeZoom.y * newZoom,
      }));
    };

    window.addEventListener('resize', handleResize);
    
    // Add wheel event listener with passive: false to allow preventDefault
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    // Initial resize to set proper canvas size
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoom, panOffset]);

  if (!username) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">Enter your Roblox username to visualize your network</p>
          <p className="text-sm">Your friends and their connections will appear here</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-lg">Loading {username}'s network...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Error: {error}</div>
          <p className="text-sm text-gray-600">
            Make sure the username is correct and exists in the database
          </p>
        </div>
      </div>
    );
  }

  if (networkData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No network data found</p>
          <p className="text-sm">This user might not have any friends in the database</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseLeave}
        onDoubleClick={handleCanvasDoubleClick}
      />
    </div>
  );
} 