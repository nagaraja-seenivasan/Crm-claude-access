"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rule = void 0;
const tslib_1 = require("tslib");
const repository_1 = require("@loopback/repository");
let Rule = class Rule extends repository_1.Entity {
    constructor(data) {
        var _a, _b, _c, _d, _e, _f;
        super(data);
        this.name = (_a = data === null || data === void 0 ? void 0 : data.name) !== null && _a !== void 0 ? _a : '';
        this.entityType = (_b = data === null || data === void 0 ? void 0 : data.entityType) !== null && _b !== void 0 ? _b : '';
        this.isActive = (_c = data === null || data === void 0 ? void 0 : data.isActive) !== null && _c !== void 0 ? _c : false;
        this.triggerTypes = (_d = data === null || data === void 0 ? void 0 : data.triggerTypes) !== null && _d !== void 0 ? _d : [];
        this.nodes = (_e = data === null || data === void 0 ? void 0 : data.nodes) !== null && _e !== void 0 ? _e : [];
        this.connections = (_f = data === null || data === void 0 ? void 0 : data.connections) !== null && _f !== void 0 ? _f : [];
    }
};
exports.Rule = Rule;
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'string',
        id: true,
        generated: true,
        mongodb: { dataType: 'ObjectID' },
    }),
    tslib_1.__metadata("design:type", String)
], Rule.prototype, "id", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string', required: true }),
    tslib_1.__metadata("design:type", String)
], Rule.prototype, "name", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string' }),
    tslib_1.__metadata("design:type", String)
], Rule.prototype, "description", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string', required: true }),
    tslib_1.__metadata("design:type", String)
], Rule.prototype, "entityType", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'boolean', default: false }),
    tslib_1.__metadata("design:type", Boolean)
], Rule.prototype, "isActive", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'array',
        itemType: 'string',
        default: [],
    }),
    tslib_1.__metadata("design:type", Array)
], Rule.prototype, "triggerTypes", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'array',
        itemType: 'object',
        default: [],
    }),
    tslib_1.__metadata("design:type", Array)
], Rule.prototype, "nodes", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'array',
        itemType: 'object',
        default: [],
    }),
    tslib_1.__metadata("design:type", Array)
], Rule.prototype, "connections", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'date',
        defaultFn: 'now',
    }),
    tslib_1.__metadata("design:type", Date)
], Rule.prototype, "createdAt", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'date',
        defaultFn: 'now',
    }),
    tslib_1.__metadata("design:type", Date)
], Rule.prototype, "updatedAt", void 0);
exports.Rule = Rule = tslib_1.__decorate([
    (0, repository_1.model)({
        settings: {
            strict: false,
            mongodb: { collection: 'rules' },
        },
    }),
    tslib_1.__metadata("design:paramtypes", [Object])
], Rule);
//# sourceMappingURL=rule.model.js.map