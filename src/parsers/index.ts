import { detectCSharpType } from './csharp';
import { detectJavaType } from './java';
import { detectPhpType } from './php';
import { detectSwiftType } from './swift';
import { TypeKind } from './types';

export type { TypeKind };

export type ParseFn = (source: string, baseName: string) => TypeKind | undefined;

export interface LanguageParser {
  /** 배지 설정을 찾을 때 쓰는 언어 키. 확장자와 다를 수 있다 (`.cs` → `csharp`). */
  language: string;
  parse: ParseFn;
}

const BY_EXTENSION: Record<string, LanguageParser> = {
  java: { language: 'java', parse: detectJavaType },
  php: { language: 'php', parse: detectPhpType },
  cs: { language: 'csharp', parse: detectCSharpType },
  swift: { language: 'swift', parse: detectSwiftType },
};

/** FileSystemWatcher와 activationEvents가 쓰는 감시 대상. 지원 확장자 목록에서 만든다. */
export const WATCH_GLOB = `**/*.{${Object.keys(BY_EXTENSION).join(',')}}`;

/** 파일명에 맞는 파서를 돌려준다. 지원하지 않는 확장자면 undefined. */
export function parserFor(fileName: string): LanguageParser | undefined {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) {
    return undefined;
  }
  return BY_EXTENSION[fileName.slice(dot + 1).toLowerCase()];
}

/** 확장자를 뺀 파일명. 파서가 파일명과 같은 이름의 선언을 우선할 때 쓴다. */
export function baseNameOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? fileName : fileName.slice(0, dot);
}
