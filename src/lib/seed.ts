import type { Config, Member, Task } from './types'

// 초안 업무 목록 (업무 관리 화면/엑셀에서 언제든 수정·이관 가능)
type Row = [string, Task['cycle'], number | undefined, number | undefined, string, string?]
// [담당, 주기, from/요일, to, 업무명, 비고]

const LEAD = 'lead', A = 'a', B = 'b'

const rows: Record<string, Row[]> = {
  [LEAD]: [
    ['', 'always', undefined, undefined, '청구서 승인 및 결재 받기'],
    ['', 'event', undefined, undefined, '기계설비공사·소방설비공사 공정분리'],
    ['', 'event', undefined, undefined, '현장 자재리스트 승인내용 정리'],
    ['', 'monthly', 25, 25, '전월 자재비 기성청구금액 현장별 내역 정리 보고'],
    ['', 'always', undefined, undefined, '하자관리 일정 확인'],
    ['', 'always', undefined, undefined, '본사 및 현장 차량 관리'],
    ['', 'always', undefined, undefined, 'NAS서버 관리 및 데이터 관리'],
    ['', 'always', undefined, undefined, '자재부 프로그램 개발 및 관리'],
    ['', 'always', undefined, undefined, '현장 자재비 실행금액 관리'],
    ['', 'monthly', 9, 10, '자재비 총괄 갑지 작성'],
    ['', 'monthly', 11, 15, '현장별 구매결의서 작성'],
    ['', 'monthly', 11, 15, '자재비 집계표 작성'],
    ['', 'monthly', 11, 15, '업체별 어음·현금 결재 분리 작업'],
    ['', 'monthly', 11, 15, '현장/거래처별 투입현황표 작성'],
    ['', 'monthly', 11, 15, '자재비 현장별 갑지 작성'],
    ['', 'monthly', 15, 15, '자재비 투입 집계표 작성'],
    ['', 'monthly', 1, 1, '단가 관리 프로그램 확인'],
  ],
  [A]: [
    ['', 'always', undefined, undefined, '담당현장 청구서 작성 및 발주'],
    ['', 'always', undefined, undefined, '전일 하자완료 일지 및 사진 정리'],
    ['', 'always', undefined, undefined, '하자 관리 리스트 확인 및 정리'],
    ['', 'always', undefined, undefined, '구매결의서 및 발주품의서 작성'],
    ['', 'always', undefined, undefined, '신규 업체 등록 관리'],
    ['', 'always', undefined, undefined, '현장 및 본사 작업복 구입 및 재고 관리'],
    ['', 'always', undefined, undefined, '명함 주문 관리'],
    ['', 'always', undefined, undefined, '화환 발주 관리'],
    ['', 'event', undefined, undefined, '담당 현장 공정별 실행물량 요청'],
    ['', 'event', undefined, undefined, '담당 현장 승인서류 업체 요청 후 현장 전달 리스트 정리'],
    ['', 'weekly', 1, undefined, '하자 주간업무일지 작성'],
    ['', 'monthly', 1, 5, '자재비 단가 관리', '매월초'],
    ['', 'monthly', 9, 10, '자재비 총괄 갑지 금액과 계산서 발행금액 확인'],
    ['', 'monthly', 10, 10, 'PIPE(STS PIPE·SU PIPE·백강관) 단가 비교표 작성'],
    ['', 'monthly', 21, 21, '거래처별 자재비 기성청구 메일 발송', '20일 마감 투입자재 기준'],
    ['', 'monthly', 25, 7, '자재비 기성청구 내역 정리 (업체별 분리)'],
    ['', 'monthly', -1, -1, '본사 차량 주차등록 관리'],
  ],
  [B]: [
    ['', 'always', undefined, undefined, '담당현장 청구서 작성 및 발주'],
    ['', 'always', undefined, undefined, '공구관리 시스템 관리'],
    ['', 'always', undefined, undefined, '현장 무전기 관리'],
    ['', 'always', undefined, undefined, '현장 전산기기 관리'],
    ['', 'always', undefined, undefined, '현장 컨테이너 관리'],
    ['', 'always', undefined, undefined, '소화 티뽑기 자재청구 및 발주 관리'],
    ['', 'event', undefined, undefined, '담당 현장 공정별 실행물량 요청'],
    ['', 'event', undefined, undefined, '담당 현장 승인서류 업체 요청 후 현장 전달 리스트 정리'],
    ['', 'event', undefined, undefined, '담당 현장 단가 비교표 작성'],
    ['', 'weekly', 1, undefined, '자재투입 주간 업무일지 작성'],
    ['', 'monthly', 1, 1, '에어컨 냉매배관 단가 비교표 작성'],
    ['', 'monthly', 7, 10, '전월 계산서 발행 내용/금액 확인 후 출력 정리'],
    ['', 'monthly', 25, 7, '자재비 기성청구 내역 정리 (업체별 분리)'],
  ],
}

export function seedConfig(): Config {
  const tasks: Task[] = []
  let order = 1
  for (const owner of [LEAD, A, B]) {
    for (const [, cycle, x, y, title, note] of rows[owner]) {
      const t: Task = { id: `t${String(order).padStart(3, '0')}`, title, owner, cycle, active: true, order: order++ }
      if (cycle === 'weekly') t.weekday = x
      if (cycle === 'monthly') { t.from = x; t.to = y }
      if (note) t.note = note
      tasks.push(t)
    }
  }
  const n = new Date()
  const startDate = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  return { version: 1, tasks, sites: [], holidays: [], startDate }
}

export function seedMembers(adminName: string): Member[] {
  return [
    { id: LEAD, name: adminName || '총괄', role: 'admin' },
    { id: A, name: '담당자A', role: 'user' },
    { id: B, name: '담당자B', role: 'user' },
  ]
}
