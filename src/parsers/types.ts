/**
 * 배지로 구분하는 타입 종류. 언어별 파서가 공유한다.
 *
 * 모든 언어가 전부를 쓰지는 않는다.
 * `record`/`annotation`은 Java, `trait`은 PHP, `protocol`/`actor`는 Swift,
 * `struct`는 C#과 Swift가 쓴다.
 */
export type TypeKind =
  | 'class'
  | 'interface'
  | 'enum'
  | 'record'
  | 'annotation'
  | 'trait'
  | 'struct'
  | 'protocol'
  | 'actor';
