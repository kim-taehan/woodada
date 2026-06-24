# t01 — content-designer: 경기장(트랙 테마) 스키마 & 데이터 (feat/arenas)

데이터/계약 단계 산출물. renderer-dev(소비)·shell-dev(선택 UI)가 이 문서를 계약으로 삼는다.
순수 시각. 엔진/결정론/밸런스 무영향(엔진 파일 0개 변경). typecheck 통과.

## 생성 파일
- `src/data/tracks/schema.ts` — `TrackTheme`, `DecorSpec`, `Ambient`
- `src/data/tracks/grassland.ts` … `jungle.ts` (6종)
- `src/data/tracks/index.ts` — `trackCatalog`, `defaultArenaIds`, `pickArena(seed)`

## 확정 인터페이스 (전문)
```ts
export interface DecorSpec {
  kind: string;   // 아래 kind 어휘 중 하나
  x: number;      // 0=좌 ~ 1=우 (정규화)
  y: number;      // 0=상 ~ 1=하 (정규화)
  scale?: number; // 기본 1
}

export type Ambient = 'sand' | 'snow' | 'petals' | 'fireflies' | 'none';

export interface TrackTheme {
  id: string;
  label: string;   // 한글명 (setup UI)
  emoji: string;   // 아이콘 (setup UI)

  // 팔레트 (hex 0xRRGGBB, PixiJS .fill/.stroke 직접 사용)
  surface: number;       // 트랙 면 — 항상 가독성 유지
  surfaceAlt?: number;   // 레인 줄무늬 교대색 (옵션)
  infield: number;       // 안쪽 필드
  infieldEdge?: number;  // 안쪽 필드 코어(더 진한 층, 옵션)
  laneLine: number;      // 레인 분리선
  kerb: number;          // 바깥 테/연석
  skyTop: number;        // 배경 그라데이션 상단
  skyBottom: number;     // 배경 그라데이션 하단

  decor: DecorSpec[];
  ambient?: Ambient;     // 생략 시 'none' 취급
}
```

좌표는 0..1 정규화(씬 기준). renderer가 자기 캔버스로 매핑. decor는 배경 소품 전용
(트랙 면 위에 겹치지 않게, 보통 하늘/필드 영역). 트랙면은 항상 또렷하게.

## renderer가 구현해야 하는 decor kind (총 11종 — 작게 유지)
**테마당 2~3 어휘만 사용.** 전체 사용 kind 목록:

| kind | 사용 테마 |
|------|-----------|
| cloud | grassland(없음), beach, snow |
| sun | desert, beach |
| moon | citynight |
| cactus | desert |
| palm | desert |
| parasol | beach |
| tube | beach |
| building | citynight |
| pine | snow |
| snowman | snow |
| leaf | jungle |
| vine | jungle |

> grassland은 회귀 0 위해 **decor=[] (소품 없음)**. cloud는 beach/snow에서만 실사용.
> 사용되는 kind 집합 = { sun, moon, cloud, cactus, palm, parasol, tube, building, pine, snowman, leaf, vine }.

## ambient 힌트 사용처
- desert='sand', snow='snow', jungle='fireflies', 그 외(grassland/beach/citynight)='none'.
- 'petals'는 스키마에 예약만 (현재 미사용).

## pickArena 시그니처
```ts
export function pickArena(seed: number): TrackTheme;
// (seed >>> 0) % defaultArenaIds.length 인덱스 매핑. RNG 없음, 결정론.
// 같은 seed → 같은 경기장 (리플레이/스크린샷 훅 일관성).
```
`trackCatalog: Record<string, TrackTheme>`, `defaultArenaIds`(grassland 첫번째=기본).

## 6 테마 요약 (팔레트 핵심)
| id | label | emoji | surface | infield | laneLine | sky(top→bottom) | ambient | decor |
|----|-------|-------|---------|---------|----------|------------------|---------|-------|
| grassland | 초원 | 🌿 | 0xd2452f | 0x7ec46f | 0xffffff | 0x6fae6a(flat) | none | (없음) |
| desert | 사막 오아시스 | 🏜️ | 0xd9a86a | 0xe6c98c | 0xfff2d8 | 0xf6c66a→0xfbe6a8 | sand | sun,cactus×2,palm×2 |
| beach | 해변 | 🌊 | 0xe2c79a | 0x36b5c4 | 0xfffaf0 | 0x7fd0e8→0xd6f3fb | none | sun,cloud,parasol×2,tube |
| citynight | 도시 야경 | 🏙️ | 0x444a63 | 0x232842 | 0x4ff0ff | 0x121636→0x2a2350 | none | moon,building×4 |
| snow | 설원 | ❄️ | 0xbfe0ef | 0xf2f7fb | 0x8fc4dd | 0xa9cfe4→0xeaf4fb | snow | cloud,pine×2,snowman |
| jungle | 정글 | 🌴 | 0xa9794a | 0x2f7d3f | 0xe8dcc0 | 0x3aa05a→0x88c98c | fireflies | leaf×2,vine×2 |

## renderer-dev 노트
- **grassland 회귀 0**: 원본 TrackScene 하드코딩 색 그대로 복사함.
  trackBand=0xd2452f→surface, innerEdge=0xe8923c→kerb, infield=0x7ec46f→infield,
  infieldInner=0x68b25b→infieldEdge, laneLine=0xffffff, 잔디 surround=0x6fae6a→skyTop=skyBottom.
  stands ring(0x9aa3b2)는 테마 비대상(렌더러 내부 유지).
- **citynight 가독성**: surface를 일부러 mid-slate(0x444a63)로 — near-black 금지. 캐릭터 대비 확보.
- skyTop==skyBottom이면 flat 배경(grassland). 그 외는 세로 그라데이션 권장.

## shell-dev 노트
- 선택 UI는 테마 데이터의 `label`/`emoji`만 읽으면 충분. SetupScreen 직접 수정은 shell-dev 담당.
- `defaultArenaIds`(순서=표시 순서, grassland 기본).
