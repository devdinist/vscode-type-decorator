# Type Decorations

VS Code Explorer에서 소스 파일의 최상위 타입을 배지로 구분해 표시하는 확장입니다.
Java, C#, PHP, Swift를 지원합니다.

English documentation: [README.md](README.md)

| 타입 | 배지 | Java | C# | PHP | Swift |
| --- | --- | --- | --- | --- | --- |
| `class` | `C)` | ✓ | ✓ | ✓ | ✓ |
| `interface` | `I)` | ✓ | ✓ | ✓ | |
| `enum` | `E)` | ✓ | ✓ | ✓ | ✓ |
| `struct` | `S)` | | ✓ | | ✓ |
| `record` | `R)` | ✓ | ✓ | | |
| `protocol` | `P)` | | | | ✓ |
| `actor` | `A)` | | | | ✓ |
| `trait` | `T)` | | | ✓ | |
| `@interface` (annotation) | `@)` | ✓ | | | |

타입 선언이 없는 파일(`package-info.java`, 템플릿 `.php`, using 목록만 있는 `.cs` 등)에는
배지가 붙지 않습니다.

## 배지 커스터마이징

설정 UI나 `settings.json`에서 언어별·타입별로 배지를 바꿀 수 있습니다.

```json
"typeDeco.java.class": "C",
"typeDeco.csharp.struct": "St",
"typeDeco.swift.actor": "A",
"typeDeco.php.enum": ""
```

- **최대 2자**까지만 표시됩니다. VS Code는 그보다 긴 배지를 만나면 데코레이션을 만드는
  단계에서 예외를 던지므로, 설정에 더 긴 값이 들어와도 2자로 잘라 씁니다.
- **비워 두면** 그 타입에는 배지를 붙이지 않습니다. 위 예처럼 PHP `enum`만 끄는 식으로 쓸 수 있습니다.
- 설정을 바꾸면 곧바로 반영됩니다. 타입 판별 결과는 설정과 무관하므로 파일을 다시 읽지 않습니다.

설정 키의 언어 부분은 확장자가 아니라 언어 이름입니다 — `.cs` 파일은 `typeDeco.csharp.*`를 씁니다.

## git 데코레이션과의 공존

파일 하나의 최종 색상은 모든 데코레이션 제공자를 통틀어 **하나만** 결정됩니다. 이 확장이
색상을 지정하면 그 자리를 git 데코레이션과 경합해 빼앗게 되고, 파일의 변경 상태를 색으로
읽을 수 없게 됩니다. 그래서 이 확장은 배지만 붙이고 색상은 지정하지 않습니다.

배지 글자는 색상과 달리 경합하지 않고 `, `로 이어붙습니다. 변경된 class 파일이라면
git의 `M`과 이 확장의 `C)`가 합쳐져 `M, C)`로 표시됩니다.

## 동작 방식

타입 판별은 정규식 파싱으로 합니다. 언어 서버(Extension Pack for Java, C# Dev Kit,
Intelephense 등)에 의존하지 않으므로 확장 설치 여부나 프로젝트 인덱싱 상태와 무관하게
동작합니다.

모든 언어가 같은 3단계를 거칩니다.

1. 코드가 아닌 영역의 내용을 공백으로 치환합니다. 길이를 그대로 유지하므로 이후 인덱스
   계산이 원본과 어긋나지 않습니다.
2. 중괄호 깊이가 0인 위치의 타입 선언만 수집합니다. 중첩 타입은 제외됩니다.
3. 파일명과 이름이 같은 선언을 우선 선택하고, 없으면 첫 번째 최상위 선언을 씁니다.

언어마다 다른 것은 1단계에서 무엇을 지우느냐와, 어떤 키워드가 contextual이냐입니다.

### Java (`src/parsers/java.ts`)

주석 / 문자열 / 문자 리터럴 / 텍스트 블록(`"""`)을 지웁니다.

`record`는 예약어가 아닌 contextual keyword이므로, 이름 뒤에 컴포넌트 목록 `(` 또는
제네릭 인자 `<`가 오는 경우에만 선언으로 인정합니다.

### C# (`src/parsers/csharp.ts`)

C#은 문자열 형태가 여럿이고 각각 이스케이프 규칙이 달라 접두사를 먼저 읽고 갈라 처리합니다.

- `@"…"` verbatim — 백슬래시가 이스케이프가 아니고 `""`가 따옴표이며 개행을 포함합니다
- `$"…"` 보간, `$@"…"` / `@$"…"` 둘의 조합
- `"""…"""` raw string — 여는 따옴표 개수만큼 닫아야 합니다

그 밖의 처리:

- `record class` / `record struct`(C# 10)를 한 덩어리로 잡아 `record`로 분류합니다.
- 제네릭 제약 `where T : class where U : IFoo`에서 뒤따르는 `where`를 타입 이름으로
  오인하지 않습니다.
- `@class` 같은 예약어 이스케이프 식별자를 선언으로 보지 않습니다.
- 블록 형태 `namespace Foo { ... }`는 여닫는 중괄호를 지워 안쪽 타입도 최상위로 셉니다.
  file-scoped namespace(`namespace Foo;`)는 애초에 중괄호가 없어 그대로 동작합니다.

### PHP (`src/parsers/php.ts`)

PHP는 코드가 아닌 영역이 더 넓습니다.

- `<?php` / `<?=` 태그 **밖**의 템플릿 텍스트
- `//`, `/* */`, 그리고 `#` 주석 — 단 `#[`는 PHP 8 어트리뷰트이므로 코드로 남깁니다
- 작은따옴표 / 큰따옴표 문자열 (PHP 문자열은 개행을 포함할 수 있어 줄 끝에서 끊지 않습니다)
- heredoc / nowdoc — 여는 쪽에서 정해진 종료 식별자를 추적합니다

그 밖의 처리:

- 키워드 대소문자를 가리지 않습니다 (`Class Foo`도 인식).
- `enum`은 PHP 8.1의 contextual keyword이므로, 이름 뒤에 본문 `{`, backing type `:`,
  또는 `implements`가 오는 경우에만 선언으로 인정합니다.
- `new class extends Base {}` 같은 익명 클래스에서 `extends` / `implements`를 이름으로
  오인하지 않습니다.
- `namespace Foo { ... }` 중괄호 문법은 C#과 같은 방식으로 처리합니다.

### Swift (`src/parsers/swift.ts`)

Swift 고유의 두 가지가 핵심입니다.

- **블록 주석이 중첩됩니다.** 여닫는 짝을 세지 않고 첫 번째 종료 표시에서 멈추면 그 뒤가
  코드로 남아 오탐이 납니다.
- **raw string의 해시 개수가 가변입니다.** `#"…"#`, `##"…"##`처럼 여는 쪽 `#` 개수만큼
  닫아야 하며, 멀티라인(`"""`)과도 조합됩니다.

그 밖의 처리:

- `#if`, `#selector` 같은 컴파일러 지시자를 문자열 시작으로 오인하지 않습니다.
- `class func` / `class var`처럼 `class`가 멤버 수식어로 쓰일 때 뒤따르는 키워드를 이름으로
  보지 않습니다.
- `actor`는 contextual keyword입니다.
- Swift는 중첩 타입이 흔한데, 깊이 0 규칙으로 자연히 걸러집니다. `extension` 안의 타입도
  마찬가지입니다.

### 성능

Explorer는 파일이 화면에 그려질 때마다 `provideFileDecoration`을 호출하므로 판별 결과를
URI 단위로 캐시합니다. 캐시는 FileSystemWatcher가 생성·변경·삭제를 감지할 때 해당 파일만
무효화됩니다. 편집 중인 파일은 저장 전이라도 열려 있는 텍스트 버퍼를 읽습니다.

**캐시 상한** — 최대 2000개 파일까지만 들고 있으며, 넘으면 오래 쓰지 않은 것부터 버립니다
(`src/lruCache.ts`). 파일이 수만 개인 저장소에서 캐시가 한없이 자라지 않도록 하기 위한 것입니다.

**부분 읽기** — 타입 선언은 거의 언제나 파일 앞부분에 있으므로 먼저 **앞 64KB만** 읽어
판별합니다. 거기서 찾지 못했고 뒤가 남아 있을 때만 전체를 다시 읽습니다. `workspace.fs`에는
부분 읽기가 없어 로컬 파일(`file` 스킴)에서만 Node `fs`로 직접 읽고, 원격·가상 파일시스템은
기존대로 전체를 읽습니다.

잘린 지점이 주석이나 문자열 한가운데여도 파서는 그 뒤를 닫히지 않은 것으로 보고 끝까지
지울 뿐이라, 앞에서 이미 찾은 선언에는 영향이 없습니다. UTF-8 멀티바이트 문자가 경계에서
잘리는 경우도 마찬가지입니다. 이 성질들은 `src/parsers/truncated.test.ts`에 고정해 두었습니다.

### 알려진 한계

- 정규식 기반이므로 문법적으로 깨진 파일(중괄호 짝이 맞지 않는 등)에서는 깊이 계산이
  어긋나 배지가 틀리거나 빠질 수 있습니다. 파일을 저장하면 다시 판별합니다.
- **"파일 하나 = 타입 하나" 관례를 전제합니다.** Java만 언어가 강제하고 나머지는 관례라,
  한 파일에 여러 최상위 타입이 있으면 파일명과 같은 것(없으면 첫 번째)만 대표로 씁니다.
- **C# `delegate`는 지원하지 않습니다.** 이름 앞에 반환 타입이 오는 구조라 파싱이 별개
  케이스가 되는데, 파일 하나가 delegate 하나로 이뤄지는 경우가 드물어 제외했습니다.
- **Swift `extension`은 지원하지 않습니다.** `Foo+Bar.swift` 같은 extension 전용 파일이
  흔하지만 타입 선언이 아니라서 배지를 붙이지 않습니다.
- 조건부 선언(PHP의 `if (!class_exists('X')) { class X {} }`)은 깊이가 0이 아니라
  잡히지 않습니다.

## 개발

```bash
npm install
npm test        # 컴파일 + 파서 유닛 테스트
```

F5(`Run Extension`)를 누르면 `sample/` 폴더를 워크스페이스로 연 확장 개발 호스트가 뜹니다.
지원하는 타입마다 파일이 하나씩 있고, verbatim 문자열·heredoc·중첩 주석·익명 클래스 같은
함정을 일부러 심어둔 파일도 들어 있습니다.

git 배지와 겹치는 모습을 보려면 `sample/`에서 `git init`을 실행하고 몇 개 파일을 서로 다른
상태(수정·미추적·스테이징)로 만들면 됩니다.

```
src/
├─ extension.ts        # FileDecorationProvider, 캐시, watcher — 언어 무관
├─ badges.ts           # 기본 배지 표, 설정값 정규화 (2자 제한)
├─ lruCache.ts         # 판별 결과 캐시 (상한 2000)
└─ parsers/
   ├─ types.ts         # 언어가 공유하는 TypeKind
   ├─ index.ts         # 확장자 → 파서 매핑, 감시 glob
   ├─ braces.ts        # namespace 블록 중괄호 중화 (C#·PHP 공용)
   ├─ java.ts
   ├─ csharp.ts
   ├─ php.ts
   └─ swift.ts
```

언어를 추가하려면 `parsers/`에 파서를 만들고 `index.ts`의 `BY_EXTENSION`에 등록한 뒤,
`badges.ts`의 `DEFAULT_BADGES`, `package.json`의 설정 항목, `package.nls*.json` 두 파일에
같은 내용을 넣습니다. 감시 glob은 매핑에서 파생되므로 `extension.ts`는 손대지 않아도 됩니다.
설정 기본값이나 nls 키가 코드와 어긋나면 `badges.test.ts`가 실패합니다.

새 타입 종류가 필요하면 `types.ts`의 `TypeKind`와 `badges.ts`의 `TOOLTIPS`에 추가합니다.

### 배포

`package.json`에는 배포 전에 반드시 바꿔야 할 플레이스홀더가 들어 있습니다.

- `publisher` — 마켓플레이스 발행자 ID
- `repository`, `bugs`, `homepage` — 저장소 URL
- `LICENSE`의 저작권자 이름

```bash
npx @vscode/vsce package     # .vsix 로컬 빌드
npx @vscode/vsce publish     # 마켓플레이스 배포
```

<br>
<center>
<a href='https://ko-fi.com/devdinist' target='_blank'><img height='36' style='border:0px;height:45px;' src='https://storage.ko-fi.com/cdn/kofi5.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
</center>

## 라이선스

[MIT](LICENSE)
