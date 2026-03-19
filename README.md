# On-Device Video Frame Analysis

브라우저에서 직접 비전-언어 모델을 실행하여 YouTube 영상 프레임을 분석하는 웹 애플리케이션입니다.
**외부 AI API 없이** WebGPU + Transformers.js를 사용한 온디바이스 추론을 수행합니다.

## 주요 기능

- YouTube 영상 다운로드 및 재생
- 영상 프레임 캡처 (Canvas API)
- **SmolVLM-500M** 비전-언어 모델로 온디바이스 AI 추론 (WebGPU 가속)
- 한국어 구조화 장면 분석 결과 출력
- 커스텀 프롬프트 편집
- 추론 파라미터 조절 (temperature, max tokens)

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| AI 추론 | Transformers.js v3 |
| GPU 가속 | WebGPU (WASM 폴백 지원) |
| 비전-언어 모델 | SmolVLM-500M-Instruct (`HuggingFaceTB/SmolVLM-500M-Instruct`, fp16) |
| 프레임 캡처 | HTMLVideoElement + Canvas API |
| 영상 다운로드 | yt-dlp (서버 사이드) |
| 서버 | Next.js Route Handlers |

## 사전 요구사항

- **Node.js** 18 이상
- **yt-dlp** (YouTube 영상 다운로드)
- **최신 Chrome 또는 Edge 브라우저** (WebGPU 지원)

### yt-dlp 설치

```bash
# macOS (Homebrew)
brew install yt-dlp

# pip
pip install yt-dlp
```

## 설치 및 실행

```bash
# 1. 저장소 클론
git clone <repository-url>
cd lec02_vc-visoin

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 접속 (반드시 localhost 사용)
open http://localhost:3000
```

> **중요**: `http://127.0.0.1:3000`이 아닌 `http://localhost:3000`으로 접속해야 합니다.
> Cross-Origin Isolation (SharedArrayBuffer)은 `localhost` origin에서만 활성화됩니다.

## 사용 방법

1. **모델 로드**: "모델 로드" 버튼 클릭 (최초 1회, ~700 MB 다운로드 후 브라우저 캐시)
2. **영상 다운로드**: YouTube URL 입력 → "영상 다운로드" 클릭
3. **프레임 선택**: 영상 재생 → 원하는 장면에서 일시정지
4. **분석 실행**: "프레임 분석" 버튼 클릭
5. **결과 확인**: 우측 패널에서 한국어 분석 결과 확인

### 분석 출력 형식

```
장면: 실내 회의실에서 여러 명이 테이블에 앉아 있다.
인물: 양복을 입은 남성 3명과 여성 1명이 보인다.
사물: 노트북, 서류, 커피잔이 테이블 위에 놓여 있다.
행동: 한 남성이 프레젠테이션 화면을 가리키며 설명하고 있다.
배경: 흰색 벽과 유리창이 있는 현대적인 사무실 공간이다.
요약: 회의실에서 비즈니스 미팅이 진행되고 있는 장면이다.
```

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 메인 페이지 (상태 관리 + 오케스트레이션)
│   ├── globals.css             # 글로벌 스타일 (다크 테마)
│   └── api/
│       ├── download/
│       │   └── route.ts        # yt-dlp 영상 다운로드 API
│       └── video/
│           └── [filename]/
│               └── route.ts    # 영상 파일 서빙 API (Range 지원)
├── components/
│   ├── Header.tsx              # 헤더 (COI/WebGPU/모델 상태 표시)
│   ├── VideoPlayer.tsx         # 비디오 플레이어 + 프레임 캡처 버튼
│   ├── AnalysisPanel.tsx       # 분석 프롬프트 + 설정 + 결과 표시
│   └── ModelLoader.tsx         # 모델 로딩 UI (진행률 표시)
├── lib/
│   ├── modelManager.ts         # 모델 로딩, 캐싱, WebGPU 감지 (싱글톤)
│   ├── inference.ts            # 프레임 분석 추론 파이프라인
│   └── frameCapture.ts         # Canvas 프레임 캡처 유틸리티
├── middleware.ts               # COOP/COEP 헤더 (Cross-Origin Isolation)
videos/                         # 다운로드된 영상 (gitignore)
```

## 아키텍처

### 전체 파이프라인

```
YouTube URL → yt-dlp (서버) → MP4 파일 → Video Player (브라우저)
                                              ↓ (일시정지 + 클릭)
                                         Canvas API → PNG 프레임
                                              ↓
                                    SmolVLM-500M (WebGPU)
                                              ↓
                                      한국어 장면 분석 결과
```

### 모델 선택 근거

Transformers.js v3.8.1 (최신)에서 지원하는 비전-언어 모델 중 브라우저에서 실행 가능한 모델:

| 모델 | 크기 | 문제 |
|------|------|------|
| Qwen3.5-0.8B-ONNX | 0.8B | model_type `qwen3_5` 미지원 (Transformers.js에 클래스 없음) |
| Qwen2-VL-2B | 2B | fp16 디코더 ~3.5GB → 브라우저 ArrayBuffer 2GB 제한 초과 |
| SmolVLM-500M | 500M | fp16 ~700MB → 브라우저에서 안정적 실행 확인됨 |

### 모델 로딩

- `modelManager.ts`가 모델과 프로세서를 싱글톤으로 관리합니다
- `AutoProcessor.from_pretrained()`로 이미지 전처리기 + 채팅 템플릿 로드
- `AutoModelForImageTextToText.from_pretrained()`로 모델 로드 (fp16)
- 모델 파일은 브라우저 Cache API에 자동 저장되어 재방문 시 즉시 로드

### 추론 파이프라인

1. 캡처된 프레임을 `RawImage.fromURL()`로 로드
2. 최대 960px로 리사이즈 (비전 인코더 패치 수 감소 → 속도 향상)
3. 채팅 형식으로 한국어 프롬프트 구성
4. `processor()`로 토큰화 + 이미지 전처리
5. `model.generate()`로 텍스트 생성 (WebGPU 가속)
6. `batch_decode()`로 한국어 결과 디코딩

### WebGPU 사용

```typescript
// modelManager.ts
model = await AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
  dtype: "fp16",      // 반정밀도 (WebGPU EP 호환)
  device: "webgpu",   // WebGPU 가속
});
```

- WebGPU 미지원 시 자동으로 WASM 폴백
- `navigator.gpu.requestAdapter()`로 지원 여부 확인
- Cross-Origin Isolation (COOP/COEP) 헤더로 SharedArrayBuffer 활성화

## 트러블슈팅

| 증상 | 해결 방법 |
|------|-----------|
| "WebGPU를 사용할 수 없습니다" | Chrome 113+ 또는 Edge 113+ 사용 |
| "Cross-Origin Isolation 비활성" | `http://localhost:3000`으로 접속 (127.0.0.1 불가) |
| 모델 다운로드 실패 | 네트워크 확인. 브라우저 캐시 최소 1 GB 필요 |
| "Array buffer allocation" | 다른 탭 닫기. 브라우저 재시작 |
| chunk 오류 (`./873.js`) | `npm run dev:clean`으로 캐시 삭제 후 재시작 |
| yt-dlp 미설치 | `brew install yt-dlp` 또는 `pip install yt-dlp` |
| 영상 403 에러 | `yt-dlp -U`로 업데이트 |
| 한국어가 아닌 결과 | 프롬프트에 "한국어로" 포함 확인. temperature 0.3-0.7 |

## 브라우저 호환성

| 브라우저 | WebGPU | 상태 |
|----------|--------|------|
| Chrome 113+ | O | 권장 |
| Edge 113+ | O | 권장 |
| Firefox | X | 미지원 |
| Safari 18+ | △ | 부분 지원 |

## 라이선스

MIT
