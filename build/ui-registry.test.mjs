import test from 'node:test';
import assert from 'node:assert/strict';
import {createComponentRegistry} from '../packages/ui-kit/component-registry.ts';

const component = {render: () => null};
test('UI registrations have owner namespaces, unique IDs and declared versions', () => {
  const registry = createComponentRegistry(component);
  const scope = registry.createScope('sample.ui');
  scope.register({id: 'sample.ui.panel', version: '1.0.0', component});
  assert.throws(() => scope.register({id: 'sample.ui.panel', version: '1.0.0', component}), /冲突/);
  assert.throws(() => scope.register({id: 'another.ui.panel', version: '1.0.0', component}), /命名空间/);
  assert.throws(() => scope.register({id: 'sample.ui.input', version: 'latest', component}), /版本/);
  assert.throws(() => registry.createScope('sample.ui'), /重复/);
  assert.deepEqual(registry.list(), [{id: 'sample.ui.panel', version: '1.0.0', owner: 'sample.ui'}]);
});

test('UI scope disposal revokes only its registrations and is idempotent', () => {
  const registry = createComponentRegistry(component);
  const first = registry.createScope('sample.one'), second = registry.createScope('sample.two');
  first.register({id: 'sample.one.panel', version: '1.0.0', component});
  second.register({id: 'sample.two.panel', version: '1.0.0', component});
  first.dispose(); first.dispose();
  assert.deepEqual(registry.list().map(item => item.id), ['sample.two.panel']);
  assert.throws(() => first.register({id: 'sample.one.again', version: '1.0.0', component}), /已销毁/);
  assert.throws(() => second.create('sample.one.panel', null), /未注册/);
  registry.createScope('sample.one').register({id: 'sample.one.panel', version: '2.0.0', component});
  assert.equal(registry.list().length, 2);
});
