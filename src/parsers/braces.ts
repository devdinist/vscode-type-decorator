/**
 * `namespace Foo { ... }` 블록의 여닫는 중괄호를 지운다.
 * 블록 안의 타입도 최상위로 세어지게 하기 위한 것으로, PHP와 C#이 함께 쓴다.
 * 세미콜론 형태(PHP의 `namespace Foo;`, C# 10의 file-scoped namespace)는
 * 애초에 중괄호가 없어 대상이 아니다.
 *
 * 주석과 문자열이 이미 지워진 소스를 받는다고 가정한다.
 */
export function neutralizeNamespaceBraces(src: string): string {
  const out = src.split('');

  for (const match of src.matchAll(/(?<![\w$\\.])namespace\b[^{;]*\{/gi)) {
    const open = match.index + match[0].length - 1;

    let depth = 0;
    for (let k = open; k < src.length; k++) {
      if (src[k] === '{') {
        depth++;
      } else if (src[k] === '}') {
        depth--;
        if (depth === 0) {
          out[k] = ' ';
          break;
        }
      }
    }

    out[open] = ' ';
  }

  return out.join('');
}
