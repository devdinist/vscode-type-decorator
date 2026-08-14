import { neutralizeNamespaceBraces } from './braces';
import { TypeKind } from './types';

const HEREDOC_OPEN = /^<<<[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/;

/**
 * PHP 태그 밖의 텍스트, 주석, 문자열 리터럴, heredoc/nowdoc의 내용을 공백으로 치환한다.
 * 원본과 길이·줄 구조를 그대로 유지하므로, 결과 문자열의 인덱스는 원본 인덱스와 같다.
 */
export function stripPhpNonCode(src: string): string {
  const out = src.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      if (out[k] !== '\n' && out[k] !== '\r') {
        out[k] = ' ';
      }
    }
  };

  let i = 0;
  let inPhp = false;

  while (i < src.length) {
    if (!inPhp) {
      // 여는 태그를 만나기 전까지는 전부 템플릿 텍스트다.
      const open = src.indexOf('<?', i);
      if (open < 0) {
        blank(i, src.length);
        break;
      }
      blank(i, open + 2);
      i = open + 2;
      // `<?php` / `<?=` 의 남은 글자가 식별자로 읽히지 않도록 함께 지운다.
      if (src.slice(i, i + 3).toLowerCase() === 'php') {
        blank(i, i + 3);
        i += 3;
      } else if (src[i] === '=') {
        blank(i, i + 1);
        i += 1;
      }
      inPhp = true;
      continue;
    }

    const c = src[i];
    const n = src[i + 1];

    if (c === '?' && n === '>') {
      blank(i, i + 2);
      i += 2;
      inPhp = false;
    } else if ((c === '/' && n === '/') || (c === '#' && n !== '[')) {
      // `#[` 는 주석이 아니라 PHP 8 어트리뷰트이므로 코드로 남겨둔다.
      let j = i + 1;
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
    } else if (c === '<' && n === '<' && src[i + 2] === '<') {
      const opening = HEREDOC_OPEN.exec(src.slice(i));
      if (!opening) {
        i++;
        continue;
      }
      // 종료 식별자는 여는 쪽에서 정해지고 줄 시작에 다시 나온다 (PHP 7.3+ 들여쓰기 허용).
      const endRe = new RegExp(`^[ \\t]*${opening[2]}(?![A-Za-z0-9_])`);
      let j = i + opening[0].length;
      let end = src.length;
      while (j < src.length) {
        const newline = src.indexOf('\n', j);
        const lineEnd = newline < 0 ? src.length : newline;
        const closing = endRe.exec(src.slice(j, lineEnd));
        if (closing) {
          end = j + closing[0].length;
          break;
        }
        if (newline < 0) {
          break;
        }
        j = newline + 1;
      }
      blank(i, end);
      i = end;
    } else if (c === '"' || c === "'") {
      // PHP 문자열은 개행을 포함할 수 있어 줄 끝에서 끊지 않는다.
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
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

// PHP 키워드는 대소문자를 가리지 않는다. 앞에 [\w$\\]가 오면 매치하지 않아
// 변수(`$enum`)와 네임스페이스 구분자 뒤(`Foo\class`)를 걸러낸다.
const DECL_RE =
  /(?<![\w$\\])(class|interface|trait|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/gi;

const KEYWORD_TO_KIND: Record<string, TypeKind> = {
  'class': 'class',
  'interface': 'interface',
  'trait': 'trait',
  'enum': 'enum',
};

// `new class extends Base {}` 처럼 이름 없는 익명 클래스에서 뒤따르는 키워드를
// 이름으로 오인하지 않기 위한 목록.
const NOT_A_NAME = new Set(['extends', 'implements']);

interface Declaration {
  kind: TypeKind;
  name: string;
}

/**
 * 중괄호 깊이 0에 선언된 최상위 타입만 순서대로 수집한다.
 */
export function findTopLevelDeclarations(source: string): Declaration[] {
  const src = neutralizeNamespaceBraces(stripPhpNonCode(source));
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

    const keyword = match[1].toLowerCase();
    const name = match[2];

    if (NOT_A_NAME.has(name.toLowerCase())) {
      continue;
    }

    // enum은 PHP 8.1에서 추가된 contextual keyword다. 실제 선언이라면 이름 뒤에
    // 본문이나 backing type, implements 절이 온다.
    if (keyword === 'enum') {
      const rest = src.slice(start + match[0].length).trimStart();
      if (!rest.startsWith('{') && !rest.startsWith(':') && !/^implements\b/i.test(rest)) {
        continue;
      }
    }

    declarations.push({ kind: KEYWORD_TO_KIND[keyword], name });
  }

  return declarations;
}

/**
 * 파일 하나를 대표하는 타입을 판별한다.
 *
 * PHP는 Java와 달리 타입 이름과 파일명이 같아야 한다는 언어 차원의 강제가 없다.
 * PSR-4를 따르는 코드베이스에서는 대개 일치하므로 이름이 같은 선언을 우선하고,
 * 없으면 첫 번째 최상위 선언을 쓴다.
 *
 * @param source PHP 소스 전문
 * @param baseName 확장자를 뺀 파일명 (예: `Foo.php` → `Foo`)
 */
export function detectPhpType(source: string, baseName: string): TypeKind | undefined {
  const declarations = findTopLevelDeclarations(source);
  if (declarations.length === 0) {
    return undefined;
  }
  const named = declarations.find((d) => d.name === baseName);
  return (named ?? declarations[0]).kind;
}
