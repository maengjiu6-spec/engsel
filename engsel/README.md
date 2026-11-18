# EngSel 엥셀

혼자 영어 내신을 준비하는 학생을 위한 학습 앱입니다. 본문을 올리면 단어장과 문제를 만들고, 푼 결과를 바탕으로 해설과 약점을 정리하는 방향으로 구성되어 있습니다.

## 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

이미지 인식과 도우미는 저장소 루트 `.env`의 `GEMINI_API_KEY`를 사용합니다. 모델은 기본값 `gemini-3.5-flash-lite`이며, 바꾸려면 `GEMINI_MODEL`을 지정합니다.
