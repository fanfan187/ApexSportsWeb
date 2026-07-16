/** 记录类型选项（1-校记录，2-市记录，3-省记录，对齐 RecordConstants + StatusTag.recordType） */
export const RECORD_TYPE_OPTIONS = [
  { label: '校记录', value: 1 },
  { label: '市记录', value: 2 },
  { label: '省记录', value: 3 },
]

/** 记录状态选项（1-有效，0-已作废，对齐 RecordConstants.RECORD_STATUS_*） */
export const STATUS_OPTIONS = [
  { label: '有效', value: 1 },
  { label: '已作废', value: 0 },
]
