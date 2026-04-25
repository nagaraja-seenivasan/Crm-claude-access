import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import {v4 as uuidv4} from 'uuid';
import {
  RuleNode,
  NodeConnection,
  NodeType,
  PaletteItem,
  Position,
  NodeData,
  TriggerNodeData,
  ConditionNodeData,
  SetValueNodeData,
  NotificationNodeData,
  EntityField,
  OPERATOR_LABELS,
} from '../../models/rule.models';

interface DrawingState {
  sourceNodeId: string;
  sourcePortId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface DragState {
  node: RuleNode;
  offsetX: number;
  offsetY: number;
}

interface PanState {
  active: boolean;
  startX: number;
  startY: number;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 110;
const PORT_RADIUS = 6;

@Component({
  selector: 'app-rule-canvas',
  templateUrl: './rule-canvas.component.html',
  styleUrls: ['./rule-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true}) canvasEl!: ElementRef<HTMLDivElement>;

  @Input() entityFields: EntityField[] = [];
  @Output() nodeSelected = new EventEmitter<RuleNode | null>();
  @Output() ruleChanged = new EventEmitter<{nodes: RuleNode[]; connections: NodeConnection[]}>();

  nodes: RuleNode[] = [];
  connections: NodeConnection[] = [];
  selectedNode: RuleNode | null = null;

  scale = 1;
  panX = 0;
  panY = 0;

  dragging: DragState | null = null;
  drawing: DrawingState | null = null;
  panning: PanState = {active: false, startX: 0, startY: 0};

  readonly operatorLabels = OPERATOR_LABELS;
  readonly nodeWidth = NODE_WIDTH;
  readonly nodeHeight = NODE_HEIGHT;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  // ── Palette drop ──────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const raw = event.dataTransfer?.getData('application/json');
    if (!raw) return;

    const item = JSON.parse(raw) as PaletteItem;
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.panX) / this.scale;
    const y = (event.clientY - rect.top - this.panY) / this.scale;

    this.addNode(item, {x: Math.max(20, x - NODE_WIDTH / 2), y: Math.max(20, y - NODE_HEIGHT / 2)});
  }

  addNode(item: PaletteItem, position: Position): void {
    const node: RuleNode = {
      id: uuidv4(),
      type: item.type,
      label: item.label,
      position,
      data: this.defaultData(item),
    };
    this.nodes = [...this.nodes, node];
    this.emit();
    this.cdr.markForCheck();
  }

  private defaultData(item: PaletteItem): NodeData {
    switch (item.type as NodeType) {
      case 'trigger':
        return {
          triggerType: item.label === 'SQS Trigger' ? 'SQS' : 'RECORD_SAVE',
          entityType: '',
        } as TriggerNodeData;
      case 'condition':
        return {field: '', operator: 'equals', value: '', logicalOperator: 'AND', conditions: []} as ConditionNodeData;
      case 'set-value':
        return {assignments: [], saveEntity: true} as SetValueNodeData;
      case 'notification':
        return {channel: 'EMAIL', templateId: '', recipientField: ''} as NotificationNodeData;
      default:
        return {};
    }
  }

  // ── Node mouse events ──────────────────────────────────────────────────────

  onNodeMouseDown(event: MouseEvent, node: RuleNode): void {
    if ((event.target as HTMLElement).closest('.rb-port, .rb-node-delete')) return;
    event.stopPropagation();
    this.dragging = {
      node,
      offsetX: event.clientX / this.scale - node.position.x,
      offsetY: event.clientY / this.scale - node.position.y,
    };
  }

  onNodeClick(event: MouseEvent, node: RuleNode): void {
    event.stopPropagation();
    this.selectedNode = node;
    this.nodeSelected.emit(node);
    this.cdr.markForCheck();
  }

  deleteNode(event: MouseEvent, node: RuleNode): void {
    event.stopPropagation();
    this.nodes = this.nodes.filter(n => n.id !== node.id);
    this.connections = this.connections.filter(
      c => c.sourceNodeId !== node.id && c.targetNodeId !== node.id,
    );
    if (this.selectedNode?.id === node.id) {
      this.selectedNode = null;
      this.nodeSelected.emit(null);
    }
    this.emit();
    this.cdr.markForCheck();
  }

  deleteConnection(event: MouseEvent, conn: NodeConnection): void {
    event.stopPropagation();
    this.connections = this.connections.filter(c => c.id !== conn.id);
    this.emit();
    this.cdr.markForCheck();
  }

  // ── Port events ────────────────────────────────────────────────────────────

  onOutputPortMouseDown(event: MouseEvent, node: RuleNode, portId: string): void {
    event.stopPropagation();
    event.preventDefault();
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    const portEl = event.currentTarget as HTMLElement;
    const pRect = portEl.getBoundingClientRect();
    this.drawing = {
      sourceNodeId: node.id,
      sourcePortId: portId,
      startX: (pRect.left + PORT_RADIUS - rect.left - this.panX) / this.scale,
      startY: (pRect.top + PORT_RADIUS - rect.top - this.panY) / this.scale,
      currentX: (event.clientX - rect.left - this.panX) / this.scale,
      currentY: (event.clientY - rect.top - this.panY) / this.scale,
    };
  }

  onInputPortMouseUp(event: MouseEvent, node: RuleNode): void {
    event.stopPropagation();
    if (!this.drawing || this.drawing.sourceNodeId === node.id) {
      this.drawing = null;
      return;
    }

    const existing = this.connections.find(
      c =>
        c.sourceNodeId === this.drawing!.sourceNodeId &&
        c.sourcePortId === this.drawing!.sourcePortId,
    );
    if (!existing) {
      const sourceNode = this.nodes.find(n => n.id === this.drawing!.sourceNodeId);
      const isTrue = this.drawing.sourcePortId === 'output-true';
      const isFalse = this.drawing.sourcePortId === 'output-false';

      this.connections = [
        ...this.connections,
        {
          id: uuidv4(),
          sourceNodeId: this.drawing.sourceNodeId,
          sourcePortId: this.drawing.sourcePortId,
          targetNodeId: node.id,
          targetPortId: 'input',
          label:
            sourceNode?.type === 'condition'
              ? isTrue ? 'TRUE' : isFalse ? 'FALSE' : undefined
              : undefined,
        },
      ];
      this.emit();
    }
    this.drawing = null;
    this.cdr.markForCheck();
  }

  // ── Canvas mouse events ────────────────────────────────────────────────────

  onCanvasMouseDown(event: MouseEvent): void {
    if (event.button === 1 || event.altKey) {
      this.panning = {active: true, startX: event.clientX - this.panX, startY: event.clientY - this.panY};
      event.preventDefault();
    } else if (event.button === 0 && (event.target as HTMLElement).classList.contains('rb-canvas-inner')) {
      this.selectedNode = null;
      this.nodeSelected.emit(null);
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.dragging) {
      const newX = Math.max(0, event.clientX / this.scale - this.dragging.offsetX);
      const newY = Math.max(0, event.clientY / this.scale - this.dragging.offsetY);
      this.dragging.node.position = {x: newX, y: newY};
      this.cdr.markForCheck();
    }

    if (this.drawing) {
      const rect = this.canvasEl.nativeElement.getBoundingClientRect();
      this.drawing.currentX = (event.clientX - rect.left - this.panX) / this.scale;
      this.drawing.currentY = (event.clientY - rect.top - this.panY) / this.scale;
      this.cdr.markForCheck();
    }

    if (this.panning.active) {
      this.panX = event.clientX - this.panning.startX;
      this.panY = event.clientY - this.panning.startY;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this.dragging) {
      this.emit();
    }
    this.dragging = null;
    this.drawing = null;
    this.panning.active = false;
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    this.scale = Math.min(2, Math.max(0.25, this.scale * delta));
    this.cdr.markForCheck();
  }

  // ── Zoom/pan toolbar ───────────────────────────────────────────────────────

  zoomIn(): void {
    this.scale = Math.min(2, this.scale + 0.1);
    this.cdr.markForCheck();
  }

  zoomOut(): void {
    this.scale = Math.max(0.25, this.scale - 0.1);
    this.cdr.markForCheck();
  }

  resetView(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.cdr.markForCheck();
  }

  // ── SVG path helpers ───────────────────────────────────────────────────────

  connectionPath(conn: NodeConnection): string {
    const src = this.nodes.find(n => n.id === conn.sourceNodeId);
    const tgt = this.nodes.find(n => n.id === conn.targetNodeId);
    if (!src || !tgt) return '';

    const {sx, sy} = this.outputPortCenter(src, conn.sourcePortId);
    const tx = tgt.position.x + NODE_WIDTH / 2;
    const ty = tgt.position.y;

    return this.bezier(sx, sy, tx, ty);
  }

  connectionMidpoint(conn: NodeConnection): {x: number; y: number} {
    const src = this.nodes.find(n => n.id === conn.sourceNodeId);
    const tgt = this.nodes.find(n => n.id === conn.targetNodeId);
    if (!src || !tgt) return {x: 0, y: 0};
    const {sx, sy} = this.outputPortCenter(src, conn.sourcePortId);
    const tx = tgt.position.x + NODE_WIDTH / 2;
    const ty = tgt.position.y;
    return {x: (sx + tx) / 2, y: (sy + ty) / 2};
  }

  drawingPath(): string {
    if (!this.drawing) return '';
    return this.bezier(
      this.drawing.startX, this.drawing.startY,
      this.drawing.currentX, this.drawing.currentY,
    );
  }

  private outputPortCenter(node: RuleNode, portId: string): {sx: number; sy: number} {
    const isTrue = portId === 'output-true' || portId === 'output';
    const isFalse = portId === 'output-false';
    const sx =
      node.type === 'condition' && isFalse
        ? node.position.x + NODE_WIDTH * 0.25
        : node.type === 'condition' && isTrue
        ? node.position.x + NODE_WIDTH * 0.75
        : node.position.x + NODE_WIDTH / 2;
    const sy = node.position.y + NODE_HEIGHT;
    return {sx, sy};
  }

  private bezier(sx: number, sy: number, tx: number, ty: number): string {
    const dy = Math.abs(ty - sy);
    const cp = Math.max(60, dy * 0.5);
    return `M ${sx} ${sy} C ${sx} ${sy + cp} ${tx} ${ty - cp} ${tx} ${ty}`;
  }

  // ── Node summary helpers ───────────────────────────────────────────────────

  conditionSummary(node: RuleNode): string {
    const d = node.data as ConditionNodeData;
    if (!d.field) return 'Configure condition…';
    const op = this.operatorLabels[d.operator] ?? d.operator;
    return `${d.field} ${op} ${d.value ?? ''}`.trim();
  }

  setValueSummary(node: RuleNode): string {
    const d = node.data as SetValueNodeData;
    if (!d.assignments?.length) return 'Configure assignments…';
    return `${d.assignments.length} field assignment${d.assignments.length > 1 ? 's' : ''}`;
  }

  notificationSummary(node: RuleNode): string {
    const d = node.data as NotificationNodeData;
    if (!d.channel) return 'Configure notification…';
    return `${d.channel}${d.templateId ? ' · ' + d.templateId : ''}`;
  }

  triggerSummary(node: RuleNode): string {
    const d = node.data as TriggerNodeData;
    return d.entityType ? `${d.triggerType} on ${d.entityType}` : d.triggerType || 'Configure trigger…';
  }

  nodeIcon(type: NodeType): string {
    const icons: Record<NodeType, string> = {
      trigger: 'pi-bolt',
      condition: 'pi-sitemap',
      'set-value': 'pi-pencil',
      notification: 'pi-bell',
      end: 'pi-stop-circle',
    };
    return icons[type] ?? 'pi-circle';
  }

  hasOutputPorts(type: NodeType): boolean {
    return type !== 'end';
  }

  isCondition(type: NodeType): boolean {
    return type === 'condition';
  }

  trackById(_: number, item: {id: string}): string {
    return item.id;
  }

  // ── Public API for parent ──────────────────────────────────────────────────

  loadRule(nodes: RuleNode[], connections: NodeConnection[]): void {
    this.nodes = nodes;
    this.connections = connections;
    this.cdr.markForCheck();
  }

  updateNode(updated: RuleNode): void {
    this.nodes = this.nodes.map(n => (n.id === updated.id ? {...n, ...updated} : n));
    this.selectedNode = updated;
    this.emit();
    this.cdr.markForCheck();
  }

  clearCanvas(): void {
    this.nodes = [];
    this.connections = [];
    this.selectedNode = null;
    this.nodeSelected.emit(null);
    this.emit();
    this.cdr.markForCheck();
  }

  private emit(): void {
    this.ruleChanged.emit({nodes: this.nodes, connections: this.connections});
  }

  get canvasTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }

  get zoomPercent(): number {
    return Math.round(this.scale * 100);
  }
}
