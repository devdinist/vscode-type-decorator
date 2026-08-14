import * as fsPromises from 'fs/promises';
import * as vscode from 'vscode';
import { BadgeTable, CONFIG_SECTION, DEFAULT_BADGES, normalizeBadge, TOOLTIPS } from './badges';
import { LruCache } from './lruCache';
import { baseNameOf, ParseFn, parserFor, TypeKind, WATCH_GLOB } from './parsers';

/** 판별 결과를 들고 있을 파일 수의 상한. 넘으면 오래 안 쓴 것부터 버린다. */
const CACHE_LIMIT = 2000;

/**
 * 파일 앞에서 먼저 읽어볼 바이트 수.
 * 타입 선언은 거의 언제나 파일 앞부분에 있으므로, 생성된 거대 파일을 통째로
 * 읽지 않기 위한 것이다. 여기서 못 찾으면 전체를 다시 읽는다.
 */
const HEAD_BYTES = 64 * 1024;

interface SourceChunk {
  text: string;
  /** 뒤에 더 남았을 수 있으면 true. */
  partial: boolean;
}

/** 설정에서 배지 표를 읽어온다. 설정이 바뀔 때마다 다시 부른다. */
function readBadges(): BadgeTable {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const table: BadgeTable = {};

  for (const [language, kinds] of Object.entries(DEFAULT_BADGES)) {
    const perLanguage: Partial<Record<TypeKind, string>> = {};
    for (const [kind, fallback] of Object.entries(kinds)) {
      perLanguage[kind as TypeKind] = normalizeBadge(
        config.get(`${language}.${kind}`),
        fallback as string,
      );
    }
    table[language] = perLanguage;
  }

  return table;
}

class TypeDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this.emitter.event;

  // Explorer는 파일이 렌더링될 때마다 provideFileDecoration을 호출하므로
  // 판별 결과를 캐시한다. 값이 undefined인 것(= 타입 없음)도 캐시 대상이라 has()로 확인한다.
  private readonly cache = new LruCache<TypeKind | undefined>(CACHE_LIMIT);

  private badges = readBadges();

  async provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): Promise<vscode.FileDecoration | undefined> {
    const fileName = uri.path.slice(uri.path.lastIndexOf('/') + 1);
    const target = parserFor(fileName);
    if (target === undefined) {
      return undefined;
    }

    const key = uri.toString();
    let kind: TypeKind | undefined;

    if (this.cache.has(key)) {
      kind = this.cache.get(key);
    } else {
      kind = await this.detect(uri, target.parse, baseNameOf(fileName));
      if (token.isCancellationRequested) {
        return undefined;
      }
      this.cache.set(key, kind);
    }

    if (kind === undefined) {
      return undefined;
    }

    // 설정에서 비워 둔 타입은 배지를 붙이지 않는다.
    const badge = this.badges[target.language]?.[kind];
    if (!badge) {
      return undefined;
    }

    // 색은 일부러 지정하지 않는다. 지정하면 파일당 하나뿐인 최종색을 git 데코레이션과
    // 경합해 빼앗고, 변경 상태를 색으로 읽을 수 없게 된다.
    return new vscode.FileDecoration(badge, TOOLTIPS[kind]);
  }

  private async detect(
    uri: vscode.Uri,
    parse: ParseFn,
    baseName: string,
  ): Promise<TypeKind | undefined> {
    // 열려 있는 문서라면 저장되지 않은 편집 내용까지 반영된 버퍼를 쓴다.
    const open = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString());
    if (open) {
      return parse(open.getText(), baseName);
    }

    try {
      const head = await this.readHead(uri);
      const kind = parse(head.text, baseName);
      if (kind !== undefined || !head.partial) {
        return kind;
      }

      // 앞부분에 선언이 없었고 뒤가 남았다면 그때만 전체를 읽는다.
      const bytes = await vscode.workspace.fs.readFile(uri);
      return parse(new TextDecoder().decode(bytes), baseName);
    } catch {
      // 삭제 직후이거나 읽을 수 없는 파일 — 배지를 붙이지 않는다.
      return undefined;
    }
  }

  /**
   * 파일 앞부분만 읽는다.
   *
   * workspace.fs에는 부분 읽기가 없어 로컬 파일에서만 Node fs로 직접 읽고,
   * 원격·가상 파일시스템은 기존대로 전체를 읽는다.
   *
   * 잘린 지점이 주석이나 문자열 한가운데여도 파서는 그 뒤를 닫히지 않은 것으로 보고
   * 끝까지 지울 뿐이라, 앞에서 이미 찾은 선언에는 영향이 없다.
   */
  private async readHead(uri: vscode.Uri): Promise<SourceChunk> {
    if (uri.scheme !== 'file') {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return { text: new TextDecoder().decode(bytes), partial: false };
    }

    let handle: fsPromises.FileHandle | undefined;
    try {
      handle = await fsPromises.open(uri.fsPath, 'r');
      const buffer = Buffer.allocUnsafe(HEAD_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
      return {
        text: buffer.subarray(0, bytesRead).toString('utf8'),
        // 버퍼를 꽉 채웠다면 뒤에 더 있을 수 있다.
        partial: bytesRead === HEAD_BYTES,
      };
    } finally {
      await handle?.close();
    }
  }

  invalidate(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
    this.emitter.fire(uri);
  }

  /**
   * 배지 설정만 다시 읽는다. 타입 판별 결과는 설정과 무관하므로 캐시는 유지하고,
   * 이미 그려진 파일만 다시 그리게 한다.
   */
  reloadBadges(): void {
    this.badges = readBadges();
    this.emitter.fire(this.cache.keys().map((key) => vscode.Uri.parse(key)));
  }

  dispose(): void {
    this.emitter.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new TypeDecorationProvider();
  const watcher = vscode.workspace.createFileSystemWatcher(WATCH_GLOB);

  context.subscriptions.push(
    provider,
    vscode.window.registerFileDecorationProvider(provider),
    watcher,
    watcher.onDidCreate((uri) => provider.invalidate(uri)),
    watcher.onDidChange((uri) => provider.invalidate(uri)),
    watcher.onDidDelete((uri) => provider.invalidate(uri)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) {
        provider.reloadBadges();
      }
    }),
  );
}

export function deactivate(): void {
  // context.subscriptions로 모두 정리된다.
}
