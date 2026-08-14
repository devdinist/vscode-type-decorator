import { neutralizeNamespaceBraces } from './braces';
import { TypeKind } from './types';

/**
 * i 위치에서 시작하는 문자열 리터럴의 접두사를 읽는다.
 *
 * C#의 문자열은 접두사 조합으로 성격이 달라진다.
 * `@"…"`는 verbatim(백슬래시가 이스케이프가 아니고 `""`가 따옴표, 개행 허용),
 * `$"…"`는 보간, `$@"…"`/`@$"…"`는 둘의 조합, `"""…"""`는 raw string이다.
 */
function readStringOpening(
  src: string,
  i: number,
): { quote: number; quotes: number; verbatim: boolean } | undefined {
  let k = i;
  let verbatim = false;

  while (src[k] === '$' || src[k] === '@') {
    if (src[k] === '@') {
      verbatim = true;
    }
    k++;
  }

  if (src[k] !== '"') {
    return undefined;
  }

  let quotes = 0;
  while (src[k + quotes] === '"') {
    quotes++;
  }

  return { quote: k, quotes, verbatim };
}

/**
 * 주석과 문자열 리터럴의 내용을 공백으로 치환한다.
 * 원본과 길이·줄 구조를 그대로 유지하므로, 결과 문자열의 인덱스는 원본 인덱스와 같다.
 */
export function stripCSharpNonCode(src: string): string {
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
      let j = i + 2;
      while (j < src.length && !(src[j] === '*' && src[j + 1] === '/')) {
        j++;
      }
      j = Math.min(j + 2, src.length);
      blank(i, j);
      i = j;
      continue;
    }

    if (c === '"' || c === '@' || c === '$') {
      const opening = readStringOpening(src, i);
      if (opening === undefined) {
        // `@identifier` 처럼 문자열이 아닌 `@`/`$` 였다.
        i++;
        continue;
      }

      const { quote, quotes, verbatim } = opening;
      let end: number;

      if (quotes >= 3) {
        // raw string: 여는 따옴표와 같은 개수로 닫는다. 이스케이프가 없다.
        const closing = '"'.repeat(quotes);
        const found = src.indexOf(closing, quote + quotes);
        end = found < 0 ? src.length : found + quotes;
      } else if (verbatim) {
        // `""` 는 이스케이프된 따옴표이고, 개행을 포함할 수 있다.
        let j = quote + 1;
        while (j < src.length) {
          if (src[j] === '"') {
            if (src[j + 1] === '"') {
              j += 2;
              continue;
            }
            j++;
            break;
          }
          j++;
        }
        end = Math.min(j, src.length);
      } else {
        let j = quote + 1;
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

    if (c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== "'" && src[j] !== '\n') {
        if (src[j] === '\\') {
          j++;
        }
        j++;
      }
      j = Math.min(j + 1, src.length);
      blank(i, j);
      i = j;
      continue;
    }

    i++;
  }

  return out.join('');
}

// `record class` / `record struct`(C# 10)를 한 덩어리로 잡는다. 앞에 [\w$.@]가 오면
// 매치하지 않아 `@class` 같은 예약어 이스케이프 식별자를 걸러낸다.
const DECL_RE =
  /(?<![\w$.@])(class|interface|struct|enum|record(?:\s+(?:class|struct))?)\s+([A-Za-z_][\w]*)/g;

const KEYWORD_TO_KIND: Record<string, TypeKind> = {
  'class': 'class',
  'interface': 'interface',
  'struct': 'struct',
  'enum': 'enum',
  'record': 'record',
};

// 제네릭 제약 `where T : class where U : IFoo` 에서 뒤따르는 `where`를
// 타입 이름으로 오인하지 않기 위한 목록.
const NOT_A_NAME = new Set(['where']);

interface Declaration {
  kind: TypeKind;
  name: string;
}

/**
 * 중괄호 깊이 0에 선언된 최상위 타입만 순서대로 수집한다.
 * 블록 형태 `namespace Foo { ... }` 안의 타입도 최상위로 본다.
 */
export function findTopLevelDeclarations(source: string): Declaration[] {
  const src = neutralizeNamespaceBraces(stripCSharpNonCode(source));
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

    // `record struct Foo` 처럼 두 단어인 경우 앞 단어가 종류를 정한다.
    const keyword = match[1].split(/\s+/)[0];
    declarations.push({ kind: KEYWORD_TO_KIND[keyword], name });
  }

  return declarations;
}

/**
 * 파일 하나를 대표하는 타입을 판별한다.
 *
 * C#은 파일명과 타입명이 같아야 한다는 강제가 없지만 관례가 강하므로,
 * 파일명과 같은 선언을 우선하고 없으면 첫 번째 최상위 선언을 쓴다.
 *
 * @param source C# 소스 전문
 * @param baseName 확장자를 뺀 파일명 (예: `Foo.cs` → `Foo`)
 */
export function detectCSharpType(source: string, baseName: string): TypeKind | undefined {
  const declarations = findTopLevelDeclarations(source);
  if (declarations.length === 0) {
    return undefined;
  }
  const named = declarations.find((d) => d.name === baseName);
  return (named ?? declarations[0]).kind;
}
