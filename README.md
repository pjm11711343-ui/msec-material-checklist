# 명신기공 자재부 업무 체크리스트

담당자별 일일/주간/월간/신규현장 업무를 체크하고, 체크 기록을 GitHub 저장소에 커밋으로 남기는 웹 프로그램입니다.
서버·DB 없이 GitHub Pages(화면) + GitHub 저장소(데이터)만 사용합니다.

## 구성

- 프로그램 저장소 (예: msec-material-checklist) : 이 코드. GitHub Pages로 배포. 공개(public) 가능
- 데이터 저장소 (예: msec-material-checklist-data) : 업무 목록과 체크 기록. 비공개(private) 권장
  - data/config.json : 업무 목록, 신규현장, 휴무일, 사용 시작일
  - data/records/2026-10.json : 그 달 체크 기록 (월별 파일)
  - data/records/events.json : 신규현장 업무 체크 기록
- 체크 한 번 = 데이터 저장소에 커밋 한 번 (누가/언제/무엇을 했는지 커밋 기록으로 남음)

## 설치 순서 (처음 한 번)

1. GitHub에서 저장소 2개 만들기
   - 프로그램 저장소: msec-material-checklist (Public)
   - 데이터 저장소: msec-material-checklist-data (Private), "Add a README file" 체크해서 만들기 (빈 저장소면 저장이 안 됨)

2. 이 폴더를 프로그램 저장소에 올리기
   git init
   git add .
   git commit -m "자재부 체크리스트"
   git branch -M main
   git remote add origin https://github.com/계정/msec-material-checklist.git
   git push -u origin main

3. GitHub Pages 켜기
   프로그램 저장소 → Settings → Pages → Build and deployment → Source를 "GitHub Actions"로 선택
   → Actions 탭에서 배포가 끝나면 https://계정.github.io/msec-material-checklist/ 로 접속

4. 공용 토큰 만들기 (관리자 GitHub 계정에서)
   GitHub 오른쪽 위 프로필 → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
   - Repository access: Only select repositories → 프로그램 저장소, 데이터 저장소 두 개 선택
   - Permissions → Repository permissions → Contents: Read and write
   - Expiration: 원하는 기간 (만료 전에 프로그램 설정 화면에서 교체)

5. 사이트 접속 → 초기 설정 화면
   GitHub 계정 이름, 저장소 이름 2개, 토큰, 관리자 이름(정민), 관리자 비밀번호 입력 → 설정 완료
   - 데이터 저장소에 초안 업무 목록 47건이 자동으로 들어갑니다
   - 프로그램 저장소에 public/auth.json이 커밋되고, 1~2분 뒤 사이트에 반영됩니다

6. 설정 → 담당자 관리
   - 담당자A, 담당자B 이름을 실제 이름으로 변경
   - 각 담당자 "비밀번호 설정" → 본인에게 알려주고, 로그인 후 "내 비밀번호 변경"으로 바꾸게 하기

7. 설정 → 사용 시작일 · 휴무일
   - 공휴일·회사 휴무일을 입력 (주말은 자동 제외)
   - 사용 시작일 이전 날짜는 지연/누락으로 표시되지 않습니다 (초기 설정한 날로 자동 지정됨)

## 화면

- 오늘 할 일 : 지연된 월간 업무 / 기간 업무(D-day) / 주간 / 상시 / 신규현장. 오른쪽에 진행률, 담당자별 현황, 10일 이내 다가오는 업무
- 월간 점검표 : 업무 × 날짜 표. 칸을 눌러 체크. 엑셀 내려받기, 인쇄(A4 가로)
- 신규현장 : 현장 등록 → 신규현장 업무가 현장별로 생김. 담당자를 지정하면 그 담당자 업무 + 관리자 업무만 대상
- 업무 관리 (관리자) : 업무 추가/수정/삭제/순서, 엑셀 내려받기·올리기, 담당업무 이관(사람 단위 또는 선택한 업무만). 수정 후 "GitHub에 저장"
- 설정 : 내 비밀번호, 담당자 관리, 사용 시작일·휴무일, GitHub 토큰 교체, 체크 기록(커밋) 보기

## 권한

- 관리자: 모든 업무 체크, 업무 관리, 담당자·휴무일·토큰 관리
- 담당자: 본인 업무만 체크, 신규현장 등록 가능, 다른 사람 업무는 보기만

## 주기 규칙

- 상시 / 매일 : 영업일(주말·휴무일 제외)마다 표시
- 매주 : 지정 요일마다
- 매월 시작일~종료일 : 그 기간 동안 표시, 기간 중 한 번 체크하면 그 달 완료
  - 종료일이 시작일보다 작으면 익월 (25 ~ 7 → 25일~익월 7일)
  - 마감일이 주말·휴무일이면 다음 영업일로 자동 연장
  - 기간 안에 체크하지 않으면 "지연된 월간 업무"로 계속 표시
- 신규현장 : 현장을 등록하면 현장마다 한 번씩

## 초안 목록을 옮기면서 해석한 부분 (업무 관리에서 수정 가능)

- "매일 10일 PIPE 단가 비교표" → 매월 10일로 등록
- "매월초 자재비 단가 관리" → 매월 1~5일
- "전월20일 현장 투입자재 21일에 기성청구 메일 발송" → 매월 21일, 비고에 "20일 마감 투입자재 기준"
- 총괄의 "매월 11~15일 자재비 집계표 작성"이 두 번 있어서 한 건으로 합침
- "자자비" → "자재비", "에에컨" → "에어컨", "제고" → "재고"로 수정

## 보안 관련 참고

- 토큰은 auth.json에 암호화된 상태로만 저장됩니다 (담당자 비밀번호로만 풀림). 프로그램 저장소가 공개라서 auth.json도 공개되므로 비밀번호는 추측하기 어렵게(8자 이상, 숫자·문자 섞어서) 정하세요.
- 로그인한 사람의 브라우저는 토큰을 쓸 수 있기 때문에, 권한(관리자/담당자)은 화면상 제한입니다. 퇴사자 등은 "로그인 차단" 후, 필요하면 토큰도 교체하세요.
- 토큰이 노출됐다고 의심되면 GitHub에서 즉시 Revoke → 새 토큰 발급 → 설정 → 토큰 교체.

## 로컬 실행

npm install
npm run dev

(로컬에서는 auth.json이 없으므로 한 번 사이트에서 초기 설정을 한 PC라면 저장소의 auth.json을 자동으로 읽습니다)
