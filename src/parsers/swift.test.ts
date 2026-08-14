import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { detectSwiftType, findTopLevelDeclarations } from './swift';

test('기본 타입 선언을 판별한다', () => {
  assert.equal(detectSwiftType('final class Foo { }', 'Foo'), 'class');
  assert.equal(detectSwiftType('public struct Bar { }', 'Bar'), 'struct');
  assert.equal(detectSwiftType('protocol Baz { }', 'Baz'), 'protocol');
  assert.equal(detectSwiftType('enum Qux { case a }', 'Qux'), 'enum');
  assert.equal(detectSwiftType('actor Quux { }', 'Quux'), 'actor');
});

test('중첩된 블록 주석을 끝까지 건너뛴다', () => {
  // 단순히 첫 `*/`에서 멈추면 뒤의 Fake2가 코드로 남는다.
  const src = `
/* 바깥 /* 안쪽 struct FakeOne { } */ 아직 주석 class FakeTwo { } */
protocol Real { }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'protocol', name: 'Real' }]);
});

test('raw string 안의 키워드에 속지 않는다', () => {
  const src = `
struct Real {
    let a = #"class FakeOne { }"#
    let b = ##"protocol FakeTwo { }"##
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'struct', name: 'Real' }]);
});

test('멀티라인 문자열과 보간 안의 키워드에 속지 않는다', () => {
  const src = `
class Real {
    let sql = """
        enum FakeOne { case a }
        """
    func f(_ n: String) -> String { "\\(n) struct FakeTwo { }" }
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('중첩 타입과 extension 안의 타입은 최상위로 보지 않는다', () => {
  const src = `
struct Outer {
    struct Inner { }
    enum Kind { case a }
}

extension Outer {
    struct FromExtension { }
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'struct', name: 'Outer' }]);
});

test('class func / class var 를 선언으로 오인하지 않는다', () => {
  const src = `
class Real {
    class func make() -> Real { Real() }
    class var shared: Int { 0 }
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('#if 같은 지시자를 문자열 시작으로 오인하지 않는다', () => {
  const src = `
#if DEBUG
enum Real { case a }
#endif
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'enum', name: 'Real' }]);
});

test('식별자로 쓰인 actor는 선언이 아니다', () => {
  const src = `
class Real {
    let actor = "someone"
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('최상위 타입이 여럿이면 파일명과 같은 것을 고른다', () => {
  const src = `
struct Helper { }
protocol Api { }
`;
  assert.equal(detectSwiftType(src, 'Api'), 'protocol');
  assert.equal(detectSwiftType(src, 'Unrelated'), 'struct');
});

test('타입 선언이 없는 파일은 undefined를 반환한다', () => {
  const src = `
import Foundation

func helper() -> Int { 1 }
`;
  assert.equal(detectSwiftType(src, 'Helpers'), undefined);
});
