import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { detectPhpType, findTopLevelDeclarations } from './php';

test('기본 타입 선언을 판별한다', () => {
  assert.equal(detectPhpType('<?php\nfinal class Foo { }', 'Foo'), 'class');
  assert.equal(detectPhpType('<?php\ninterface Bar { }', 'Bar'), 'interface');
  assert.equal(detectPhpType('<?php\ntrait Baz { }', 'Baz'), 'trait');
  assert.equal(detectPhpType('<?php\nenum Qux { case A; }', 'Qux'), 'enum');
});

test('backed enum과 implements 절을 인식한다', () => {
  assert.equal(detectPhpType('<?php\nenum Status: string { case A = "a"; }', 'Status'), 'enum');
  assert.equal(detectPhpType('<?php\nenum Suit implements HasColor { }', 'Suit'), 'enum');
});

test('식별자로 쓰인 enum은 선언이 아니다', () => {
  const src = `<?php
class Repo {
    public function save($enum) {
        return enum_exists($enum);
    }
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Repo' }]);
});

test('어트리뷰트 #[...] 는 주석이 아니다', () => {
  const src = `<?php
#[Attribute(Attribute::TARGET_CLASS)]
final class Route { }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Route' }]);
});

test('# 주석과 // 주석, 블록 주석 안의 키워드에 속지 않는다', () => {
  const src = `<?php
# class NotThis { }
// interface AlsoNotThis { }
/**
 * trait NopeEither { }
 */
enum Real { case A; }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'enum', name: 'Real' }]);
});

test('heredoc / nowdoc 안의 키워드에 속지 않는다', () => {
  const src = `<?php
$a = <<<SQL
class FakeOne { }
SQL;

$b = <<<'TXT'
    interface FakeTwo { }
    TXT;

class Real { }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('문자열 안의 키워드에 속지 않는다 (개행 포함)', () => {
  const src = `<?php
$a = "line1
class FakeOne { }
line3";
$b = 'trait FakeTwo { }';
class Real { }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('익명 클래스의 뒤따르는 키워드를 이름으로 오인하지 않는다', () => {
  const src = `<?php
$logger = new class extends NullLogger { };
$other = new class implements Countable { };
class Real { }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('::class 상수를 선언으로 오인하지 않는다', () => {
  const src = `<?php
class Real {
    public const MAP = [Other::class => 1];
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('namespace 세미콜론 문법에서 최상위를 찾는다', () => {
  const src = `<?php
namespace App\\Domain;

interface Repo { }
`;
  assert.equal(detectPhpType(src, 'Repo'), 'interface');
});

test('namespace 중괄호 문법에서도 최상위를 찾는다', () => {
  const src = `<?php
namespace App\\Domain {
    interface Repo { }
}
`;
  assert.equal(detectPhpType(src, 'Repo'), 'interface');
});

test('PHP 태그 밖의 템플릿 텍스트는 무시한다', () => {
  const src = `<h1>class FakeOne { }</h1>
<?php
class Real { }
?>
<div>interface FakeTwo { }</div>
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('키워드의 대소문자를 가리지 않는다', () => {
  assert.equal(detectPhpType('<?php\nClass Foo { }', 'Foo'), 'class');
  assert.equal(detectPhpType('<?php\nINTERFACE Bar { }', 'Bar'), 'interface');
});

test('메서드 안에 선언된 타입은 최상위로 보지 않는다', () => {
  const src = `<?php
class Outer {
    public function make() {
        if (!class_exists('Inner')) {
            class Inner { }
        }
    }
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Outer' }]);
});

test('최상위 타입이 여럿이면 파일명과 같은 것을 고른다', () => {
  const src = `<?php
trait Helper { }
interface Api { }
`;
  assert.equal(detectPhpType(src, 'Api'), 'interface');
  assert.equal(detectPhpType(src, 'Unrelated'), 'trait');
});

test('타입 선언이 없는 파일은 undefined를 반환한다', () => {
  assert.equal(detectPhpType('<?php\nfunction helper() { return 1; }', 'helpers'), undefined);
  assert.equal(detectPhpType('<h1>plain html</h1>', 'index'), undefined);
});
