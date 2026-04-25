import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  RuleNode,
  NodeType,
  TriggerNodeData,
  ConditionNodeData,
  ConditionClause,
  ConditionOperator,
  SetValueNodeData,
  ValueAssignment,
  NotificationNodeData,
  NotificationChannel,
  EntityField,
  NotificationTemplate,
  OPERATOR_LABELS,
} from '../../models/rule.models';
import {v4 as uuidv4} from 'uuid';

type SelectItem = {label: string; value: string};

@Component({
  selector: 'app-node-properties',
  templateUrl: './node-properties.component.html',
  styleUrls: ['./node-properties.component.scss'],
})
export class NodePropertiesComponent implements OnChanges {
  @Input() node!: RuleNode;
  @Input() entityFields: EntityField[] = [];
  @Input() notificationTemplates: NotificationTemplate[] = [];
  @Output() nodeChanged = new EventEmitter<RuleNode>();

  nodeType: NodeType = 'trigger';

  // Typed data accessors
  triggerData!: TriggerNodeData;
  conditionData!: ConditionNodeData;
  setValueData!: SetValueNodeData;
  notificationData!: NotificationNodeData;

  readonly triggerTypeOptions: SelectItem[] = [
    {label: 'SQS Trigger', value: 'SQS'},
    {label: 'Record Save', value: 'RECORD_SAVE'},
  ];

  readonly entityTypeOptions: SelectItem[] = [
    {label: 'Lead', value: 'Lead'},
    {label: 'Deal', value: 'Deal'},
    {label: 'Contact', value: 'Contact'},
    {label: 'Account', value: 'Account'},
  ];

  readonly operatorOptions: SelectItem[] = (
    Object.entries(OPERATOR_LABELS) as [ConditionOperator, string][]
  ).map(([value, label]) => ({label, value}));

  readonly channelOptions: SelectItem[] = [
    {label: 'Email', value: 'EMAIL'},
    {label: 'SMS', value: 'SMS'},
    {label: 'Push Notification', value: 'PUSH'},
    {label: 'Webhook', value: 'WEBHOOK'},
  ];

  readonly logicalOperatorOptions: SelectItem[] = [
    {label: 'AND — all must match', value: 'AND'},
    {label: 'OR — any must match', value: 'OR'},
  ];

  get fieldOptions(): SelectItem[] {
    return this.entityFields.map(f => ({label: f.label, value: f.value}));
  }

  get templateOptions(): SelectItem[] {
    return this.notificationTemplates.map(t => ({
      label: `${t.name} (${t.channel})`,
      value: t.id,
    }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['node'] && this.node) {
      this.nodeType = this.node.type;
      this.syncData();
    }
  }

  private syncData(): void {
    switch (this.nodeType) {
      case 'trigger':
        this.triggerData = {...(this.node.data as TriggerNodeData)};
        break;
      case 'condition':
        this.conditionData = {
          ...(this.node.data as ConditionNodeData),
          conditions: [...((this.node.data as ConditionNodeData).conditions ?? [])],
        };
        break;
      case 'set-value':
        this.setValueData = {
          ...(this.node.data as SetValueNodeData),
          assignments: [...((this.node.data as SetValueNodeData).assignments ?? [])],
        };
        break;
      case 'notification':
        this.notificationData = {
          ...(this.node.data as NotificationNodeData),
          additionalRecipients: [
            ...((this.node.data as NotificationNodeData).additionalRecipients ?? []),
          ],
        };
        break;
    }
  }

  // ── Trigger ───────────────────────────────────────────────────────────────

  onTriggerChange(): void {
    this.emitUpdate({...this.node, data: {...this.triggerData}});
  }

  // ── Condition ─────────────────────────────────────────────────────────────

  onConditionChange(): void {
    this.emitUpdate({...this.node, data: {...this.conditionData}});
  }

  addClause(): void {
    if (!this.conditionData.conditions) this.conditionData.conditions = [];
    this.conditionData.conditions = [
      ...this.conditionData.conditions,
      {field: '', operator: 'equals', value: ''},
    ];
    this.onConditionChange();
  }

  removeClause(index: number): void {
    this.conditionData.conditions = (this.conditionData.conditions ?? []).filter(
      (_, i) => i !== index,
    );
    this.onConditionChange();
  }

  updateClause(index: number, clause: ConditionClause): void {
    const clauses = [...(this.conditionData.conditions ?? [])];
    clauses[index] = clause;
    this.conditionData.conditions = clauses;
    this.onConditionChange();
  }

  // ── Set Value ─────────────────────────────────────────────────────────────

  onSetValueChange(): void {
    this.emitUpdate({...this.node, data: {...this.setValueData}});
  }

  addAssignment(): void {
    const a: ValueAssignment & {_id: string} = {
      _id: uuidv4(),
      targetField: '',
      value: '',
      isExpression: false,
    };
    this.setValueData.assignments = [...this.setValueData.assignments, a];
    this.onSetValueChange();
  }

  removeAssignment(index: number): void {
    this.setValueData.assignments = this.setValueData.assignments.filter(
      (_, i) => i !== index,
    );
    this.onSetValueChange();
  }

  // ── Notification ──────────────────────────────────────────────────────────

  onNotificationChange(): void {
    this.emitUpdate({...this.node, data: {...this.notificationData}});
  }

  addRecipient(): void {
    if (!this.notificationData.additionalRecipients) {
      this.notificationData.additionalRecipients = [];
    }
    this.notificationData.additionalRecipients = [
      ...this.notificationData.additionalRecipients,
      '',
    ];
  }

  removeRecipient(index: number): void {
    this.notificationData.additionalRecipients = (
      this.notificationData.additionalRecipients ?? []
    ).filter((_, i) => i !== index);
    this.onNotificationChange();
  }

  updateRecipient(index: number, value: string): void {
    const arr = [...(this.notificationData.additionalRecipients ?? [])];
    arr[index] = value;
    this.notificationData.additionalRecipients = arr;
    this.onNotificationChange();
  }

  onLabelChange(label: string): void {
    this.emitUpdate({...this.node, label});
  }

  private emitUpdate(node: RuleNode): void {
    this.nodeChanged.emit(node);
  }

  operatorNeedsValue(op: ConditionOperator): boolean {
    return op !== 'is_null' && op !== 'is_not_null';
  }

  channelLabel(channel: NotificationChannel): string {
    return this.channelOptions.find(o => o.value === channel)?.label ?? channel;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
