import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CONFIG_SECTION, DEFAULT_BADGES, normalizeBadge, TOOLTIPS } from './badges';

test('2자 이하는 그대로 쓴다', () => {
  assert.equal(normalizeBadge('C)', 'X'), 'C)');
  assert.equal(normalizeBadge('I', 'X'), 'I');
});

test('2자를 넘으면 잘라낸다', () => {
  // VS Code가 예외를 던지므로 설정에 무엇이 들어오든 2자를 넘겨서는 안 된다.
  assert.equal(normalizeBadge('ABC', 'X'), 'AB');
  assert.equal(normalizeBadge('classification', 'X'), 'cl');
});

test('서로게이트 페어를 쪼개지 않는다', () => {
  assert.equal(normalizeBadge('🟦', 'X'), '🟦');
  assert.equal(normalizeBadge('🟦🟩', 'X'), '🟦🟩');
  assert.equal(normalizeBadge('🟦🟩🟧', 'X'), '🟦🟩');
});

test('빈 값은 배지를 붙이지 않는다는 뜻이다', () => {
  assert.equal(normalizeBadge('', 'X'), '');
  assert.equal(normalizeBadge('   ', 'X'), '');
});

test('문자열이 아닌 설정값은 기본값으로 되돌린다', () => {
  assert.equal(normalizeBadge(undefined, 'C)'), 'C)');
  assert.equal(normalizeBadge(null, 'C)'), 'C)');
  assert.equal(normalizeBadge(42, 'C)'), 'C)');
  assert.equal(normalizeBadge(['C'], 'C)'), 'C)');
});

test('앞뒤 공백은 떼어낸다', () => {
  assert.equal(normalizeBadge('  C)  ', 'X'), 'C)');
});

test('기본 배지는 모두 2자 제한을 지킨다', () => {
  for (const [language, kinds] of Object.entries(DEFAULT_BADGES)) {
    for (const [kind, badge] of Object.entries(kinds)) {
      assert.ok(
        Array.from(badge as string).length <= 2,
        `${language}.${kind} 기본 배지가 2자를 넘는다: ${badge}`,
      );
    }
  }
});

test('package.json 설정 항목이 DEFAULT_BADGES와 어긋나지 않는다', () => {
  // 설정 스키마는 정적 JSON이라 코드와 이중 관리된다. 여기서 동기화를 강제한다.
  const pkg = require('../package.json');
  const properties = pkg.contributes.configuration.properties;

  const expected = new Map<string, string>();
  for (const [language, kinds] of Object.entries(DEFAULT_BADGES)) {
    for (const [kind, badge] of Object.entries(kinds)) {
      expected.set(`${CONFIG_SECTION}.${language}.${kind}`, badge as string);
    }
  }

  assert.deepEqual(Object.keys(properties).sort(), [...expected.keys()].sort());

  for (const [key, badge] of expected) {
    assert.equal(properties[key].default, badge, `${key} 기본값이 다르다`);
    assert.equal(properties[key].maxLength, 2, `${key} 에 maxLength 2가 없다`);
  }
});

test('package.json의 nls 참조가 모두 번역돼 있다', () => {
  const pkg = require('../package.json');
  const en = require('../package.nls.json');
  const ko = require('../package.nls.ko.json');

  // package.json 전체를 훑어 "%key%" 형태의 참조를 모은다.
  const referenced = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string') {
      const matched = /^%(.+)%$/.exec(value);
      if (matched) {
        referenced.add(matched[1]);
      }
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };
  collect(pkg);

  assert.ok(referenced.size > 0, 'nls 참조를 하나도 찾지 못했다');

  for (const key of referenced) {
    assert.ok(en[key], `package.nls.json 에 ${key} 가 없다`);
  }

  assert.deepEqual(
    Object.keys(ko).sort(),
    Object.keys(en).sort(),
    '한국어 번역 키가 영어와 다르다',
  );
});

test('기본 배지에 쓰인 모든 타입에 툴팁이 있다', () => {
  for (const kinds of Object.values(DEFAULT_BADGES)) {
    for (const kind of Object.keys(kinds)) {
      assert.ok(TOOLTIPS[kind as keyof typeof TOOLTIPS], `${kind} 툴팁이 없다`);
    }
  }
});
