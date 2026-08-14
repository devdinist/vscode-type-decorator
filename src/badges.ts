import { TypeKind } from './parsers';

export const CONFIG_SECTION = 'typeDeco';

export type BadgeTable = Record<string, Partial<Record<TypeKind, string>>>;

/**
 * 언어별로 지원하는 타입과 그 기본 배지.
 * package.json의 `contributes.configuration` 기본값과 짝을 맞춰야 한다.
 */
export const DEFAULT_BADGES: BadgeTable = {
  java: {
    class: 'C)',
    interface: 'I)',
    enum: 'E)',
    record: 'R)',
    annotation: '@)',
  },
  php: {
    class: 'C)',
    interface: 'I)',
    enum: 'E)',
    trait: 'T)',
  },
  csharp: {
    class: 'C)',
    interface: 'I)',
    struct: 'S)',
    enum: 'E)',
    record: 'R)',
  },
  swift: {
    class: 'C)',
    struct: 'S)',
    protocol: 'P)',
    enum: 'E)',
    actor: 'A)',
  },
};

/** 배지에 마우스를 올렸을 때 보이는 설명. 설정과 무관하게 고정이다. */
export const TOOLTIPS: Record<TypeKind, string> = {
  class: 'Class',
  interface: 'Interface',
  enum: 'Enum',
  record: 'Record',
  annotation: 'Annotation',
  trait: 'Trait',
  struct: 'Struct',
  protocol: 'Protocol',
  actor: 'Actor',
};

/**
 * 설정값을 배지로 쓸 수 있는 형태로 다듬는다.
 *
 * VS Code는 배지가 2글자를 넘으면 FileDecoration을 만드는 단계에서 예외를 던진다.
 * 설정 스키마의 maxLength는 설정 UI의 경고일 뿐 settings.json 직접 편집을 막지 못하므로
 * 여기서 다시 자른다. 서로게이트 페어가 쪼개지지 않도록 코드포인트 단위로 센다.
 *
 * @returns 빈 문자열이면 해당 타입에 배지를 붙이지 않는다는 뜻이다.
 */
export function normalizeBadge(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return Array.from(trimmed).slice(0, 2).join('');
}
