import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { detectJavaType } from './java';
import { detectPhpType } from './php';

// extension.ts의 HEAD_BYTES와 같은 값. 앞부분만 읽었을 때의 입력을 재현한다.
const HEAD_BYTES = 64 * 1024;

function head(source: string): string {
  return Buffer.from(source, 'utf8').subarray(0, HEAD_BYTES).toString('utf8');
}

test('선언 뒤 본문이 잘려도 Java 타입을 찾는다', () => {
  const src = `package com.example;

public class Huge {
${'    private int field = 0;\n'.repeat(5000)}}
`;
  assert.ok(Buffer.byteLength(src) > HEAD_BYTES, '테스트 입력이 앞부분보다 커야 한다');
  assert.equal(detectJavaType(head(src), 'Huge'), 'class');
});

test('잘린 지점이 블록 주석 한가운데여도 앞의 선언을 찾는다', () => {
  const src = `public class Huge {
    /* ${'x'.repeat(HEAD_BYTES)} */
}`;
  assert.equal(detectJavaType(head(src), 'Huge'), 'class');
});

test('잘린 지점이 문자열 한가운데여도 앞의 선언을 찾는다', () => {
  const src = `public class Huge {
    String s = "${'x'.repeat(HEAD_BYTES)}";
}`;
  assert.equal(detectJavaType(head(src), 'Huge'), 'class');
});

test('멀티바이트 문자가 경계에서 잘려도 앞의 선언에 영향이 없다', () => {
  const src = `public class Huge {
    String s = "${'한'.repeat(HEAD_BYTES)}";
}`;
  assert.equal(detectJavaType(head(src), 'Huge'), 'class');
});

test('잘린 지점이 heredoc 한가운데여도 앞의 PHP 선언을 찾는다', () => {
  const src = `<?php

class Huge
{
    private const SQL = <<<SQL
        ${'x'.repeat(HEAD_BYTES)}
        SQL;
}
`;
  assert.equal(detectPhpType(head(src), 'Huge'), 'class');
});

test('선언이 앞부분 밖에 있으면 못 찾는다 — 전체 재읽기가 필요한 경우', () => {
  const src = `/* ${'x'.repeat(HEAD_BYTES)} */
public class Late { }`;

  // 앞부분만으로는 판별할 수 없고,
  assert.equal(detectJavaType(head(src), 'Late'), undefined);
  // 전체를 읽으면 찾는다. extension.ts가 이 경우에만 다시 읽는다.
  assert.equal(detectJavaType(src, 'Late'), 'class');
});
