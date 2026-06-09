# 检索离线评测基线（baseline）

- 生成时间：2026-06-09T12:35:57.591232+00:00
- 样本数 n：21
- top-K：4
- rerank provider：`heuristic`

## 汇总指标

| 指标 | 值 | 说明 |
|------|----|------|
| context_recall | 1.000 | 标注 gold chunk 落入 top-K 的比例（label-based） |
| hit_rate@4 | 1.000 | top-K 命中任一 gold 的 query 占比 |
| mrr@4 | 0.964 | 首个 gold 命中的平均倒数排名 |

> context_precision / faithfulness / answer_relevancy 需 LLM 评判（RAGAS），
> 未配置 LLM 时跳过；本基线为纯离线检索侧指标，后续每个阶段以此为对照报 Δ。

## 逐条明细

| query | gold | top-K 命中 | recall | rr |
|-------|------|-----------|--------|----|
| 毕业需要多少学分 | grad_req_001 | grad_req_001 | 1.00 | 1.00 |
| 毕业所需的最低 GPA 是多少 | grad_req_002 | grad_req_002 | 1.00 | 1.00 |
| 需要多少 Level 3-4 高年级课程学分 | grad_req_003 | grad_req_003 | 1.00 | 1.00 |
| 如何联系 IT 支持 | it_007 | it_007 | 1.00 | 1.00 |
| 什么是双因素认证 2FA | it_005 | it_005 | 1.00 | 1.00 |
| 本科学位课程学制是几年 | ug_adm_004 | ug_adm_004 | 1.00 | 1.00 |
| 毕业后可以留在香港吗 IANG | ug_adm_008 | ug_adm_008 | 1.00 | 1.00 |
| 教学语言是什么 | ug_adm_006 | ug_adm_006 | 1.00 | 1.00 |
| non-local applicant definition visa | ug_adm_001 | ug_adm_001 | 1.00 | 1.00 |
| 2025-2026 第一学期什么时候开始和结束 | ac_cal_001 | ac_cal_001 | 1.00 | 1.00 |
| 考试期是什么时候 | ac_cal_003 | ac_cal_003 | 1.00 | 1.00 |
| add drop 增退选期 semester 1 时间 | cr_reg_001 | cr_reg_001 | 1.00 | 1.00 |
| 如何申请大学奖学金 | fa_005 | fa_005 | 1.00 | 1.00 |
| 如何申请学费延期缴费 | fa_011 | fa_011 | 1.00 | 1.00 |
| 学生医疗咨询费用是多少 | hlt_cou_001 | hlt_cou_001 | 1.00 | 0.25 |
| 健康服务中心在哪里 | hlt_cou_002 | hlt_cou_002 | 1.00 | 1.00 |
| 新生迎新活动什么时候举行 | ori_act_001 | ori_act_001 | 1.00 | 1.00 |
| HKBU 有哪些体育设施 | fac_spt_001 | fac_spt_001 | 1.00 | 1.00 |
| 什么是 BUhub | car_int_003 | car_int_003 | 1.00 | 1.00 |
| 有大湾区实习机会吗 | car_int_004 | car_int_004 | 1.00 | 1.00 |
| STEM 实习计划津贴多少 | car_int_001 | car_int_001 | 1.00 | 1.00 |

