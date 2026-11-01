import {
  Component,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
  OnDestroy,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {RuleCanvasComponent} from '../rule-canvas/rule-canvas.component';
import {RuleBuilderService, ExecuteRuleRequest} from '../../services/rule-builder.service';
import {
  RuleDefinition,
  RuleNode,
  NodeConnection,
  EntityField,
  NotificationTemplate,
} from '../../models/rule.models';

interface Toast {
  id: number;
  severity: 'success' | 'error' | 'warn';
  summary: string;
}

@Component({
  selector: 'app-rule-builder-page',
  templateUrl: './rule-builder-page.component.html',
  styleUrls: ['./rule-builder-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleBuilderPageComponent implements OnInit, OnDestroy {
  @ViewChild('canvas') canvas!: RuleCanvasComponent;

  rule: RuleDefinition = {
    name: 'New Rule',
    description: '',
    entityType: 'Lead',
    isActive: false,
    triggerTypes: [],
    nodes: [],
    connections: [],
  };

  selectedNode: RuleNode | null = null;
  entityFields: EntityField[] = [];
  notificationTemplates: NotificationTemplate[] = [];

  saving = false;
  testing = false;
  showTestDialog = false;
  showTestResults = false;
  testScope = '{\n  "id": "entity-123",\n  "status": "New",\n  "amount": 5000\n}';
  testResults: unknown[] = [];
  testScopeError = '';
  showClearConfirm = false;
  toasts: Toast[] = [];
  private toastSeq = 0;
  private readonly toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly entityTypeOptions = [
    {label: 'Lead', value: 'Lead'},
    {label: 'Deal', value: 'Deal'},
    {label: 'Contact', value: 'Contact'},
    {label: 'Account', value: 'Account'},
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ruleService: RuleBuilderService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loadRule(id);
    }
    this.loadEntityFields();
    this.loadTemplates();
  }

  private loadRule(id: string): void {
    this.ruleService.getRule(id).subscribe({
      next: r => {
        this.rule = r;
        this.canvas?.loadRule(r.nodes, r.connections);
        this.loadEntityFields();
        this.cdr.markForCheck();
      },
      error: () => this.toast('error', 'Failed to load rule'),
    });
  }

  private loadEntityFields(): void {
    this.ruleService.getEntityFields(this.rule.entityType).subscribe({
      next: fields => {
        this.entityFields = fields;
        this.cdr.markForCheck();
      },
    });
  }

  private loadTemplates(): void {
    this.ruleService.getNotificationTemplates().subscribe({
      next: t => {
        this.notificationTemplates = t;
        this.cdr.markForCheck();
      },
    });
  }

  onEntityTypeChange(): void {
    this.loadEntityFields();
  }

  onNodeSelected(node: RuleNode | null): void {
    this.selectedNode = node;
    this.cdr.markForCheck();
  }

  onNodeChanged(updated: RuleNode): void {
    this.canvas.updateNode(updated);
    this.selectedNode = updated;
    this.cdr.markForCheck();
  }

  onRuleChanged(change: {nodes: RuleNode[]; connections: NodeConnection[]}): void {
    this.rule.nodes = change.nodes;
    this.rule.connections = change.connections;
  }

  saveRule(): void {
    if (!this.rule.name.trim()) {
      this.toast('warn', 'Please enter a rule name');
      return;
    }
    this.saving = true;
    this.ruleService.saveRule(this.rule).subscribe({
      next: saved => {
        // POST returns the created rule; PATCH returns 204 with no body.
        if (saved?.id) this.rule.id = saved.id;
        this.saving = false;
        this.toast('success', 'Rule saved successfully');
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.toast('error', 'Failed to save rule');
        this.cdr.markForCheck();
      },
    });
  }

  openTestDialog(): void {
    this.showTestDialog = true;
    this.showTestResults = false;
    this.testResults = [];
    this.testScopeError = '';
  }

  runTest(): void {
    let scope: Record<string, unknown>;
    try {
      scope = JSON.parse(this.testScope) as Record<string, unknown>;
    } catch {
      this.testScopeError = 'Invalid JSON';
      return;
    }
    this.testScopeError = '';
    this.testing = true;

    const req: ExecuteRuleRequest = {
      entityType: this.rule.entityType,
      triggerType: this.rule.triggerTypes[0] ?? 'RECORD_SAVE',
      scope,
    };

    this.ruleService.executeTest(req).subscribe({
      next: results => {
        this.testResults = results;
        this.showTestResults = true;
        this.testing = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.testing = false;
        this.toast('error', 'Test execution failed');
        this.cdr.markForCheck();
      },
    });
  }

  confirmClear(): void {
    this.showClearConfirm = true;
  }

  clearCanvas(): void {
    this.showClearConfirm = false;
    this.canvas.clearCanvas();
  }

  @HostListener('document:keydown.escape')
  closeDialogs(): void {
    if (this.showTestDialog || this.showClearConfirm) {
      this.showTestDialog = false;
      this.showClearConfirm = false;
      this.cdr.markForCheck();
    }
  }

  goBack(): void {
    void this.router.navigate(['/rules']);
  }

  dismissToast(id: number): void {
    clearTimeout(this.toastTimers.get(id));
    this.toastTimers.delete(id);
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    for (const timer of this.toastTimers.values()) clearTimeout(timer);
    this.toastTimers.clear();
  }

  private toast(severity: Toast['severity'], summary: string): void {
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, {id, severity, summary}];
    this.toastTimers.set(id, setTimeout(() => this.dismissToast(id), 3000));
    this.cdr.markForCheck();
  }
}
