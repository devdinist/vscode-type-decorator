import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { LruCache } from './lruCache';

test('한도를 넘으면 가장 오래된 항목을 버린다', () => {
  const cache = new LruCache<number>(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  cache.set('d', 4);

  assert.equal(cache.size, 3);
  assert.equal(cache.has('a'), false);
  assert.deepEqual(cache.keys(), ['b', 'c', 'd']);
});

test('조회한 항목은 최근 사용으로 올라가 축출을 피한다', () => {
  const cache = new LruCache<number>(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);

  cache.get('a'); // a를 다시 씀 → 이제 b가 가장 오래됐다
  cache.set('d', 4);

  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('b'), false);
});

test('덮어써도 항목 수가 늘지 않는다', () => {
  const cache = new LruCache<number>(2);
  cache.set('a', 1);
  cache.set('a', 2);

  assert.equal(cache.size, 1);
  assert.equal(cache.get('a'), 2);
});

test('undefined 값도 저장하며 has()로 미적중과 구분한다', () => {
  const cache = new LruCache<string | undefined>(2);
  cache.set('a', undefined);

  assert.equal(cache.has('a'), true);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.has('b'), false);
});

test('delete로 항목을 지운다', () => {
  const cache = new LruCache<number>(2);
  cache.set('a', 1);
  cache.delete('a');

  assert.equal(cache.has('a'), false);
  assert.equal(cache.size, 0);
});

test('한도가 1이어도 동작한다', () => {
  const cache = new LruCache<number>(1);
  cache.set('a', 1);
  cache.set('b', 2);

  assert.deepEqual(cache.keys(), ['b']);
});

test('한도가 1 미만이면 만들 수 없다', () => {
  assert.throws(() => new LruCache<number>(0));
});
