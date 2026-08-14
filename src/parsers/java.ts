import { TypeKind } from './types';

/**
 * 주석 / 문자열 / 문자 / 텍스트 블록의 내용을 공백으로 치환한다.
 * 원본과 길이·줄 구조를 그대로 유지하므로, 결과 문자열의 인덱스는 원본 인덱스와 같다.
 * 이 전처리 덕분에 뒤따르는 중괄호 깊이 계산과 키워드 매칭이 리터럴에 속지 않는다.
 */
export function stripCommentsAndLiterals(src: string): string {
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
    } else if (c === '/' && n === '*') {
      let j = i + 2;
      while (j < src.length && !(src[j] === '*' && src[j + 1] === '/')) {
        j++;
      }
      j = Math.min(j + 2, src.length);
      blank(i, j);
      i = j;
    } else if (c === '"' && n === '"' && src[i + 2] === '"') {
      let j = i + 3;
      while (j < src.length && !(src[j] === '"' && src[j + 1] === '"' && src[j + 2] === '"')) {
        if (src[j] === '\\') {
          j++;
        }
        j++;
      }
      j = Math.min(j + 3, src.length);
      blank(i, j);
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          j++;
        }
        j++;
      }
      j = Math.min(j + 1, src.length);
      blank(i, j);
      i = j;
    } else {
      i++;
    }
  }

  return out.join('');
}

// 앞에 [\w$.@]가 오면 매치하지 않는다: `Foo.class` 리터럴과, `@interface`를 `interface`로 잘못
// 읽는 것을 동시에 막는다.
const DECL_RE = /(?<![\w$.@])(@interface|class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/g;

const KEYWORD_TO_KIND: Record<string, TypeKind> = {
  'class': 'class',
  'interface': 'interface',
  'enum': 'enum',
  'record': 'record',
  '@interface': 'annotation',
};

interface Declaration {
  kind: TypeKind;
  name: string;
}

/**
 * 중괄호 깊이 0에 선언된 최상위 타입만 순서대로 수집한다. 중첩 타입은 제외된다.
 */
export function findTopLevelDeclarations(source: string): Declaration[] {
  const src = stripCommentsAndLiterals(source);
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

    const keyword = match[1];
    // record는 예약어가 아닌 contextual keyword다. 실제 선언이라면 이름 뒤에 반드시
    // 제네릭 인자나 컴포넌트 목록이 온다. 그 형태가 아니면 식별자로 쓰인 것으로 본다.
    if (keyword === 'record') {
      const rest = src.slice(start + match[0].length).trimStart();
      if (!rest.startsWith('(') && !rest.startsWith('<')) {
        continue;
      }
    }

    declarations.push({ kind: KEYWORD_TO_KIND[keyword], name: match[2] });
  }

  return declarations;
}

/**
 * 파일 하나를 대표하는 타입을 판별한다.
 * Java는 public 타입의 이름이 파일명과 같아야 하므로 파일명과 일치하는 선언을 우선하고,
 * 없으면 첫 번째 최상위 선언을 쓴다.
 *
 * @param source Java 소스 전문
 * @param baseName 확장자를 뺀 파일명 (예: `Foo.java` → `Foo`)
 */
export function detectJavaType(source: string, baseName: string): TypeKind | undefined {
  const declarations = findTopLevelDeclarations(source);
  if (declarations.length === 0) {
    return undefined;
  }
  const named = declarations.find((d) => d.name === baseName);
  return (named ?? declarations[0]).kind;
}
