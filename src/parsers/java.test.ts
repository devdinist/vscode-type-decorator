import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { detectJavaType, findTopLevelDeclarations } from './java';

test('기본 타입 선언을 판별한다', () => {
  assert.equal(detectJavaType('public final class Foo { }', 'Foo'), 'class');
  assert.equal(detectJavaType('public interface Bar { }', 'Bar'), 'interface');
  assert.equal(detectJavaType('public enum Baz { A, B }', 'Baz'), 'enum');
  assert.equal(detectJavaType('public record Qux(int a) { }', 'Qux'), 'record');
  assert.equal(detectJavaType('public @interface Ann { }', 'Ann'), 'annotation');
});

test('package/import/어노테이션이 앞에 붙어도 판별한다', () => {
  const src = `
package com.example.app;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final List<String> names;
}
`;
  assert.equal(detectJavaType(src, 'OrderService'), 'class');
});

test('중첩 타입은 최상위로 보지 않는다', () => {
  const src = `
public interface Outer {
    class Inner { }
    enum Kind { A }
    record Pair(int a, int b) { }
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'interface', name: 'Outer' }]);
  assert.equal(detectJavaType(src, 'Outer'), 'interface');
});

test('주석 안의 키워드에 속지 않는다', () => {
  const src = `
// public class NotThis { }
/**
 * public enum AlsoNotThis { }
 */
/* record Nope(int a) { } */
public interface Real { }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'interface', name: 'Real' }]);
});

test('문자열·텍스트 블록 안의 키워드에 속지 않는다', () => {
  const src = `
public class Real {
    String a = "public interface Fake { }";
    char c = '{';
    String b = """
        public enum AlsoFake {
            A, B
        }
        """;
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('닫히지 않은 문자열이 있어도 무한 루프에 빠지지 않는다', () => {
  assert.equal(detectJavaType('class Foo { String s = "unterminated', 'Foo'), 'class');
});

test('클래스 리터럴을 선언으로 오인하지 않는다', () => {
  const src = `
public enum Kind {
    A;
    static final Class<?> TYPE = String.class;
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'enum', name: 'Kind' }]);
});

test('식별자로 쓰인 record는 선언이 아니다', () => {
  const src = `
public class Repo {
    void save(Entity record) {
        record.flush();
    }
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Repo' }]);
});

test('제네릭 record 선언을 인식한다', () => {
  assert.equal(detectJavaType('public record Pair<A, B>(A a, B b) { }', 'Pair'), 'record');
});

test('최상위 타입이 여럿이면 파일명과 같은 것을 고른다', () => {
  const src = `
class Helper { }
public interface Api { }
`;
  assert.equal(detectJavaType(src, 'Api'), 'interface');
  // 파일명과 일치하는 선언이 없으면 첫 번째를 쓴다.
  assert.equal(detectJavaType(src, 'Unrelated'), 'class');
});

test('타입 선언이 없는 파일은 undefined를 반환한다', () => {
  assert.equal(detectJavaType('package com.example;\n', 'package-info'), undefined);
  assert.equal(detectJavaType('module com.example.app { requires java.base; }', 'module-info'), undefined);
});
