import { TypeKind } from './types';

/**
 * 주석과 문자열 리터럴의 내용을 공백으로 치환한다.
 * 원본과 길이·줄 구조를 그대로 유지하므로, 결과 문자열의 인덱스는 원본 인덱스와 같다.
 *
 * Swift 고유의 두 가지를 처리한다.
 * 블록 주석은 중첩될 수 있어 여닫는 짝을 세어야 하고, raw string은 여는 쪽 `#`
 * 개수만큼 닫아야 한다(`#"…"#`, `##"…"##`).
 */
export function stripSwiftNonCode(src: string): string {
  const out = src.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      if (out[k] !== '\n' && out[k] !== '\r') {
        out[k] = ' ';
      }
    }
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];

    if (c === '/' && n === '/') {
      let j = i + 2;
      while (j < src.length && src[j] !== '\n') {
        j++;
      }
      blank(i, j);
      i = j;
      continue;
    }

    if (c === '/' && n === '*') {
      // Swift의 블록 주석은 중첩된다. 짝을 세어야 한다.
      let j = i + 2;
      let nesting = 1;
      while (j < src.length && nesting > 0) {
        if (src[j] === '/' && src[j + 1] === '*') {
          nesting++;
          j += 2;
        } else if (src[j] === '*' && src[j + 1] === '/') {
          nesting--;
          j += 2;
        } else {
          j++;
        }
      }
      j = Math.min(j, src.length);
      blank(i, j);
      i = j;
      continue;
    }

    if (c === '#' || c === '"') {
      let k = i;
      let hashes = 0;
      while (src[k] === '#') {
        hashes++;
        k++;
      }

      if (src[k] !== '"') {
        // `#if`, `#selector` 같은 지시자였다.
        i++;
        continue;
      }

      let quotes = 0;
      while (src[k + quotes] === '"') {
        quotes++;
      }
      const multiline = quotes >= 3;
      let end: number;

      if (hashes > 0) {
        // raw string: 이스케이프가 `\#`로 시작하므로 종료 표시만 찾으면 된다.
        const closing = (multiline ? '"""' : '"') + '#'.repeat(hashes);
        const found = src.indexOf(closing, k + (multiline ? 3 : 1));
        end = found < 0 ? src.length : found + closing.length;
      } else if (multiline) {
        let j = k + 3;
        while (j < src.length) {
          if (src[j] === '\\') {
            j += 2;
            continue;
          }
          if (src[j] === '"' && src[j + 1] === '"' && src[j + 2] === '"') {
            j += 3;
            break;
          }
          j++;
        }
        end = Math.min(j, src.length);
      } else {
        let j = k + 1;
        while (j < src.length && src[j] !== '"' && src[j] !== '\n') {
          if (src[j] === '\\') {
            j++;
          }
          j++;
        }
        end = Math.min(j + 1, src.length);
      }

      blank(i, end);
      i = end;
      continue;
    }

    i++;
  }

  return out.join('');
}

const DECL_RE = /(?<![\w$.])(class|struct|protocol|enum|actor)\s+([A-Za-z_][\w]*)/g;

const KEYWORD_TO_KIND: Record<string, TypeKind> = {
  'class': 'class',
  'struct': 'struct',
  'protocol': 'protocol',
  'enum': 'enum',
  'actor': 'actor',
};

// `class func` / `class var` 처럼 `class`가 타입 멤버 수식어로 쓰일 때
// 뒤따르는 키워드를 타입 이름으로 오인하지 않기 위한 목록.
const NOT_A_NAME = new Set(['func', 'var', 'let', 'subscript']);

interface Declaration {
  kind: TypeKind;
  name: string;
}

/**
 * 중괄호 깊이 0에 선언된 최상위 타입만 순서대로 수집한다.
 * Swift는 중첩 타입이 흔한데, 이들은 깊이가 0이 아니라 자연히 제외된다.
 * `extension` 안의 타입도 마찬가지다.
 */
export function findTopLevelDeclarations(source: string): Declaration[] {
  const src = stripSwiftNonCode(source);
  const declarations: Declaration[] = [];

  let depth = 0;
  let scanned = 0;

  for (const match of src.matchAll(DECL_RE)) {
    const start = match.index;

    // 직전 매치 이후 구간만 훑어 깊이를 갱신한다 (전체 스캔은 한 번뿐).
    for (; scanned < start; scanned++) {
      const ch = src[scanned];
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
      }
    }

    if (depth !== 0) {
      continue;
    }

    const name = match[2];
    if (NOT_A_NAME.has(name)) {
      continue;
    }

    declarations.push({ kind: KEYWORD_TO_KIND[match[1]], name });
  }

  return declarations;
}

/**
 * 파일 하나를 대표하는 타입을 판별한다.
 *
 * Swift도 파일명과 타입명이 같아야 한다는 강제는 없지만 관례가 강하므로,
 * 파일명과 같은 선언을 우선하고 없으면 첫 번째 최상위 선언을 쓴다.
 *
 * @param source Swift 소스 전문
 * @param baseName 확장자를 뺀 파일명 (예: `Foo.swift` → `Foo`)
 */
export function detectSwiftType(source: string, baseName: string): TypeKind | undefined {
  const declarations = findTopLevelDeclarations(source);
  if (declarations.length === 0) {
    return undefined;
  }
  const named = declarations.find((d) => d.name === baseName);
  return (named ?? declarations[0]).kind;
}
