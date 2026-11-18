# EngSel 엥셀

혼자 영어 내신을 준비하는 학생을 위한 학습 앱입니다. 본문을 등록하고, 해석·단어·문제를 만들며, 필기와 오답을 남겨 약점을 다시 볼 수 있습니다.

이 저장소에는 같은 앱의 두 가지 구현이 있습니다.

| 폴더 | 설명 |
| --- | --- |
| `engsel-web` | 브라우저에서 바로 쓰는 버전입니다. Gemini로 해석, 단어 선정, AI 도우미를 제공합니다. |
| `engsel` | Next.js로 만드는 버전입니다. 본문, 학습 노트, 문제 풀이, 한국어 정리, 학습 계획, 약점 분석, 도우미 화면이 있습니다. |

## engsel-web 실행

Node.js가 설치되어 있어야 합니다. 저장소 루트에서 환경 파일을 만든 뒤 서버를 실행합니다.

```bash
copy .env.example .env
```

`.env`에 `GEMINI_API_KEY`를 넣습니다. 모델은 기본값 `gemini-3.5-flash-lite`를 쓰며, 바꾸려면 `GEMINI_MODEL`을 지정합니다.

```bash
node engsel-web/server.js
```

브라우저에서 [http://localhost:4173](http://localhost:4173)을 엽니다.

## engsel 실행

```bash
cd engsel
npm install
npm run dev
```

이미지 인식과 도우미는 저장소 루트 `.env`의 `GEMINI_API_KEY`를 사용합니다. 브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 환경 변수

| 이름 | 사용처 | 설명 |
| --- | --- | --- |
| `GEMINI_API_KEY` | `engsel-web`, `engsel` | Gemini API 키. Next.js 앱은 저장소 루트 `.env`를 읽습니다. |
| `GEMINI_MODEL` | `engsel-web`, `engsel` | 사용할 Gemini 모델. 비우면 `gemini-3.5-flash-lite` |

`.env`와 `.env.local`은 Git에 올리지 않습니다. 키 형식만 보려면 `.env.example`을 확인하세요.
