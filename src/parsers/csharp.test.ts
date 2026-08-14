import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { detectCSharpType, findTopLevelDeclarations } from './csharp';

test('기본 타입 선언을 판별한다', () => {
  assert.equal(detectCSharpType('public sealed class Foo { }', 'Foo'), 'class');
  assert.equal(detectCSharpType('public interface IBar { }', 'IBar'), 'interface');
  assert.equal(detectCSharpType('public struct Baz { }', 'Baz'), 'struct');
  assert.equal(detectCSharpType('public enum Qux { A, B }', 'Qux'), 'enum');
  assert.equal(detectCSharpType('public record Quux(int A);', 'Quux'), 'record');
});

test('record class / record struct 는 record로 본다', () => {
  assert.equal(detectCSharpType('public record class Foo(int A);', 'Foo'), 'record');
  assert.equal(detectCSharpType('public record struct Bar(int A);', 'Bar'), 'record');
});

test('verbatim 문자열 안의 키워드에 속지 않는다', () => {
  const src = `
class Real
{
    const string Path = @"C:\\temp\\class FakeOne { }";
    const string Quoted = @"he said ""interface FakeTwo { }""";
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('보간 문자열과 raw string 안의 키워드에 속지 않는다', () => {
  const src = `
class Real
{
    string A(string name) => $"{name} class FakeOne { }";
    const string Json = """
        { "kind": "interface FakeTwo { }" }
        """;
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Real' }]);
});

test('주석 안의 키워드에 속지 않는다', () => {
  const src = `
// class NotThis { }
/* struct AlsoNot { } */
/// <summary>enum NopeEither { }</summary>
public interface IReal { }
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'interface', name: 'IReal' }]);
});

test('블록 namespace 안의 타입도 최상위로 본다', () => {
  const src = `
namespace App.Domain
{
    public struct Point { }
}
`;
  assert.equal(detectCSharpType(src, 'Point'), 'struct');
});

test('file-scoped namespace에서도 찾는다', () => {
  const src = `
namespace App.Domain;

public enum Color { Red, Green }
`;
  assert.equal(detectCSharpType(src, 'Color'), 'enum');
});

test('제네릭 제약의 class/struct를 선언으로 오인하지 않는다', () => {
  const src = `
public class Repo<T, U>
    where T : class
    where U : struct
{
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Repo' }]);
});

test('중첩 타입은 최상위로 보지 않는다', () => {
  const src = `
public class Outer
{
    public struct Inner { }
    public enum Kind { A }
    public record Pair(int A, int B);
}
`;
  assert.deepEqual(findTopLevelDeclarations(src), [{ kind: 'class', name: 'Outer' }]);
});

test('partial class를 인식한다', () => {
  assert.equal(detectCSharpType('public partial class Foo { }', 'Foo'), 'class');
});

test('최상위 타입이 여럿이면 파일명과 같은 것을 고른다', () => {
  const src = `
internal struct Helper { }
public interface IApi { }
`;
  assert.equal(detectCSharpType(src, 'IApi'), 'interface');
  assert.equal(detectCSharpType(src, 'Unrelated'), 'struct');
});

test('타입 선언이 없는 파일은 undefined를 반환한다', () => {
  assert.equal(detectCSharpType('// 주석만 있는 파일\n', 'Empty'), undefined);
  assert.equal(detectCSharpType('using System;\nusing System.Linq;\n', 'Usings'), undefined);
});
